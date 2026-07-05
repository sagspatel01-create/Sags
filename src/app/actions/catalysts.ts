"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCommunityBySlug } from "@/lib/data/communities";
import { getAnthropic, GENERATION_MODEL } from "@/lib/anthropic";
import type Anthropic from "@anthropic-ai/sdk";

export interface Catalyst {
  title: string;
  category: string; // road | transport | school | retail | government | development | infrastructure
  timeline: string; // e.g. "Completed 2023", "Expected 2027"
  note: string; // impact on value / why it matters
}

const CATS = ["road", "transport", "school", "retail", "government", "development", "infrastructure"];

export async function updateCatalysts(slug: string, catalysts: Catalyst[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase not configured." };
  const clean = catalysts
    .map((c) => ({
      title: (c.title ?? "").trim(),
      category: CATS.includes(c.category) ? c.category : "infrastructure",
      timeline: (c.timeline ?? "").trim(),
      note: (c.note ?? "").trim(),
    }))
    .filter((c) => c.title)
    .slice(0, 24);
  const db = supabase as unknown as {
    from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> } };
  };
  const { error } = await db.from("communities").update({ catalysts: clean }).eq("slug", slug);
  if (error) return { ok: false, error: String(error) };
  revalidatePath(`/communities/${slug}`);
  revalidatePath(`/admin/communities/${slug}`);
  return { ok: true };
}

/**
 * Draft growth catalysts for a community — the roads, transport, schools,
 * retail and government/master-plan projects in and around it that drive
 * value. Uses the community's location/context plus well-known, stable
 * public facts (the operator holds developer agreements and reviews every
 * item before publishing). Never invents specific figures.
 */
export async function draftCatalysts(slug: string): Promise<{ catalysts: Catalyst[] | null; error?: string }> {
  const client = getAnthropic();
  if (!client) return { catalysts: null, error: "Anthropic not configured." };
  const c = await getCommunityBySlug(slug);
  if (!c) return { catalysts: null, error: "Community not found." };

  const facts = [
    `Community: ${c.name}`,
    `Developer: ${c.developer?.name ?? "—"}`,
    `Status: ${c.status}`,
    c.age_or_handover ? `Handover: ${c.age_or_handover}` : "",
    c.description_long ? `About: ${c.description_long}` : "",
    `Sub-communities: ${c.sub_communities.map((s) => s.name).join(", ") || "—"}`,
  ].filter(Boolean).join("\n");

  const tool: Anthropic.Tool = {
    name: "save_catalysts",
    description:
      "List the real growth catalysts in/around this Dubai community — major roads & highways, metro/transport, " +
      "schools, retail & town centres, and government / master-plan / infrastructure projects — each with a timeline " +
      "and a short note on why it supports value. Use well-known, stable facts about the area; do NOT invent specific " +
      "dates or figures you are unsure of (leave timeline general, e.g. 'Under development', if unknown). 5-8 items.",
    input_schema: {
      type: "object",
      properties: {
        catalysts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              category: { type: "string", enum: CATS },
              timeline: { type: "string" },
              note: { type: "string" },
            },
            required: ["title", "category", "note"],
          },
        },
      },
      required: ["catalysts"],
    },
  };
  try {
    const res = await client.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 1600,
      tools: [tool],
      tool_choice: { type: "tool", name: "save_catalysts" },
      messages: [{ role: "user", content: `Draft the area-intelligence growth catalysts for this community:\n\n${facts}` }],
    });
    const t = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const catalysts = (t?.input as { catalysts?: Catalyst[] })?.catalysts ?? [];
    return { catalysts };
  } catch (e) {
    return { catalysts: null, error: e instanceof Error ? e.message : "Draft failed." };
  }
}
