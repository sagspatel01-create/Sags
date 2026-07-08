import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { env, isDldApiConfigured } from "@/lib/env";
import { fetchDldTransactions } from "@/lib/sources/dld-api";
import { aggregate, matchCommunity, buildCommunityTxns } from "@/lib/sources/dld";

export interface SyncResult {
  ok: boolean;
  skipped?: string;
  fetched?: number;
  considered?: number;
  applied?: number;
  communities?: number;
  unmapped?: number;
  error?: string;
}

/**
 * Weekly automated DLD refresh. Pulls the last 6 months of transactions from
 * the Dubai Pulse API, aggregates villa/townhouse sales per community, and
 * replaces each community's 'dld' snapshots. Runs with the service role
 * (no user session). No-ops cleanly if the API keys aren't set.
 */
export async function syncDldWeekly(monthsBack = 6): Promise<SyncResult> {
  if (!isDldApiConfigured()) return { ok: false, skipped: "Dubai Pulse API key not configured." };
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, skipped: "Service role key not configured." };

  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const sinceISO = since.toISOString().slice(0, 10);

  const { rows, error } = await fetchDldTransactions(
    {
      appId: env.dubaipulseAppId,
      clientId: env.dubaipulseKey,
      clientSecret: env.dubaipulseSecret,
      env: env.dubaipulseEnv,
    },
    sinceISO,
  );
  if (error && rows.length === 0) return { ok: false, error };

  const { snapshots, considered } = aggregate(rows, monthsBack);

  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => Promise<{ data: { id: string; name: string; slug: string; community_id?: string }[] | null }>;
      insert: (v: Record<string, unknown>[]) => Promise<{ error: unknown }>;
      delete: () => { in: (c: string, v: unknown[]) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> } };
    };
  };
  const { data: communities } = await db.from("communities").select("id,name,slug");
  if (!communities) return { ok: false, error: "Could not load communities." };
  const { data: subs } = await db.from("sub_communities").select("id,name,slug,community_id");

  const matched = new Set<string>();
  const unmapped = new Set<string>();
  const asOf = new Date().toISOString().slice(0, 10);
  const outRows: Record<string, unknown>[] = [];
  for (const s of snapshots) {
    const cid = matchCommunity(s.groupName, communities);
    if (!cid) { unmapped.add(s.groupName); continue; }
    matched.add(cid);
    outRows.push({
      community_id: cid, unit_type: s.unit_type, reg_type: s.reg_type,
      period_start: s.period_start, period_end: s.period_end, txn_count: s.txn_count,
      avg_price: s.avg_price, median_price: s.median_price,
      avg_price_per_sqft: s.avg_price_per_sqft || null, min_price: s.min_price,
      max_price: s.max_price, source: "dld", as_of: asOf,
    });
  }
  for (const cid of matched) {
    await db.from("market_snapshots").delete().in("community_id", [cid]).eq("source", "dld");
  }
  if (outRows.length) {
    const { error: wErr } = await db.from("market_snapshots").insert(outRows);
    if (wErr) return { ok: false, error: String(wErr) };
  }

  // Interactive per-community trend detail (Bayut-style drill-down).
  const subsByCommunity = new Map<string, { id: string; name: string; slug: string }[]>();
  for (const s of subs ?? []) {
    if (!s.community_id) continue;
    const arr = subsByCommunity.get(s.community_id) ?? [];
    arr.push({ id: s.id, name: s.name, slug: s.slug });
    subsByCommunity.set(s.community_id, arr);
  }
  const { details } = buildCommunityTxns(rows, communities, subsByCommunity, monthsBack);
  const detailRows: Record<string, unknown>[] = [];
  for (const d of details) {
    if (!d.txns.length) continue;
    const dates = d.txns.map((t) => t.d).sort();
    detailRows.push({
      community_id: d.community_id, unit_type: null, reg_type: null,
      source: "dld-detail", as_of: asOf,
      period_start: dates[0], period_end: dates[dates.length - 1],
      txn_count: d.txn_count, median_price: d.median_price,
      avg_price_per_sqft: d.median_ppsf, appreciation_pct: d.appreciation_pct,
      trend: d.trend, sample_txns: d.txns,
    });
  }
  for (const d of details) {
    await db.from("market_snapshots").delete().in("community_id", [d.community_id]).eq("source", "dld-detail");
  }
  if (detailRows.length) {
    const { error: dErr } = await db.from("market_snapshots").insert(detailRows);
    if (dErr) return { ok: false, error: String(dErr) };
  }

  return {
    ok: true, fetched: rows.length, considered, applied: outRows.length,
    communities: matched.size, unmapped: unmapped.size,
  };
}
