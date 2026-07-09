/**
 * Investment underwriting model — deterministic finance math for Dubai
 * villa/townhouse deals, ready and offplan. Every output is derived from
 * explicit inputs + stated assumptions (shown in the report), never guessed.
 * Claude reads these numbers to give the investment verdict; it does not
 * compute them.
 *
 * Institutional-grade metric set: true IRR (cash-flow-timed, incl. staged
 * off-plan capital), ROI, ROE, equity multiple, cash-on-cash (excl. principal),
 * NOI net of vacancy + full OpEx, DSCR, breakeven occupancy, and exit equity
 * net of the outstanding loan and selling costs. Returns are always on ACTUAL
 * CAPITAL INVESTED.
 */

export type DealType = "offplan" | "ready";
export type Financing = "cash" | "mortgage";

export interface UnderwriteInput {
  dealType: DealType;
  price: number; // AED purchase price
  bua_sqft?: number | null; // for service charge
  serviceChargePerSqft?: number | null; // AED/sqft/yr

  holdingYears: number; // total hold horizon
  appreciationPct: number; // assumed annual capital growth %
  grossYieldPct: number; // assumed gross rental yield %

  // transaction costs
  dldPct: number; // DLD transfer (typ. 4)
  agencyPct: number; // agency fee (typ. 2)

  // operating assumptions (net-of-all-money). Sensible Dubai defaults applied.
  vacancyPct?: number; // typ. 5
  mgmtFeePct?: number; // % of gross rent, typ. 5 (0 if self-managed)
  maintenancePct?: number; // % of price/yr reserve, typ. 0.5
  insurancePct?: number; // % of price/yr, typ. 0.1

  // offplan
  constructionYears?: number; // until handover
  constructionPct?: number; // % paid during construction (+ booking)
  handoverPct?: number; // % at handover

  // ready
  financing?: Financing;
  ltvPct?: number; // loan-to-value (typ. 75)
  mortgageRatePct?: number; // annual %
  mortgageTenorYears?: number; // amortization

  stressRateDeltaPct?: number; // rate shock for the stress test, typ. +2
}

export interface UnderwriteResult {
  // entry
  transactionCosts: number;
  mortgageCosts: number;
  totalAcquisition: number;
  cashInvested: number; // out-of-pocket equity deployed
  loanAmount: number;

  // income (per year, post-handover / ready)
  annualGrossRent: number;
  effectiveGrossRent: number; // after vacancy
  annualOpEx: number; // service charge + mgmt + maintenance + insurance
  annualServiceCharge: number;
  noi: number; // effective gross rent − OpEx
  annualDebtService: number;
  annualInterestY1: number;
  annualPrincipalY1: number;
  annualNetCashFlow: number; // NOI − debt service (levered cash flow)
  incomeYears: number;
  cumulativeNetCashFlow: number;

  // exit
  exitValue: number;
  sellingCosts: number;
  outstandingLoanAtExit: number;
  exitEquity: number;

  // returns
  totalProfit: number;
  equityMultiple: number; // total value returned / cash invested
  roiPct: number; // total profit / cash invested
  irrPct: number | null; // true cash-flow-timed IRR
  annualizedRoiPct: number; // equity-multiple CAGR (kept for reference)
  cashOnCashPct: number | null; // (NOI − interest) / cash invested — excl. principal
  roeYear1Pct: number | null; // (NOI − interest + principal + appreciation yr1) / equity
  netYieldPct: number | null; // NOI / total acquisition

  // debt safety
  dscr: number | null; // NOI / annual debt service
  breakevenOccupancyPct: number | null; // (debt service + OpEx) / gross rent
  stressedDscr: number | null; // DSCR at rate + stress delta

  cashflows: number[]; // annual vector used for IRR (t0..tN)
  assumptions: string[];
}

function amortizedPayment(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function outstandingBalance(principal: number, annualRatePct: number, years: number, afterYears: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const m = Math.min(afterYears, years) * 12;
  if (principal <= 0) return 0;
  if (r === 0) return Math.max(0, principal * (1 - m / n));
  const pmt = amortizedPayment(principal, annualRatePct, years);
  const bal = principal * Math.pow(1 + r, m) - pmt * ((Math.pow(1 + r, m) - 1) / r);
  return Math.max(0, bal);
}

/** Interest paid in the first 12 months (declining-balance). */
function firstYearInterest(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  if (principal <= 0) return 0;
  const pmt = amortizedPayment(principal, annualRatePct, years);
  let bal = principal;
  let interest = 0;
  for (let k = 0; k < 12; k++) {
    const i = bal * r;
    interest += i;
    bal -= pmt - i;
  }
  return interest;
}

/** IRR of an annual cash-flow vector via bisection on NPV. Null if it can't
 *  bracket a root (e.g. all-negative or all-positive flows). */
export function irr(cashflows: number[]): number | null {
  const npv = (rate: number) => cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t), 0);
  let lo = -0.9999;
  let hi = 10; // 1000%
  let flo = npv(lo);
  let fhi = npv(hi);
  if (Number.isNaN(flo) || Number.isNaN(fhi) || flo * fhi > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (Math.abs(fm) < 1e-6) return mid * 100;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return ((lo + hi) / 2) * 100;
}

export function underwrite(i: UnderwriteInput): UnderwriteResult {
  const assumptions: string[] = [];
  const transactionCosts = i.price * ((i.dldPct + i.agencyPct) / 100);
  assumptions.push(`Transaction costs ${i.dldPct}% DLD + ${i.agencyPct}% agency`);

  const serviceChargeRate = i.serviceChargePerSqft ?? 0;
  const annualServiceCharge = (i.bua_sqft ?? 0) * serviceChargeRate;

  // Operating assumptions (net-of-all-money) with Dubai-typical defaults.
  const vacancyPct = i.vacancyPct ?? 5;
  const mgmtFeePct = i.mgmtFeePct ?? 5;
  const maintenancePct = i.maintenancePct ?? 0.5;
  const insurancePct = i.insurancePct ?? 0.1;

  let loanAmount = 0;
  let annualDebtService = 0;
  let annualInterestY1 = 0;
  let annualPrincipalY1 = 0;
  let mortgageCosts = 0;
  let cashInvested = 0;
  const rate = i.mortgageRatePct ?? 4.5;
  const tenor = i.mortgageTenorYears ?? 25;
  const constructionYears = i.constructionYears ?? 0;

  if (i.dealType === "ready" && i.financing === "mortgage") {
    const ltv = i.ltvPct ?? 75;
    loanAmount = i.price * (ltv / 100);
    const down = i.price - loanAmount;
    // Mortgage acquisition costs: registration 0.25% of loan + AED 290,
    // bank arrangement ~1% of loan, valuation ~AED 3,000.
    mortgageCosts = loanAmount * 0.0025 + 290 + loanAmount * 0.01 + 3000;
    cashInvested = down + transactionCosts + mortgageCosts;
    annualDebtService = amortizedPayment(loanAmount, rate, tenor) * 12;
    annualInterestY1 = firstYearInterest(loanAmount, rate, tenor);
    annualPrincipalY1 = annualDebtService - annualInterestY1;
    assumptions.push(`Mortgage ${ltv}% LTV @ ${rate}% over ${tenor}y (+reg/arrangement/valuation)`);
  } else if (i.dealType === "ready") {
    cashInvested = i.price + transactionCosts; // all cash
    assumptions.push("All-cash purchase");
  } else {
    const constrShare = (i.constructionPct ?? 100) / 100;
    const handoverShare = (i.handoverPct ?? 0) / 100;
    const paidByExit = i.holdingYears >= constructionYears ? constrShare + handoverShare : constrShare;
    cashInvested = i.price * paidByExit + transactionCosts;
    assumptions.push(`Payment plan ${i.constructionPct ?? 100}/${i.handoverPct ?? 0} over ~${constructionYears}y to handover`);
  }

  // Rental income only accrues once complete (ready now / after construction).
  const incomeYears = i.dealType === "offplan" ? Math.max(0, i.holdingYears - constructionYears) : i.holdingYears;
  const annualGrossRent = i.price * (i.grossYieldPct / 100);
  const effectiveGrossRent = annualGrossRent * (1 - vacancyPct / 100);
  const annualOpEx =
    annualServiceCharge +
    annualGrossRent * (mgmtFeePct / 100) +
    i.price * (maintenancePct / 100) +
    i.price * (insurancePct / 100);
  const noi = effectiveGrossRent - annualOpEx;
  const annualNetCashFlow = noi - annualDebtService;
  const cumulativeNetCashFlow = annualNetCashFlow * incomeYears;
  assumptions.push(
    `${i.grossYieldPct}% gross yield less ${vacancyPct}% vacancy, ${mgmtFeePct}% mgmt, ${maintenancePct}% maint, ${insurancePct}% insurance`,
  );
  assumptions.push(`${i.appreciationPct}% p.a. appreciation`);

  const exitValue = i.price * Math.pow(1 + i.appreciationPct / 100, i.holdingYears);
  const sellingCosts = exitValue * 0.02 + 5000; // ~2% agency on exit + NOC
  const outstandingLoanAtExit = loanAmount > 0 ? outstandingBalance(loanAmount, rate, tenor, i.holdingYears) : 0;
  const exitEquity = exitValue - sellingCosts - outstandingLoanAtExit;

  const totalProfit = exitEquity + cumulativeNetCashFlow - cashInvested;
  const equityMultiple = cashInvested > 0 ? (exitEquity + cumulativeNetCashFlow) / cashInvested : 0;
  const roiPct = cashInvested > 0 ? (totalProfit / cashInvested) * 100 : 0;
  const annualizedRoiPct =
    cashInvested > 0 && i.holdingYears > 0 && equityMultiple > 0 ? (Math.pow(equityMultiple, 1 / i.holdingYears) - 1) * 100 : 0;

  // Cash-on-cash excludes principal paydown (that is equity build, not cash lost).
  const cashOnCashPct = incomeYears > 0 && cashInvested > 0 ? ((noi - annualInterestY1) / cashInvested) * 100 : null;
  // ROE year 1 = total return on equity: net cash + principal build + appreciation.
  const appreciationY1 = i.price * (i.appreciationPct / 100);
  const roeYear1Pct =
    cashInvested > 0 && i.dealType === "ready"
      ? ((noi - annualInterestY1 + annualPrincipalY1 + appreciationY1) / cashInvested) * 100
      : cashInvested > 0
        ? (appreciationY1 / cashInvested) * 100
        : null;
  const netYieldPct = cashInvested > 0 ? (noi / (i.price + transactionCosts + mortgageCosts)) * 100 : null;

  const dscr = annualDebtService > 0 ? noi / annualDebtService : null;
  const breakevenOccupancyPct = annualGrossRent > 0 ? ((annualDebtService + annualOpEx) / annualGrossRent) * 100 : null;
  const stressedDscr =
    loanAmount > 0
      ? noi / (amortizedPayment(loanAmount, rate + (i.stressRateDeltaPct ?? 2), tenor) * 12)
      : null;

  // ---- annual cash-flow vector for true IRR --------------------------
  const years = Math.max(1, Math.round(i.holdingYears));
  const cf = new Array(years + 1).fill(0);
  if (i.dealType === "offplan") {
    const constrShare = (i.constructionPct ?? 100) / 100;
    const handoverShare = (i.handoverPct ?? 0) / 100;
    cf[0] -= transactionCosts;
    const constrPeriods = Math.max(1, Math.round(constructionYears));
    const perYear = (i.price * constrShare) / constrPeriods;
    for (let t = 0; t < constrPeriods && t <= years; t++) cf[t] -= perYear;
    const heldToHandover = i.holdingYears >= constructionYears;
    if (heldToHandover) cf[Math.min(constrPeriods, years)] -= i.price * handoverShare;
    for (let t = constrPeriods + 1; t <= years; t++) cf[t] += noi;
    // exit
    if (heldToHandover) {
      cf[years] += exitValue - sellingCosts;
    } else {
      // pre-handover assignment: buyer assumes the unpaid balance.
      const paidShare = Math.min(constrShare, (perYear * (years + 1)) / i.price);
      const remainingToBuilder = i.price * (constrShare + handoverShare) - i.price * paidShare;
      cf[years] += exitValue - sellingCosts - remainingToBuilder;
    }
  } else {
    cf[0] -= cashInvested;
    for (let t = 1; t <= years; t++) cf[t] += annualNetCashFlow;
    cf[years] += exitEquity;
  }
  const irrPct = irr(cf);

  return {
    transactionCosts,
    mortgageCosts,
    totalAcquisition: i.price + transactionCosts + mortgageCosts,
    cashInvested,
    loanAmount,
    annualGrossRent,
    effectiveGrossRent,
    annualOpEx,
    annualServiceCharge,
    noi,
    annualDebtService,
    annualInterestY1,
    annualPrincipalY1,
    annualNetCashFlow,
    incomeYears,
    cumulativeNetCashFlow,
    exitValue,
    sellingCosts,
    outstandingLoanAtExit,
    exitEquity,
    totalProfit,
    equityMultiple,
    roiPct,
    irrPct,
    annualizedRoiPct,
    cashOnCashPct,
    roeYear1Pct,
    netYieldPct,
    dscr,
    breakevenOccupancyPct,
    stressedDscr,
    cashflows: cf,
    assumptions,
  };
}

/** A compact scorecard the UI and Claude both read. */
export function scorecard(r: UnderwriteResult) {
  return {
    "Cash invested": r.cashInvested,
    "Projected exit value": r.exitValue,
    "Total profit": r.totalProfit,
    "Equity multiple": r.equityMultiple,
    "IRR %": r.irrPct,
    "ROI %": r.roiPct,
    "Cash-on-cash %": r.cashOnCashPct,
    "ROE yr1 %": r.roeYear1Pct,
    "Net yield %": r.netYieldPct,
    "DSCR": r.dscr,
  };
}
