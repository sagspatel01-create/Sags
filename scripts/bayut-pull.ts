/**
 * Bayut (RapidAPI) DLD → Supabase puller — the globally-callable path.
 *
 * Unlike the DDA feed, the Bayut API has no UAE-only egress restriction, so
 * this runs from anywhere (a laptop, a cron box, even Vercel). It pulls
 * villa/townhouse DLD sales, reuses the app's exact aggregation logic
 * (src/lib/sources/dld.ts + bayut.ts), and writes market_snapshots to
 * Supabase over REST. Free tier ≈ 900 requests/month → mind MAXPAGES.
 *
 * Run:
 *   RAPIDAPI_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *   [TIME_PERIOD=6m] [MAXPAGES=500] \
 *   node --experimental-strip-types scripts/bayut-pull.ts
 */
import { fetchBayutSales } from "../src/lib/sources/bayut.ts";
import { aggregate, buildCommunityTxns, matchCommunity } from "../src/lib/sources/dld.ts";

const {
  RAPIDAPI_KEY = "",
  SUPABASE_URL = "",
  SUPABASE_SERVICE_KEY = "",
  TIME_PERIOD = "6m",
  MAXPAGES = "500",
} = process.env;
for (const [k, v] of Object.entries({ RAPIDAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
}
const H = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" };

async function sbGet<T>(p: string): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, { headers: H });
  if (!r.ok) throw new Error(`GET ${p} ${r.status}`);
  return r.json() as Promise<T>;
}
async function sbDel(p: string) { await fetch(`${SUPABASE_URL}/rest/v1/${p}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } }); }
async function sbIns(t: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) throw new Error(`INS ${t} ${r.status}: ${(await r.text()).slice(0, 150)}`);
  }
}

const { rows, pages, requests, error } = await fetchBayutSales(RAPIDAPI_KEY, {
  timePeriod: TIME_PERIOD, maxPages: Number(MAXPAGES),
  onPage: (p, n) => { if (p % 25 === 0) console.log(`  page ${p} · ${n} rows`); },
});
console.log(`[bayut-pull] ${rows.length} villa/TH rows · ${pages} pages · ${requests} requests${error ? " · err: " + error : ""}`);

type C = { id: string; name: string; slug: string; community_id?: string };
const communities = await sbGet<C[]>("communities?select=id,name,slug");
const subs = await sbGet<Required<C>[]>("sub_communities?select=id,name,slug,community_id");
const subsByCommunity = new Map<string, C[]>();
for (const s of subs) { const a = subsByCommunity.get(s.community_id) ?? []; a.push(s); subsByCommunity.set(s.community_id, a); }
const asOf = new Date().toISOString().slice(0, 10);

const { snapshots, considered } = aggregate(rows, 6);
const matched = new Set<string>(); const aggRows: Record<string, unknown>[] = [];
for (const s of snapshots) {
  const cid = matchCommunity(s.groupName, communities); if (!cid) continue; matched.add(cid);
  aggRows.push({ community_id: cid, unit_type: s.unit_type, reg_type: s.reg_type, period_start: s.period_start, period_end: s.period_end, txn_count: s.txn_count, avg_price: s.avg_price, median_price: s.median_price, avg_price_per_sqft: s.avg_price_per_sqft || null, min_price: s.min_price, max_price: s.max_price, source: "dld", as_of: asOf });
}
for (const cid of matched) await sbDel(`market_snapshots?community_id=eq.${cid}&source=eq.dld`);
await sbIns("market_snapshots", aggRows);

const { details } = buildCommunityTxns(rows, communities, subsByCommunity, 6);
const detRows: Record<string, unknown>[] = [];
for (const d of details) {
  if (!d.txns.length) continue; const dates = d.txns.map((t) => t.d).sort();
  detRows.push({ community_id: d.community_id, unit_type: null, reg_type: null, source: "dld-detail", as_of: asOf, period_start: dates[0], period_end: dates[dates.length - 1], txn_count: d.txn_count, median_price: d.median_price, avg_price_per_sqft: d.median_ppsf, appreciation_pct: d.appreciation_pct, trend: d.trend, sample_txns: d.txns });
}
for (const d of details) await sbDel(`market_snapshots?community_id=eq.${d.community_id}&source=eq.dld-detail`);
await sbIns("market_snapshots", detRows);
console.log(`[bayut-pull] considered ${considered} sales → ${aggRows.length} snapshots · ${matched.size} communities · detail for ${detRows.length}. Done.`);
