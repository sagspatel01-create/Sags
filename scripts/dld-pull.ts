/**
 * Standalone DLD → Supabase puller — the UAE-egress runner.
 *
 * The Digital Dubai (DDA) API only accepts requests originating INSIDE the
 * UAE, so this job must run from a UAE IP (e.g. an Oracle Cloud Always-Free
 * VM in the UAE / Dubai region — $0 forever, static public IP to whitelist
 * with DDA). It has no Next.js dependency: plain Node + the shared pure
 * aggregation logic in src/lib/sources/dld.ts, so there's zero logic drift
 * from the app. Writes straight to Supabase over REST.
 *
 * Run (weekly cron on the UAE box):
 *   DUBAIPULSE_APP_ID=... DUBAIPULSE_API_KEY=... DUBAIPULSE_API_SECRET=... \
 *   DUBAIPULSE_ENV=prod SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *   npx tsx scripts/dld-pull.ts
 *   (or: node --experimental-strip-types scripts/dld-pull.ts)
 */
import {
  normalizeRow,
  aggregate,
  matchCommunity,
  buildCommunityTxns,
  type DldRow,
} from "../src/lib/sources/dld.ts";

const {
  DUBAIPULSE_APP_ID: APP_ID = "",
  DUBAIPULSE_API_KEY: CLIENT_ID = "",
  DUBAIPULSE_API_SECRET: CLIENT_SECRET = "",
  DUBAIPULSE_ENV: DP_ENV = "prod",
  SUPABASE_URL = "",
  SUPABASE_SERVICE_KEY = "",
  MONTHS_BACK = "6",
} = process.env;

function need(name: string, v: string) {
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
}
need("DUBAIPULSE_APP_ID", APP_ID);
need("DUBAIPULSE_API_KEY", CLIENT_ID);
need("DUBAIPULSE_API_SECRET", CLIENT_SECRET);
need("SUPABASE_URL", SUPABASE_URL);
need("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY);

const DDA_BASE = DP_ENV === "prod" ? "https://apis.data.dubai" : "https://stg-apis.data.dubai";
const monthsBack = Number(MONTHS_BACK) || 6;

// ---- DDA iPaaS: token → data (paginated) ------------------------------
async function ddaToken(): Promise<string> {
  const res = await fetch(`${DDA_BASE}/secure/ssis/dubaiai/gatewaytoken/1.0.0/getAccessToken`, {
    method: "POST",
    headers: { "x-DDA-SecurityApplicationIdentifier": APP_ID, "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: "authz" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`DDA token ${res.status}: ${text.slice(0, 200)}`);
  const j = JSON.parse(text) as { access_token?: string };
  if (!j.access_token) throw new Error("DDA token: no access_token");
  return j.access_token;
}

function extractRows(p: unknown): Record<string, string>[] {
  if (Array.isArray(p)) return p as Record<string, string>[];
  const o = p as Record<string, unknown>;
  for (const k of ["results", "result", "data", "records", "value"]) if (Array.isArray(o?.[k])) return o[k] as Record<string, string>[];
  return [];
}

async function ddaTransactions(token: string, sinceISO: string): Promise<DldRow[]> {
  const base = `${DDA_BASE}/secure/ddads/openapi/1.0.0/dld/dld_transactions`;
  const rows: DldRow[] = [];
  const pageSize = 5000;
  for (let page = 1; page <= 200; page++) {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), filter: `instance_date>=${sinceISO}`, order_by: "instance_date", order_dir: "desc" });
    const res = await fetch(`${base}?${qs}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) {
      if (page === 1) throw new Error(`DDA data ${res.status}: ${(await res.text()).slice(0, 200)}`);
      break;
    }
    const batch = extractRows(await res.json());
    if (batch.length === 0) break;
    for (const r of batch) rows.push(normalizeRow(r));
    if (batch.length < pageSize) break;
    await new Promise((r) => setTimeout(r, 1100)); // 60 req/min ceiling
  }
  return rows;
}

// ---- Supabase REST helpers -------------------------------------------
const H = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" };
async function sbGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!res.ok) throw new Error(`supabase GET ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}
async function sbDelete(path: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
}
async function sbInsert(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`supabase insert ${table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

// ---- main -------------------------------------------------------------
async function main() {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const sinceISO = since.toISOString().slice(0, 10);
  console.log(`[dld-pull] env=${DP_ENV} since=${sinceISO}`);

  const token = await ddaToken();
  console.log("[dld-pull] token acquired");
  const rows = await ddaTransactions(token, sinceISO);
  console.log(`[dld-pull] fetched ${rows.length} raw rows`);

  const communities = await sbGet<{ id: string; name: string; slug: string }[]>("communities?select=id,name,slug");
  const subs = await sbGet<{ id: string; name: string; slug: string; community_id: string }[]>("sub_communities?select=id,name,slug,community_id");
  const subsByCommunity = new Map<string, { id: string; name: string; slug: string }[]>();
  for (const s of subs) {
    const a = subsByCommunity.get(s.community_id) ?? [];
    a.push({ id: s.id, name: s.name, slug: s.slug });
    subsByCommunity.set(s.community_id, a);
  }
  const asOf = new Date().toISOString().slice(0, 10);

  // aggregate snapshots (source 'dld')
  const { snapshots, considered } = aggregate(rows, monthsBack);
  const matched = new Set<string>();
  const aggRows: Record<string, unknown>[] = [];
  for (const s of snapshots) {
    const cid = matchCommunity(s.groupName, communities);
    if (!cid) continue;
    matched.add(cid);
    aggRows.push({ community_id: cid, unit_type: s.unit_type, reg_type: s.reg_type, period_start: s.period_start, period_end: s.period_end, txn_count: s.txn_count, avg_price: s.avg_price, median_price: s.median_price, avg_price_per_sqft: s.avg_price_per_sqft || null, min_price: s.min_price, max_price: s.max_price, source: "dld", as_of: asOf });
  }
  for (const cid of matched) await sbDelete(`market_snapshots?community_id=eq.${cid}&source=eq.dld`);
  await sbInsert("market_snapshots", aggRows);
  console.log(`[dld-pull] considered ${considered} villa/TH sales → ${aggRows.length} snapshots / ${matched.size} communities`);

  // detail (source 'dld-detail')
  const { details } = buildCommunityTxns(rows, communities, subsByCommunity, monthsBack);
  const detailRows: Record<string, unknown>[] = [];
  for (const d of details) {
    if (!d.txns.length) continue;
    const dates = d.txns.map((t) => t.d).sort();
    detailRows.push({ community_id: d.community_id, unit_type: null, reg_type: null, source: "dld-detail", as_of: asOf, period_start: dates[0], period_end: dates[dates.length - 1], txn_count: d.txn_count, median_price: d.median_price, avg_price_per_sqft: d.median_ppsf, appreciation_pct: d.appreciation_pct, trend: d.trend, sample_txns: d.txns });
  }
  for (const d of details) await sbDelete(`market_snapshots?community_id=eq.${d.community_id}&source=eq.dld-detail`);
  await sbInsert("market_snapshots", detailRows);
  console.log(`[dld-pull] wrote detail for ${detailRows.length} communities. Done.`);
}

main().catch((e) => {
  console.error("[dld-pull] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
