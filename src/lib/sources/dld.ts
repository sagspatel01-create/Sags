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
  project: string; // master_project_en / project_name_en
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
  project: ["master_project_en", "project_name_en", "project_en", "project"],
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
    const group = (r.project || r.area).trim();
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
