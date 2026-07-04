"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { IngestProposal } from "@/lib/ingest";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const STATUS = new Set(["ready", "offplan", "mixed"]);
const TIER = new Set(["ultra_prime", "prime", "premium", "mid", "accessible"]);

type Handle = {
  from: (t: string) => {
    upsert: (
      v: Record<string, unknown>,
      opts?: { onConflict?: string },
    ) => {
      select: (c: string) => {
        maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }>;
      };
    };
    insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
    select: (c: string) => {
      eq: (c: string, v: unknown) => {
        eq: (c: string, v: unknown) => {
          maybeSingle: () => Promise<{ data: { id: string } | null }>;
        };
        maybeSingle: () => Promise<{ data: { id: string } | null }>;
      };
    };
  };
};

export interface ApplyResult {
  ok: boolean;
  communitySlug?: string;
  applied?: { subs: number; units: number; paymentPlan: boolean };
  error?: string;
}

/**
 * Write a reviewed extraction proposal into the live DB. Everything the
 * operator confirmed is persisted; unknowns simply aren't set. The source
 * document should already be uploaded separately (provenance).
 */
export async function applyIngest(proposal: IngestProposal): Promise<ApplyResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase not configured." };
  const db = supabase as unknown as Handle;

  const cName = proposal.community?.name?.trim();
  if (!cName) return { ok: false, error: "A community name is required to apply." };
  const cSlug = slugify(cName);

  try {
    // Developer (optional) — resolve or create by slug.
    let developerId: string | null = null;
    const devName = proposal.community.developer?.trim();
    if (devName) {
      const { data: dev } = await db
        .from("developers")
        .upsert({ name: devName, slug: slugify(devName) }, { onConflict: "slug" })
        .select("id")
        .maybeSingle();
      developerId = dev?.id ?? null;
    }

    // Community — upsert by slug.
    const c = proposal.community;
    const { data: community, error: cErr } = await db
      .from("communities")
      .upsert(
        {
          name: cName,
          slug: cSlug,
          developer_id: developerId,
          status: STATUS.has(c.status ?? "") ? c.status : "mixed",
          positioning_tier: TIER.has(c.positioning_tier ?? "") ? c.positioning_tier : null,
          age_or_handover: c.age_or_handover ?? null,
          villa_count: c.villa_count ?? null,
          townhouse_count: c.townhouse_count ?? null,
          total_units: c.total_units ?? null,
          description_long: c.description_long ?? null,
          who_its_for_base: c.who_its_for_base ?? null,
          character_tags: Array.isArray(c.character_tags) ? c.character_tags : [],
          is_placeholder: false,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .maybeSingle();
    if (cErr || !community) throw cErr ?? new Error("Community write failed.");
    const communityId = community.id;

    // Sub-communities — upsert by (community_id, slug). Ensure at least one
    // exists so units have a home.
    const subMap = new Map<string, string>(); // name(lower) -> id
    const subs = [...(proposal.sub_communities ?? [])];
    if (subs.length === 0 && (proposal.units ?? []).length > 0) {
      subs.push({ name: cName });
    }
    for (const s of subs) {
      if (!s?.name?.trim()) continue;
      const sSlug = slugify(s.name);
      const { data: sub } = await db
        .from("sub_communities")
        .upsert(
          {
            community_id: communityId,
            name: s.name.trim(),
            slug: sSlug,
            status: STATUS.has(s.status ?? "") ? s.status : "mixed",
            description_long: s.description_long ?? null,
            is_placeholder: false,
          },
          { onConflict: "community_id,slug" },
        )
        .select("id")
        .maybeSingle();
      if (sub?.id) subMap.set(s.name.trim().toLowerCase(), sub.id);
    }
    const defaultSubId = subMap.values().next().value ?? null;

    // Units — insert under the matching sub (by name) or the default.
    let unitCount = 0;
    for (const u of proposal.units ?? []) {
      const subId =
        (u.sub_community && subMap.get(u.sub_community.trim().toLowerCase())) ||
        defaultSubId;
      if (!subId) continue;
      const { error } = await db.from("unit_archetypes").insert({
        sub_community_id: subId,
        name: u.name ?? null,
        unit_type: u.unit_type === "townhouse" ? "townhouse" : "villa",
        bedrooms: u.bedrooms ?? null,
        bathrooms: u.bathrooms ?? null,
        bua_sqft: u.bua_sqft ?? null,
        plot_sqft: u.plot_sqft ?? null,
        price: u.price ?? null,
        has_garden: u.has_garden ?? null,
        has_pool: u.has_pool ?? null,
        service_charge_per_sqft: u.service_charge_per_sqft ?? null,
      });
      if (!error) unitCount++;
    }

    // Payment plan (optional).
    let paymentPlan = false;
    const pp = proposal.payment_plan;
    if (pp && (pp.plan_type || pp.construction_pct || pp.handover_pct)) {
      const { error } = await db.from("payment_plans").insert({
        community_id: communityId,
        plan_type: pp.plan_type ?? null,
        construction_pct: pp.construction_pct ?? null,
        handover_pct: pp.handover_pct ?? null,
      });
      if (!error) paymentPlan = true;
    }

    revalidatePath(`/communities/${cSlug}`);
    revalidatePath("/communities");
    revalidatePath("/browse");
    return {
      ok: true,
      communitySlug: cSlug,
      applied: { subs: subMap.size, units: unitCount, paymentPlan },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Apply failed." };
  }
}
