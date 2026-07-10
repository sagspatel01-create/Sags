"use server";

import { getEstimateSources } from "@/lib/data/estimate";
import { estimate, type EstimateResult, type Condition, type PropertyView, type Furnishing } from "@/lib/estimate";
import type { TxnLite, TrendPoint } from "@/lib/sources/dld";

export interface EstimateReport extends EstimateResult {
  communityName: string;
  subCluster: string | null;
  bedrooms: number | null;
  bua_sqft: number;
  mortgaged: boolean;
  trend: TrendPoint[];
  allTxns: TxnLite[]; // full community set (for "last transactions")
}

export interface EstimateParams {
  communitySlug: string;
  subCluster: string | null;
  bedrooms: number | null;
  bua_sqft: number;
  condition: Condition;
  view: PropertyView;
  furnishing: Furnishing;
  mortgaged: boolean;
}

/**
 * Run a comparable-based valuation for a specific unit, from the community's
 * real DLD transactions. Returns the full report or an error string. Never
 * invents prices — if a community holds no DLD data, it says so.
 */
export async function runEstimate(
  p: EstimateParams,
): Promise<{ report: EstimateReport | null; error?: string }> {
  if (!p.bua_sqft || p.bua_sqft <= 0) return { report: null, error: "Enter the built-up area (sqft)." };

  const src = await getEstimateSources(p.communitySlug);
  if (!src) return { report: null, error: "Community not found." };
  if (!src.txns.length && src.communityPpsf == null) {
    return {
      report: null,
      error: `No DLD transaction data held for ${src.communityName} yet — a valuation needs real comparables, and this engine never assumes a price.`,
    };
  }

  const r = estimate({
    bua_sqft: p.bua_sqft,
    bedrooms: p.bedrooms,
    subCluster: p.subCluster,
    condition: p.condition,
    view: p.view,
    furnishing: p.furnishing,
    mortgaged: p.mortgaged,
    comps: src.txns,
    communityPpsf: src.communityPpsf,
    appreciationPct: src.appreciationPct,
  });

  return {
    report: {
      ...r,
      communityName: src.communityName,
      subCluster: p.subCluster,
      bedrooms: p.bedrooms,
      bua_sqft: p.bua_sqft,
      mortgaged: p.mortgaged,
      trend: src.trend,
      allTxns: src.txns,
    },
  };
}
