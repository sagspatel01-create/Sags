import type { CatalogueRow } from "@/lib/data/catalogue";
import type { ClientProfileSnapshot, PriorityKey } from "@/lib/client-profile";
import { tiersForBudget, TIER_ORDER } from "@/lib/client-profile";
import {
  TIER_LABEL,
  UNIT_TYPE_LABEL,
  KITCHEN_LABEL,
} from "@/lib/format";

/**
 * Config-driven filter framework (Milestone 6).
 *
 * A filter is: a config entry (label, control, group) + an accessor that
 * pulls the comparable value(s) off a CatalogueRow. Adding a new filter over
 * an existing field = one FILTER_CONFIG entry + (if new) one ACCESSORS entry.
 * Nothing else in the store re-architects. The DB's filter_definitions table
 * mirrors this so the owner can curate which filters show.
 */

export type FilterControl = "range" | "select" | "multiselect" | "toggle";

export interface FilterDef {
  key: string;
  label: string;
  control: FilterControl;
  group: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Options for select/multiselect; when omitted they're derived from data. */
  options?: { value: string; label: string }[];
}

export const FILTER_CONFIG: FilterDef[] = [
  // Property
  { key: "unit_type", label: "Villa / Townhouse", control: "multiselect", group: "Property" },
  { key: "bedrooms", label: "Bedrooms", control: "range", group: "Property", min: 1, max: 8, step: 1 },
  { key: "bathrooms", label: "Bathrooms", control: "range", group: "Property", min: 1, max: 10, step: 1 },
  { key: "status", label: "Status", control: "select", group: "Property" },
  // Areas
  { key: "bua", label: "Built-up area", control: "range", group: "Areas", unit: "sqft", min: 1000, max: 15000, step: 250 },
  { key: "plot", label: "Plot area", control: "range", group: "Areas", unit: "sqft", min: 1000, max: 25000, step: 500 },
  // Layout
  { key: "kitchen_type", label: "Kitchen", control: "select", group: "Layout" },
  // Financials
  { key: "budget", label: "Budget (max)", control: "range", group: "Financials", unit: "AED", min: 1000000, max: 60000000, step: 500000 },
  { key: "service_charge", label: "Service charge", control: "range", group: "Financials", unit: "AED/sqft", min: 0, max: 40, step: 1 },
  // Market
  { key: "appreciation", label: "Capital appreciation", control: "range", group: "Market", unit: "%", min: 0, max: 40, step: 1 },
  { key: "yield", label: "Rental yield", control: "range", group: "Market", unit: "%", min: 0, max: 12, step: 0.5 },
  // Momentum
  { key: "absorption", label: "Absorption rate", control: "range", group: "Momentum", unit: "%", min: 0, max: 100, step: 5 },
  // Context
  { key: "commute", label: "Commute to hub (max)", control: "range", group: "Context", unit: "min", min: 5, max: 60, step: 5 },
  // Character
  { key: "tags", label: "Character", control: "multiselect", group: "Character" },
  // Identity
  { key: "developer", label: "Developer", control: "select", group: "Identity" },
  { key: "tier", label: "Positioning", control: "select", group: "Identity" },
];

type Accessed = number[] | string[] | boolean;

export const ACCESSORS: Record<string, (r: CatalogueRow) => Accessed> = {
  unit_type: (r) => r.unitTypes,
  bedrooms: (r) => r.bedrooms,
  bathrooms: (r) => r.bathrooms,
  status: (r) => [r.status],
  bua: (r) => r.bua,
  plot: (r) => r.plot,
  kitchen_type: (r) => r.kitchenTypes,
  budget: (r) => r.prices,
  service_charge: (r) => r.serviceCharges,
  appreciation: (r) => r.appreciation,
  yield: (r) => r.yields,
  absorption: (r) => r.absorption,
  commute: (r) => (r.commuteMin != null ? [r.commuteMin] : []),
  tags: (r) => r.tags,
  developer: (r) => (r.developerSlug ? [r.developerSlug] : []),
  tier: (r) => (r.tier ? [r.tier] : []),
};

// ---- active filter state --------------------------------------------
export type RangeVal = { min?: number; max?: number };
export type ActiveFilters = Record<string, RangeVal | string | string[] | true>;

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): ActiveFilters {
  const active: ActiveFilters = {};
  for (const def of FILTER_CONFIG) {
    if (def.control === "range") {
      const min = numParam(params[`${def.key}_min`]);
      const max = numParam(params[`${def.key}_max`]);
      if (min !== undefined || max !== undefined) active[def.key] = { min, max };
    } else if (def.control === "multiselect") {
      const raw = strParam(params[def.key]);
      if (raw) active[def.key] = raw.split(",").filter(Boolean);
    } else if (def.control === "toggle") {
      if (strParam(params[def.key]) === "1") active[def.key] = true;
    } else {
      const raw = strParam(params[def.key]);
      if (raw) active[def.key] = raw;
    }
  }
  return active;
}

function numParam(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === undefined || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
function strParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

// ---- predicates ------------------------------------------------------
function matchRange(vals: number[], range: RangeVal): boolean {
  // Unknown-friendly: a community with no data for this field is not excluded
  // (the figure lands in Phase 2), so the filter narrows only where data exists.
  if (vals.length === 0) return true;
  const lo = range.min ?? -Infinity;
  const hi = range.max ?? Infinity;
  return vals.some((v) => v >= lo && v <= hi);
}

/** Budget uses price data when present, else the tier heuristic. */
function matchBudget(row: CatalogueRow, range: RangeVal): boolean {
  if (row.prices.length > 0) return matchRange(row.prices, range);
  if (range.max == null) return true;
  return tiersForBudget(range.max).includes(
    (row.tier ?? "") as (typeof TIER_ORDER)[number],
  );
}

export function applyFilters(
  rows: CatalogueRow[],
  active: ActiveFilters,
): CatalogueRow[] {
  const defs = new Map(FILTER_CONFIG.map((d) => [d.key, d]));
  return rows.filter((row) =>
    Object.entries(active).every(([key, val]) => {
      const def = defs.get(key);
      if (!def) return true;
      if (key === "budget") return matchBudget(row, val as RangeVal);
      const got = ACCESSORS[key]?.(row);
      if (got === undefined) return true;
      if (def.control === "range")
        return matchRange(got as number[], val as RangeVal);
      if (def.control === "toggle") return got === true;
      if (def.control === "multiselect") {
        const want = val as string[];
        const have = got as string[];
        return want.some((w) => have.includes(w));
      }
      return (got as string[]).includes(val as string);
    }),
  );
}

// ---- dynamic facet options ------------------------------------------
export function facetOptions(
  rows: CatalogueRow[],
): Record<string, { value: string; label: string }[]> {
  const dev = new Map<string, string>();
  const tags = new Set<string>();
  const kitchens = new Set<string>();
  const units = new Set<string>();
  const tiers = new Set<string>();
  for (const r of rows) {
    if (r.developerSlug) dev.set(r.developerSlug, r.developerName ?? r.developerSlug);
    r.tags.forEach((t) => tags.add(t));
    r.kitchenTypes.forEach((k) => kitchens.add(k));
    r.unitTypes.forEach((u) => units.add(u));
    if (r.tier) tiers.add(r.tier);
  }
  return {
    developer: [...dev.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label })),
    tags: [...tags].sort().map((t) => ({
      value: t,
      label: t.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    })),
    kitchen_type: [...kitchens].map((k) => ({
      value: k,
      label: KITCHEN_LABEL[k as keyof typeof KITCHEN_LABEL] ?? k,
    })),
    unit_type: [...units].map((u) => ({
      value: u,
      label: UNIT_TYPE_LABEL[u as keyof typeof UNIT_TYPE_LABEL] ?? u,
    })),
    status: ["ready", "offplan", "mixed"].map((s) => ({
      value: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
    })),
    tier: TIER_ORDER.map((t) => ({ value: t, label: TIER_LABEL[t] })).filter(
      (o) => tiers.has(o.value),
    ),
  };
}

// ---- client-fit scoring ---------------------------------------------
const PRIORITY_TAGS: Record<PriorityKey, string[]> = {
  schools: ["schools-nearby", "gated-family"],
  yield: [],
  appreciation: ["new-launch"],
  space: ["gated-family", "nature"],
  commute: ["central"],
  lifestyle: ["golf", "waterfront", "beach", "wellness"],
  privacy: ["ultra-luxury", "prestige"],
  payment: ["new-launch"],
};

export interface Fit {
  score: number; // 0..100
  inBudget: boolean;
}

export function fitFor(
  row: CatalogueRow,
  profile: ClientProfileSnapshot | null,
): Fit | null {
  if (!profile) return null;
  let score = 0;
  let max = 0;

  // Budget-tier fit (weight 40)
  max += 40;
  const inBudget = profile.budget
    ? tiersForBudget(profile.budget).includes(
        (row.tier ?? "") as (typeof TIER_ORDER)[number],
      )
    : false;
  if (inBudget) score += 40;
  else if (profile.budget && row.tier) {
    const reach = tiersForBudget(profile.budget);
    const maxReach = Math.max(...reach.map((t) => TIER_ORDER.indexOf(t)), 0);
    const idx = TIER_ORDER.indexOf(row.tier as (typeof TIER_ORDER)[number]);
    if (idx < maxReach) score += 18; // below budget: still attainable
  }

  // Priority ↔ character alignment (weight 60, spread over active priorities)
  const strong = (Object.entries(profile.priorities) as [PriorityKey, number][])
    .filter(([, w]) => w >= 4)
    .map(([k]) => k);
  if (strong.length) {
    const per = 60 / strong.length;
    for (const k of strong) {
      max += per;
      const wanted = PRIORITY_TAGS[k] ?? [];
      const hit =
        wanted.some((t) => row.tags.includes(t)) ||
        (k === "payment" && row.status !== "ready");
      if (hit) score += per;
    }
  } else {
    max += 60;
    score += 30; // neutral when no strong priorities set
  }

  return { score: Math.round((score / max) * 100), inBudget };
}
