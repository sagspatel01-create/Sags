"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCommunityBySlug } from "@/lib/data/communities";
import { getAnthropic, GENERATION_MODEL } from "@/lib/anthropic";
import type Anthropic from "@anthropic-ai/sdk";
import { aed } from "@/lib/format";

export interface Faq {
  q: string;
  a: string;
}

/** Save the reviewed FAQ list for a community. */
export async function updateFaqs(slug: string, faqs: Faq[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase not configured." };
  const clean = faqs
    .map((f) => ({ q: (f.q ?? "").trim(), a: (f.a ?? "").trim() }))
    .filter((f) => f.q && f.a)
    .slice(0, 20);
  const db = supabase as unknown as {
    from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> } };
  };
  const { error } = await db.from("communities").update({ faqs: clean }).eq("slug", slug);
  if (error) return { ok: false, error: String(error) };
  revalidatePath(`/communities/${slug}`);
  revalidatePath(`/admin/communities/${slug}`);
  return { ok: true };
}

/**
 * Draft FAQs from the community's own data (grounded, not invented). The
 * operator reviews and edits before saving. Uses real fields — developer,
 * status, handover, sub-communities, DLD market snapshots, unit prices —
 * so answers stay defensible.
 */
export async function draftFaqs(slug: string): Promise<{ faqs: Faq[] | null; error?: string }> {
  const client = getAnthropic();
  if (!client) return { faqs: null, error: "Anthropic not configured." };
  const c = await getCommunityBySlug(slug);
  if (!c) return { faqs: null, error: "Community not found." };

  const prices = c.sub_communities
    .flatMap((s) => s.unit_archetypes)
    .filter((u) => u.price)
    .map((u) => `${u.bedrooms ?? "?"}BR ${u.unit_type} ${aed(Number(u.price))}`);
  const market = (c.market_snapshots ?? [])
    .map((m) => `${m.unit_type}/${m.reg_type}: avg ${m.avg_price_per_sqft ?? "?"} AED/sqft, ${m.txn_count ?? 0} txns`);

  const facts = [
    `Community: ${c.name}`,
    `Developer: ${c.developer?.name ?? "—"}`,
    `Status: ${c.status}`,
    c.age_or_handover ? `Handover: ${c.age_or_handover}` : "",
    `Sub-communities: ${c.sub_communities.map((s) => s.name).join(", ") || "—"}`,
    prices.length ? `Unit prices: ${prices.slice(0, 8).join("; ")}` : "",
    market.length ? `DLD market: ${market.join("; ")}` : "",
    c.description_long ? `About: ${c.description_long}` : "",
  ].filter(Boolean).join("\n");

  const tool: Anthropic.Tool = {
    name: "save_faqs",
    description:
      "Draft 5-7 buyer FAQs for a Dubai villa/townhouse community. Ground answers in the provided facts; " +
      "for general, stable facts (freehold status, typical schools/roads nearby) you may use well-known knowledge, " +
      "but never invent specific prices, dates or figures not given. Concise, factual answers.",
    input_schema: {
      type: "object",
      properties: {
        faqs: {
          type: "array",
          items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] },
        },
      },
      required: ["faqs"],
    },
  };
  try {
    const res = await client.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 1500,
      tools: [tool],
      tool_choice: { type: "tool", name: "save_faqs" },
      messages: [{ role: "user", content: `Draft FAQs from these facts:\n\n${facts}` }],
    });
    const t = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const faqs = (t?.input as { faqs?: Faq[] })?.faqs ?? [];
    return { faqs };
  } catch (e) {
    return { faqs: null, error: e instanceof Error ? e.message : "Draft failed." };
  }
}
