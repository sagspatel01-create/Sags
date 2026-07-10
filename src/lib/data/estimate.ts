import { createClient } from "@/lib/supabase/server";

/** Community + its sub-communities, for the estimate wizard's cascading selects. */
export interface EstimateCommunity {
  slug: string;
  name: string;
  subs: string[];
}

export async function getEstimateCatalogue(): Promise<EstimateCommunity[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const [{ data: comms }, { data: subs }] = await Promise.all([
    supabase.from("communities").select("id,name,slug").order("name"),
    supabase.from("sub_communities").select("name,community_id").order("name"),
  ]);
  const byId = new Map<string, EstimateCommunity>();
  for (const c of (comms as unknown as { id: string; name: string; slug: string }[]) ?? []) {
    byId.set(c.id, { slug: c.slug, name: c.name, subs: [] });
  }
  for (const s of (subs as unknown as { name: string; community_id: string }[]) ?? []) {
    byId.get(s.community_id)?.subs.push(s.name);
  }
  return [...byId.values()];
}

/** Real DLD market data for one community, for the valuation. */
export interface EstimateSources {
  communityName: string;
  txns: import("@/lib/sources/dld").TxnLite[];
  trend: import("@/lib/sources/dld").TrendPoint[];
  communityPpsf: number | null;
  appreciationPct: number | null;
  medianPrice: number | null;
}

export async function getEstimateSources(communitySlug: string): Promise<EstimateSources | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: comm } = await supabase
    .from("communities")
    .select("id,name")
    .eq("slug", communitySlug)
    .maybeSingle();
  const c = comm as unknown as { id: string; name: string } | null;
  if (!c) return null;

  // market_snapshots isn't in the generated types yet — cast as other callers do.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data } = await db
    .from("market_snapshots")
    .select("source,avg_price_per_sqft,median_price,appreciation_pct,trend,sample_txns")
    .eq("community_id", c.id)
    .in("source", ["dld", "dld-detail"]);

  type Row = {
    source: string;
    avg_price_per_sqft: number | null;
    median_price: number | null;
    appreciation_pct: number | null;
    trend: import("@/lib/sources/dld").TrendPoint[] | null;
    sample_txns: import("@/lib/sources/dld").TxnLite[] | null;
  };
  const rows = (data as Row[]) ?? [];
  const detail = rows.find((r) => r.source === "dld-detail");
  const ppsfRows = rows.filter((r) => r.avg_price_per_sqft != null).map((r) => Number(r.avg_price_per_sqft));
  const communityPpsf = ppsfRows.length ? ppsfRows.reduce((a, b) => a + b, 0) / ppsfRows.length : null;

  return {
    communityName: c.name,
    txns: detail?.sample_txns ?? [],
    trend: detail?.trend ?? [],
    communityPpsf,
    appreciationPct: detail?.appreciation_pct != null ? Number(detail.appreciation_pct) : null,
    medianPrice: detail?.median_price != null ? Number(detail.median_price) : null,
  };
}
