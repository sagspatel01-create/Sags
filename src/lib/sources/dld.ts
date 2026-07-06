/**
 * DLD (Dubai Land Department) transactions — the source of truth for real
 * sold prices. Data comes from Dubai Pulse (dubaipulse.gov.ae), either via
 * the weekly API sync (automation) or a manual CSV export / DXB Interact
 * upload (gap-fill). This module holds the shared, pure logic: parse a DLD
 * row, filter to villa/townhouse sales, aggregate per community, and match
 * DLD area/project names to our communities. Honesty rule: only real rows
 * from the file/API are aggregated — nothing is invented.
 */

const SQM_TO_SQFT = 10.7639;

// A normalized DLD transaction row (column names vary slightly across
// exports; the importer maps common aliases into these fields).
export interface DldRow {
  date: string; // instance_date / transaction date
  transGroup: string; // Sales / Mortgages / Gifts
  regType: string; // Existing Properties / Off-Plan Properties
  propertyType: string; // Unit / Villa / Building / Land
  propertySubType: string; // Villa / Townhouse / Flat …
  area: string; // area_name_en
  masterProject: string; // master_project_en (≈ community)
  project: string; // project_name_en (≈ cluster) or master
  rooms: string; // rooms_en
  areaSqm: number | null; // procedure_area
  price: number | null; // actual_worth (AED)
  pricePerSqm: number | null; // meter_sale_price
}

const COL: Record<string, string[]> = {
  date: ["instance_date", "transaction_date", "date", "instance date"],
  transGroup: ["trans_group_en", "transaction_group", "group"],
  regType: ["reg_type_en", "registration_type", "reg_type"],
  propertyType: ["property_type_en", "property_type"],
  propertySubType: ["property_sub_type_en", "property_subtype_en", "property_sub_type", "sub_type_en"],
  area: ["area_name_en", "area", "area_en"],
  masterProject: ["master_project_en", "master_project", "master_community"],
  project: ["project_name_en", "project_en", "project"],
  rooms: ["rooms_en", "rooms", "bedrooms"],
  areaSqm: ["procedure_area", "area_sqm", "size_sqm", "property_size"],
  price: ["actual_worth", "amount", "price", "value", "trans_value"],
  pricePerSqm: ["meter_sale_price", "price_per_sqm", "rate_per_sqm"],
};

function pick(rec: Record<string, string>, keys: string[]): string {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(rec)) lower[k.trim().toLowerCase()] = rec[k];
  for (const k of keys) {
    const v = lower[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
function n(s: string): number | null {
  const v = Number(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Map a raw CSV record (any DLD-style header casing) to a DldRow. */
export function normalizeRow(rec: Record<string, string>): DldRow {
  return {
    date: pick(rec, COL.date),
    transGroup: pick(rec, COL.transGroup),
    regType: pick(rec, COL.regType),
    propertyType: pick(rec, COL.propertyType),
    propertySubType: pick(rec, COL.propertySubType),
    area: pick(rec, COL.area),
    masterProject: pick(rec, COL.masterProject),
    project: pick(rec, COL.project),
    rooms: pick(rec, COL.rooms),
    areaSqm: n(pick(rec, COL.areaSqm)),
    price: n(pick(rec, COL.price)),
    pricePerSqm: n(pick(rec, COL.pricePerSqm)),
  };
}

function isVillaOrTownhouse(r: DldRow): "villa" | "townhouse" | null {
  const s = `${r.propertySubType} ${r.propertyType}`.toLowerCase();
  if (s.includes("town")) return "townhouse";
  if (s.includes("villa")) return "villa";
  return null;
}
function isSale(r: DldRow): boolean {
  const g = r.transGroup.toLowerCase();
  return g === "" || g.includes("sale") || g.includes("sell");
}
function regBucket(r: DldRow): "offplan" | "ready" {
  return r.regType.toLowerCase().includes("off") ? "offplan" : "ready";
}
function parseDate(s: string): Date | null {
  // DLD uses DD-MM-YYYY or YYYY-MM-DD; try both.
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(t);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

export interface Snapshot {
  groupName: string; // DLD project/area used as the grouping key
  unit_type: "villa" | "townhouse";
  reg_type: "ready" | "offplan";
  txn_count: number;
  avg_price: number;
  median_price: number;
  avg_price_per_sqft: number;
  min_price: number;
  max_price: number;
  period_start: string;
  period_end: string;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Filter DLD rows to villa/townhouse sales within `monthsBack`, and
 * aggregate into per-(project × unit_type × reg_type) snapshots.
 */
export function aggregate(rows: DldRow[], monthsBack = 6): { snapshots: Snapshot[]; considered: number } {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);

  type Bucket = { prices: number[]; ppsf: number[]; dates: Date[] };
  const buckets = new Map<string, Bucket>();
  let considered = 0;

  for (const r of rows) {
    const ut = isVillaOrTownhouse(r);
    if (!ut || !isSale(r) || !r.price) continue;
    const d = parseDate(r.date);
    if (!d || d < cutoff) continue;
    const group = (r.masterProject || r.project || r.area).trim();
    if (!group) continue;
    considered++;
    const reg = regBucket(r);
    const key = `${group}||${ut}||${reg}`;
    const b = buckets.get(key) ?? { prices: [], ppsf: [], dates: [] };
    b.prices.push(r.price);
    const ppsf = r.pricePerSqm
      ? r.pricePerSqm / SQM_TO_SQFT
      : r.areaSqm
        ? r.price / (r.areaSqm * SQM_TO_SQFT)
        : NaN;
    if (Number.isFinite(ppsf) && ppsf > 0) b.ppsf.push(ppsf);
    b.dates.push(d);
    buckets.set(key, b);
  }

  const snapshots: Snapshot[] = [];
  for (const [key, b] of buckets) {
    const [group, ut, reg] = key.split("||");
    const dates = b.dates.sort((a, z) => a.getTime() - z.getTime());
    snapshots.push({
      groupName: group,
      unit_type: ut as "villa" | "townhouse",
      reg_type: reg as "ready" | "offplan",
      txn_count: b.prices.length,
      avg_price: Math.round(b.prices.reduce((s, x) => s + x, 0) / b.prices.length),
      median_price: Math.round(median(b.prices)),
      avg_price_per_sqft: b.ppsf.length ? Math.round(b.ppsf.reduce((s, x) => s + x, 0) / b.ppsf.length) : 0,
      min_price: Math.min(...b.prices),
      max_price: Math.max(...b.prices),
      period_start: dates[0].toISOString().slice(0, 10),
      period_end: dates[dates.length - 1].toISOString().slice(0, 10),
    });
  }
  snapshots.sort((a, z) => z.txn_count - a.txn_count);
  return { snapshots, considered };
}

// ---- name matching (DLD project/area → our community) ------------------
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(the|dubai|community|villas?|townhouses?|phase\s*\d+)\b/g, "")
    .replace(/\biii\b/g, "3").replace(/\bii\b/g, "2")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Best-effort match of a DLD group name to one of our communities. */
export function matchCommunity(
  group: string,
  communities: { id: string; name: string; slug: string }[],
): string | null {
  const g = norm(group);
  if (!g) return null;
  // exact normalized
  for (const c of communities) if (norm(c.name) === g || norm(c.slug) === g) return c.id;
  // containment either direction (longest wins)
  let best: { id: string; len: number } | null = null;
  for (const c of communities) {
    const cn = norm(c.name);
    if (cn.length < 4) continue;
    if (g.includes(cn) || cn.includes(g)) {
      if (!best || cn.length > best.len) best = { id: c.id, len: cn.length };
    }
  }
  return best?.id ?? null;
}

/**
 * Best-effort match of a DLD project (cluster) name to one of a community's
 * sub-communities. Returns the sub-community NAME (for display) or null.
 * We keep the label rather than an id: the compact txn payload only needs the
 * human-readable cluster to power the "by cluster" filter.
 */
export function matchCluster(
  project: string,
  subs: { id: string; name: string; slug: string }[],
): string | null {
  const g = norm(project);
  if (!g) return null;
  for (const s of subs) if (norm(s.name) === g || norm(s.slug) === g) return s.name;
  let best: { name: string; len: number } | null = null;
  for (const s of subs) {
    const sn = norm(s.name);
    if (sn.length < 4) continue;
    if (g.includes(sn) || sn.includes(g)) {
      if (!best || sn.length > best.len) best = { name: s.name, len: sn.length };
    }
  }
  return best?.name ?? null;
}

/** Parse a DLD rooms label ("4 B/R", "PENTHOUSE", "Studio") into a bed count. */
export function parseBeds(rooms: string): number | null {
  const s = rooms.toLowerCase().trim();
  if (!s) return null;
  if (s.includes("studio")) return 0;
  const m = /(\d+)\s*(b\/?r|bed|br)?/.exec(s);
  if (m) {
    const b = Number(m[1]);
    if (Number.isFinite(b) && b >= 0 && b <= 12) return b;
  }
  return null;
}

// ---- per-community transaction detail (Bayut-style drill-down) ----------

/**
 * A single transaction kept for the interactive drill-down, with short keys
 * to keep the stored JSON payload small. Everything shown on the community
 * Trends tab is derived from an array of these — client-side — so filtering
 * by unit type, bedrooms and cluster stays instant and honest (real rows only).
 */
export interface TxnLite {
  d: string; // ISO date (YYYY-MM-DD)
  c: string | null; // cluster / sub-community label
  b: number | null; // bedrooms
  s: number | null; // BUA sqft
  p: number; // price (AED)
  pp: number | null; // price per sqft
  u: "villa" | "townhouse";
  r: "ready" | "offplan";
}

export interface TrendPoint {
  month: string; // YYYY-MM
  median_ppsf: number;
  n: number;
}

export interface CommunityDetail {
  community_id: string;
  txns: TxnLite[]; // newest first, capped
  trend: TrendPoint[]; // all-segments monthly median ppsf
  appreciation_pct: number | null; // first vs last trend month
  median_price: number;
  median_ppsf: number | null;
  txn_count: number;
}

const TXN_CAP = 1500; // safety cap on stored rows per community

/** Build a compact monthly median-ppsf trend from a set of transactions. */
function buildTrend(txns: TxnLite[]): { trend: TrendPoint[]; appreciation_pct: number | null } {
  const byMonth = new Map<string, number[]>();
  for (const t of txns) {
    if (t.pp == null) continue;
    const month = t.d.slice(0, 7);
    (byMonth.get(month) ?? byMonth.set(month, []).get(month)!).push(t.pp);
  }
  const trend: TrendPoint[] = [...byMonth.entries()]
    .map(([month, ppsf]) => ({ month, median_ppsf: Math.round(median(ppsf)), n: ppsf.length }))
    .sort((a, b) => a.month.localeCompare(b.month));
  let appreciation_pct: number | null = null;
  if (trend.length >= 2) {
    const first = trend[0].median_ppsf;
    const last = trend[trend.length - 1].median_ppsf;
    if (first > 0) appreciation_pct = Math.round(((last - first) / first) * 1000) / 10;
  }
  return { trend, appreciation_pct };
}

/**
 * Group DLD villa/townhouse sales (last `monthsBack` months) into one
 * detail record per matched community: a capped, newest-first list of
 * individual transactions (cluster + beds + size tagged) plus a precomputed
 * all-segments trend. The community page filters/aggregates the txns
 * client-side for the Bayut-style drill-down. Only real rows are kept.
 */
export function buildCommunityTxns(
  rows: DldRow[],
  communities: { id: string; name: string; slug: string }[],
  subsByCommunity: Map<string, { id: string; name: string; slug: string }[]>,
  monthsBack = 6,
): { details: CommunityDetail[]; matched: number } {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);

  const byCommunity = new Map<string, TxnLite[]>();
  let matched = 0;

  for (const r of rows) {
    const ut = isVillaOrTownhouse(r);
    if (!ut || !isSale(r) || !r.price) continue;
    const d = parseDate(r.date);
    if (!d || d < cutoff) continue;
    const group = (r.masterProject || r.project || r.area).trim();
    if (!group) continue;
    const cid = matchCommunity(group, communities);
    if (!cid) continue;
    matched++;
    const ppsf = r.pricePerSqm
      ? r.pricePerSqm / SQM_TO_SQFT
      : r.areaSqm
        ? r.price / (r.areaSqm * SQM_TO_SQFT)
        : NaN;
    const cluster = r.project ? matchCluster(r.project, subsByCommunity.get(cid) ?? []) : null;
    const txn: TxnLite = {
      d: d.toISOString().slice(0, 10),
      c: cluster,
      b: parseBeds(r.rooms),
      s: r.areaSqm ? Math.round(r.areaSqm * SQM_TO_SQFT) : null,
      p: Math.round(r.price),
      pp: Number.isFinite(ppsf) && ppsf > 0 ? Math.round(ppsf) : null,
      u: ut,
      r: regBucket(r),
    };
    (byCommunity.get(cid) ?? byCommunity.set(cid, []).get(cid)!).push(txn);
  }

  const details: CommunityDetail[] = [];
  for (const [community_id, all] of byCommunity) {
    all.sort((a, b) => b.d.localeCompare(a.d)); // newest first
    const txns = all.slice(0, TXN_CAP);
    const { trend, appreciation_pct } = buildTrend(all);
    const prices = all.map((t) => t.p);
    const ppsfs = all.map((t) => t.pp).filter((x): x is number => x != null);
    details.push({
      community_id,
      txns,
      trend,
      appreciation_pct,
      median_price: Math.round(median(prices)),
      median_ppsf: ppsfs.length ? Math.round(median(ppsfs)) : null,
      txn_count: all.length,
    });
  }
  details.sort((a, b) => b.txn_count - a.txn_count);
  return { details, matched };
}
