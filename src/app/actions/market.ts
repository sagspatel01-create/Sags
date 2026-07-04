"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { matchCommunity, type Snapshot } from "@/lib/sources/dld";

export interface ApplyMarketResult {
  ok: boolean;
  applied: number;
  communities: number;
  unmapped: string[];
  error?: string;
}

type Handle = {
  from: (t: string) => {
    select: (c: string) => Promise<{ data: { id: string; name: string; slug: string }[] | null }>;
    insert: (v: Record<string, unknown>[]) => Promise<{ error: unknown }>;
    delete: () => { in: (c: string, v: unknown[]) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> } };
  };
};

/**
 * Write DLD market snapshots. Each snapshot's DLD project/area name is
 * matched to a community; matched community_ids have their prior 'dld'
 * snapshots replaced (a rolling refresh), then the new ones inserted.
 * Unmatched names are returned so the operator can map them.
 */
export async function applyMarketSnapshots(
  snapshots: Snapshot[],
  source = "dld",
): Promise<ApplyMarketResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, applied: 0, communities: 0, unmapped: [], error: "Supabase not configured." };
  const db = supabase as unknown as Handle;

  const { data: communities } = await db.from("communities").select("id,name,slug");
  if (!communities) return { ok: false, applied: 0, communities: 0, unmapped: [], error: "Could not load communities." };

  const rows: Record<string, unknown>[] = [];
  const matchedCommunityIds = new Set<string>();
  const unmapped = new Set<string>();
  const asOf = new Date().toISOString().slice(0, 10);

  for (const s of snapshots) {
    const cid = matchCommunity(s.groupName, communities);
    if (!cid) {
      unmapped.add(s.groupName);
      continue;
    }
    matchedCommunityIds.add(cid);
    rows.push({
      community_id: cid,
      unit_type: s.unit_type,
      reg_type: s.reg_type,
      period_start: s.period_start,
      period_end: s.period_end,
      txn_count: s.txn_count,
      avg_price: s.avg_price,
      median_price: s.median_price,
      avg_price_per_sqft: s.avg_price_per_sqft || null,
      min_price: s.min_price,
      max_price: s.max_price,
      source,
      as_of: asOf,
    });
  }

  try {
    // Rolling refresh: clear prior snapshots for the communities we're
    // updating, from this source, then insert the fresh set.
    for (const cid of matchedCommunityIds) {
      await db.from("market_snapshots").delete().in("community_id", [cid]).eq("source", source);
    }
    if (rows.length) {
      const { error } = await db.from("market_snapshots").insert(rows);
      if (error) throw error;
    }
    revalidatePath("/communities");
    revalidatePath("/live");
    for (const c of communities) if (matchedCommunityIds.has(c.id)) revalidatePath(`/communities/${c.slug}`);
    return {
      ok: true,
      applied: rows.length,
      communities: matchedCommunityIds.size,
      unmapped: [...unmapped].slice(0, 40),
    };
  } catch (e) {
    return { ok: false, applied: 0, communities: 0, unmapped: [...unmapped], error: e instanceof Error ? e.message : "Write failed." };
  }
}
