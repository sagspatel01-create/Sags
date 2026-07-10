/**
 * Valuation estimator — our answer to Bayut's TruEstimate. Produces a price
 * ESTIMATE with a range + confidence for a specific villa/townhouse, derived
 * from real DLD comparable transactions we already hold (never invented). The
 * approach mirrors a surveyor's comparable method:
 *
 *   1. Take the DLD-registered sales in the same community, prefer the same
 *      sub-community/cluster and the same bedroom count.
 *   2. Use their median price-per-sqft as the base, times built-up area.
 *   3. Apply transparent, disclosed adjustments for condition, view and
 *      furnishing (the same levers TruEstimate names in its own disclaimer).
 *   4. Widen or tighten the range by how many comparables we actually have —
 *      that IS the confidence.
 *
 * Pure module (no DB / server-only) so it's unit-testable and callable from the
 * server action. Prices in = real DLD; adjustments = disclosed model factors.
 */
import type { TxnLite } from "@/lib/sources/dld";

export type Condition = "renovation" | "original" | "upgraded" | "high_end";
export type PropertyView = "community" | "garden" | "pool" | "boulevard" | "park" | "golf" | "lagoon" | "sea";
export type Furnishing = "unfurnished" | "partial" | "furnished";

export const CONDITION_LABEL: Record<Condition, string> = {
  renovation: "Requires renovation",
  original: "Original, well maintained",
  upgraded: "Upgraded",
  high_end: "High-end upgrade",
};
export const VIEW_LABEL: Record<PropertyView, string> = {
  community: "Community",
  garden: "Garden",
  pool: "Pool",
  boulevard: "Boulevard",
  park: "Park",
  golf: "Golf course",
  lagoon: "Lagoon / water",
  sea: "Sea",
};
export const FURNISHING_LABEL: Record<Furnishing, string> = {
  unfurnished: "Unfurnished",
  partial: "Partially furnished",
  furnished: "Fully furnished",
};

// Disclosed adjustment multipliers (relative to a plain community-view,
// original-condition, unfurnished baseline).
const CONDITION_MULT: Record<Condition, number> = { renovation: 0.92, original: 1.0, upgraded: 1.05, high_end: 1.1 };
const VIEW_MULT: Record<PropertyView, number> = {
  community: 1.0, garden: 1.0, pool: 1.02, boulevard: 1.02, park: 1.03, golf: 1.05, lagoon: 1.05, sea: 1.08,
};
const FURNISH_MULT: Record<Furnishing, number> = { unfurnished: 1.0, partial: 1.01, furnished: 1.03 };

export interface EstimateInput {
  bua_sqft: number;
  bedrooms: number | null;
  subCluster: string | null; // sub-community label to prefer for comparables
  condition: Condition;
  view: PropertyView;
  furnishing: Furnishing;
  mortgaged: boolean;
  // real DLD data for the community
  comps: TxnLite[]; // community sample transactions (newest first)
  communityPpsf: number | null; // community avg price/sqft fallback
  appreciationPct: number | null;
  grossYieldPct?: number; // indicative; default 5
}

export interface EstimateResult {
  value: number;
  low: number;
  high: number;
  basePpsf: number; // comparable price/sqft before adjustments
  adjustedPpsf: number; // effective price/sqft after adjustments
  confidence: "high" | "medium" | "low";
  compCount: number;
  compBasis: string; // human description of the comparable set used
  usedComps: TxnLite[]; // comparables driving the estimate (for the table)
  adjustments: { label: string; pct: number }[];
  appreciationPct: number | null;
  rentPerYear: number;
  grossYieldPct: number;
  cost: { dld: number; trustee: number; agency: number; total: number };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function estimate(i: EstimateInput): EstimateResult {
  const withPpsf = i.comps.filter((t) => t.pp != null && t.pp > 0);

  // Progressive comparable selection: cluster + beds → cluster → beds → community.
  const nSub = i.subCluster ? norm(i.subCluster) : null;
  const clusterMatch = (t: TxnLite) => nSub != null && t.c != null && norm(t.c).includes(nSub);
  const bedMatch = (t: TxnLite) => i.bedrooms == null || (t.b != null && Math.abs(t.b - i.bedrooms) <= 0);

  // clusterSpecific tracks whether the winning comparable set actually matched
  // the requested sub-cluster — if we fall back to community-wide comps, the
  // estimate is less unit-specific and we must NOT overclaim confidence.
  let clusterSpecific = Boolean(i.subCluster);
  let used = withPpsf.filter((t) => clusterMatch(t) && bedMatch(t));
  let basis = i.subCluster ? `${i.subCluster}, ${i.bedrooms ?? "?"}-bed sold comparables` : "";
  if (used.length < 3) {
    used = withPpsf.filter(clusterMatch);
    basis = i.subCluster ? `${i.subCluster} sold comparables (all bed counts)` : "";
  }
  if (used.length < 3) {
    clusterSpecific = false;
    used = withPpsf.filter(bedMatch);
    basis = `${i.bedrooms ?? "?"}-bed sold comparables across the community`;
  }
  if (used.length < 3) {
    clusterSpecific = false;
    used = withPpsf;
    basis = "community sold comparables";
  }

  const compCount = used.length;
  let usedCommunityPpsf = false;
  let basePpsf: number;
  if (compCount >= 3) basePpsf = median(used.map((t) => t.pp as number));
  else if (i.communityPpsf) {
    basePpsf = i.communityPpsf;
    usedCommunityPpsf = true;
    clusterSpecific = false;
    basis = "community average price/sqft (few direct comparables)";
  } else if (compCount > 0) basePpsf = median(used.map((t) => t.pp as number));
  else basePpsf = 0;

  // Confidence reflects BOTH depth AND specificity. A community-wide fallback
  // is never "high" — it isn't unit-specific enough — and a bare community
  // average is "low".
  let confidence: EstimateResult["confidence"];
  if (usedCommunityPpsf) confidence = "low";
  else if (clusterSpecific) confidence = compCount >= 8 ? "high" : compCount >= 3 ? "medium" : "low";
  else confidence = compCount >= 6 ? "medium" : "low"; // community-wide fallback caps at medium
  const spread = confidence === "high" ? 0.04 : confidence === "medium" ? 0.08 : 0.13;

  // Disclosed adjustments.
  const adjustments = [
    { label: `${CONDITION_LABEL[i.condition]}`, pct: (CONDITION_MULT[i.condition] - 1) * 100 },
    { label: `${VIEW_LABEL[i.view]} view`, pct: (VIEW_MULT[i.view] - 1) * 100 },
    { label: `${FURNISHING_LABEL[i.furnishing]}`, pct: (FURNISH_MULT[i.furnishing] - 1) * 100 },
  ];
  const mult = CONDITION_MULT[i.condition] * VIEW_MULT[i.view] * FURNISH_MULT[i.furnishing];
  const adjustedPpsf = basePpsf * mult;

  const value = Math.round((adjustedPpsf * i.bua_sqft) / 1000) * 1000;
  const low = Math.round((value * (1 - spread)) / 10000) * 10000;
  const high = Math.round((value * (1 + spread)) / 10000) * 10000;

  const grossYieldPct = i.grossYieldPct ?? 5;
  const rentPerYear = Math.round((value * (grossYieldPct / 100)) / 1000) * 1000;

  const dld = value * 0.04;
  const trustee = 4200;
  const agency = value * 0.02;
  const cost = { dld, trustee, agency, total: value + dld + trustee + agency };

  return {
    value, low, high, basePpsf, adjustedPpsf, confidence, compCount, compBasis: basis,
    usedComps: used.slice(0, 12),
    adjustments, appreciationPct: i.appreciationPct, rentPerYear, grossYieldPct, cost,
  };
}
