import { createClient } from "@/lib/supabase/server";
import { underwrite } from "@/lib/underwrite";

/**
 * Investor screener — ranks every community that has real DLD market data by a
 * like-for-like indicative underwrite. The entry price and recent appreciation
 * are each community's OWN sourced figures; the operating/financing assumptions
 * are held IDENTICAL across all communities (disclosed below) so the ranking is
 * a fair comparison, not a black box. No prices are invented — a community with
 * no DLD data simply doesn't appear.
 */

// Disclosed, held-constant assumptions for the comparison underwrite.
export const SCREENER_ASSUMPTIONS = {
  holdingYears: 5,
  grossYieldPct: 5, // standard Dubai villa/TH gross yield
  ltvPct: 75,
  mortgageRatePct: 4.5,
  mortgageTenorYears: 25,
  dldPct: 4,
  agencyPct: 2,
  vacancyPct: 5,
  mgmtFeePct: 5,
  maintenancePct: 0.5,
  insurancePct: 0.1,
  stressRateDeltaPct: 2,
  // Recent-trend appreciation is clamped to a defensible band so a noisy
  // short-window sample can't annualise to an absurd figure.
  apprMinPct: -10,
  apprMaxPct: 20,
};

export interface ScreenerRow {
  slug: string;
  name: string;
  developer: string | null;
  status: string;
  medianPrice: number | null;
  pricePerSqft: number | null;
  txnCount: number; // liquidity proxy (6-mo DLD sales)
  appreciationPct: number | null; // recent DLD trend (annual, clamped in model)
  // indicative underwrite outputs (identical assumptions across all rows)
  irrPct: number | null;
  netYieldPct: number | null;
  dscr: number | null;
  equityMultiple: number | null;
  cashInvested: number | null;
  // 0–100 composite (see scoring below)
  score: number;
}

type Raw = {
  community_id: string;
  source: string;
  median_price: number | null;
  avg_price_per_sqft: number | null;
  txn_count: number | null;
  appreciation_pct: number | null;
  community:
    | { name: string; slug: string; status: string; developer: { name: string } | { name: string }[] | null }
    | Array<{ name: string; slug: string; status: string; developer: { name: string } | { name: string }[] | null }>
    | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export async function getScreenerRows(): Promise<ScreenerRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  // market_snapshots isn't in the generated Database types yet (added post-
  // codegen); cast the builder as the other callers do.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("market_snapshots")
    .select(
      `community_id, source, median_price, avg_price_per_sqft, txn_count, appreciation_pct,
       community:communities(name, slug, status, developer:developers(name))`,
    )
    .in("source", ["dld", "dld-detail"]);
  if (error || !data) return [];

  // Fold every snapshot into one record per community. dld-detail (community
  // level, carries the trend) wins for appreciation/median; dld aggregates
  // (per unit-type) contribute liquidity and a price-per-sqft fallback.
  type Acc = {
    name: string; slug: string; status: string; developer: string | null;
    detailMedian: number | null; detailAppr: number | null; detailTxn: number;
    aggTxn: number; aggPpsfSum: number; aggPpsfN: number; aggMedianSum: number; aggMedianN: number;
  };
  const byId = new Map<string, Acc>();

  for (const r of data as unknown as Raw[]) {
    const c = Array.isArray(r.community) ? r.community[0] : r.community;
    if (!c) continue;
    const dev = Array.isArray(c.developer) ? c.developer[0] : c.developer;
    let a = byId.get(r.community_id);
    if (!a) {
      a = {
        name: c.name, slug: c.slug, status: c.status, developer: dev?.name ?? null,
        detailMedian: null, detailAppr: null, detailTxn: 0,
        aggTxn: 0, aggPpsfSum: 0, aggPpsfN: 0, aggMedianSum: 0, aggMedianN: 0,
      };
      byId.set(r.community_id, a);
    }
    const median = r.median_price != null ? Number(r.median_price) : null;
    const ppsf = r.avg_price_per_sqft != null ? Number(r.avg_price_per_sqft) : null;
    const txn = r.txn_count != null ? Number(r.txn_count) : 0;
    if (r.source === "dld-detail") {
      a.detailMedian = median;
      a.detailAppr = r.appreciation_pct != null ? Number(r.appreciation_pct) : null;
      a.detailTxn = txn;
    } else {
      a.aggTxn += txn;
      if (ppsf != null) { a.aggPpsfSum += ppsf; a.aggPpsfN++; }
      if (median != null) { a.aggMedianSum += median; a.aggMedianN++; }
    }
  }

  // Build rows + run the identical-assumption underwrite on each.
  const A = SCREENER_ASSUMPTIONS;
  const rows: ScreenerRow[] = [];
  for (const a of byId.values()) {
    const medianPrice = a.detailMedian ?? (a.aggMedianN ? a.aggMedianSum / a.aggMedianN : null);
    const pricePerSqft = a.aggPpsfN ? a.aggPpsfSum / a.aggPpsfN : null;
    const txnCount = a.detailTxn || a.aggTxn;
    const appreciationPct = a.detailAppr;

    let irrPct: number | null = null, netYieldPct: number | null = null;
    let dscr: number | null = null, equityMultiple: number | null = null, cashInvested: number | null = null;
    if (medianPrice && medianPrice > 0) {
      const u = underwrite({
        dealType: "ready",
        price: medianPrice,
        bua_sqft: null,
        holdingYears: A.holdingYears,
        appreciationPct: clamp(appreciationPct ?? 0, A.apprMinPct, A.apprMaxPct),
        grossYieldPct: A.grossYieldPct,
        dldPct: A.dldPct,
        agencyPct: A.agencyPct,
        vacancyPct: A.vacancyPct,
        mgmtFeePct: A.mgmtFeePct,
        maintenancePct: A.maintenancePct,
        insurancePct: A.insurancePct,
        financing: "mortgage",
        ltvPct: A.ltvPct,
        mortgageRatePct: A.mortgageRatePct,
        mortgageTenorYears: A.mortgageTenorYears,
        stressRateDeltaPct: A.stressRateDeltaPct,
      });
      irrPct = u.irrPct;
      netYieldPct = u.netYieldPct;
      dscr = u.dscr;
      equityMultiple = u.equityMultiple;
      cashInvested = u.cashInvested;
    }

    rows.push({
      slug: a.slug, name: a.name, developer: a.developer, status: a.status,
      medianPrice, pricePerSqft, txnCount, appreciationPct,
      irrPct, netYieldPct, dscr, equityMultiple, cashInvested, score: 0,
    });
  }

  // Composite score (0–100): 60% indicative return (IRR percentile) + 40%
  // liquidity (txn-count percentile). Both disclosed on the page.
  const withIrr = rows.filter((r) => r.irrPct != null);
  const irrs = withIrr.map((r) => r.irrPct as number).sort((x, y) => x - y);
  const txns = rows.map((r) => r.txnCount).sort((x, y) => x - y);
  const pct = (arr: number[], v: number) => {
    if (arr.length === 0) return 0;
    let below = 0;
    for (const a of arr) if (a < v) below++;
    return (below / arr.length) * 100;
  };
  for (const r of rows) {
    const rp = r.irrPct != null ? pct(irrs, r.irrPct) : 0;
    const lp = pct(txns, r.txnCount);
    r.score = Math.round(0.6 * rp + 0.4 * lp);
  }

  rows.sort((a, b) => b.score - a.score);
  return rows;
}
