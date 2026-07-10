/**
 * Investment underwriting model — deterministic finance math for Dubai
 * villa/townhouse deals. Every output is derived from explicit inputs + stated
 * assumptions (shown in the report), never guessed. Claude reads these numbers
 * to give the verdict; it does not compute them.
 *
 * v2 adds: milestone-timed payment plans (construction / handover /
 * post-handover), correct off-plan cost treatment (DLD but NO brokerage
 * agency fee — that is a secondary-market cost), manual down-payment / loan
 * entry (for mortgage, all-cash, equity-release and buyout structures), and a
 * price-per-sqft view of appreciation (entry ppsf → exit ppsf). IRR is computed
 * on a MONTHLY cash-flow vector so sub-annual milestones ("5% after 10 months")
 * are timed correctly, then annualised.
 */

export type DealType = "offplan" | "ready";
/** How the equity is funded. All structures also support manual loan entry. */
export type Financing = "cash" | "mortgage" | "equity_release" | "buyout";

/** One dated payment toward the purchase price (% of price at a month offset). */
export interface PaymentMilestone {
  label: string;
  pct: number; // % of purchase price
  monthOffset: number; // months from booking (0 = at booking)
}

export interface UnderwriteInput {
  dealType: DealType;
  price: number; // AED purchase price
  bua_sqft?: number | null; // built-up area — enables price-per-sqft view + service charge
  serviceChargePerSqft?: number | null; // AED/sqft/yr

  holdingYears: number; // total hold horizon
  appreciationPct: number; // assumed annual capital growth %
  /** If set (with bua_sqft), appreciation is DERIVED from the ppsf journey
   *  instead of appreciationPct — e.g. buy at 1,700/sqft, target 2,200/sqft. */
  targetExitPricePerSqft?: number | null;
  grossYieldPct: number; // assumed gross rental yield %

  // transaction costs
  dldPct: number; // DLD transfer / Oqood registration (typ. 4) — applies to both
  agencyPct: number; // brokerage fee (typ. 2) — READY/secondary only; forced 0 for off-plan
  offplanAdminFee?: number; // Oqood admin + processing on off-plan, typ. ~AED 3,150

  // operating assumptions (net-of-all-money). Sensible Dubai defaults applied.
  vacancyPct?: number; // typ. 5
  mgmtFeePct?: number; // % of gross rent, typ. 5 (0 if self-managed)
  maintenancePct?: number; // % of price/yr reserve, typ. 0.5
  insurancePct?: number; // % of price/yr, typ. 0.1

  // off-plan payment plan
  constructionYears?: number; // until handover
  paymentPlan?: PaymentMilestone[]; // explicit milestones — used verbatim if provided
  constructionPct?: number; // else: total % paid during construction (incl. booking)
  handoverPct?: number; // else: % due at handover
  postHandoverPct?: number; // else: % paid after handover
  postHandoverYears?: number; // else: over how long, post-handover

  // ready / financed
  financing?: Financing;
  downPaymentPct?: number; // MANUAL down payment %; default 20 (ready mortgage)
  ltvPct?: number; // legacy alt to down payment; loan = price × ltv
  manualLoanAmount?: number | null; // MANUAL loan (equity release / buyout / custom)
  mortgageRatePct?: number; // annual %
  mortgageTenorYears?: number; // amortization

  stressRateDeltaPct?: number; // rate shock for the stress test, typ. +2
}

/** A resolved, dated payment used for the schedule display + cash flows. */
export interface ResolvedMilestone {
  label: string;
  pct: number;
  monthOffset: number;
  amount: number;
}

export interface UnderwriteResult {
  // entry
  transactionCosts: number;
  agencyFee: number;
  dldFee: number;
  mortgageCosts: number;
  totalAcquisition: number;
  cashInvested: number; // out-of-pocket equity deployed by exit
  loanAmount: number;
  downPayment: number;

  // price-per-sqft view
  entryPricePerSqft: number | null;
  exitPricePerSqft: number | null;
  appreciationTotalPct: number; // total over the hold
  effectiveAppreciationPct: number; // annual rate actually used

  // payment schedule (off-plan) / equity timing
  schedule: ResolvedMilestone[];

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
  unpaidToDeveloperAtExit: number;
  exitEquity: number;

  // returns (always on ACTUAL CAPITAL INVESTED)
  totalProfit: number;
  equityMultiple: number;
  roiPct: number; // total profit / cash invested
  irrPct: number | null; // true cash-flow-timed IRR (monthly vector, annualised)
  annualizedRoiPct: number; // equity-multiple CAGR
  cashOnCashPct: number | null; // (NOI − interest) / cash invested — excl. principal
  roeYear1Pct: number | null; // (NOI − interest + principal + appreciation yr1) / equity
  netYieldPct: number | null; // NOI / total acquisition

  // debt safety
  dscr: number | null; // NOI / annual debt service
  breakevenOccupancyPct: number | null; // (debt service + OpEx) / gross rent
  stressedDscr: number | null; // DSCR at rate + stress delta

  cashflows: number[]; // annual vector (t0..tN) for the chart
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
    const iPay = bal * r;
    interest += iPay;
    bal -= pmt - iPay;
  }
  return interest;
}

/** IRR of a per-period cash-flow vector via bisection on NPV. Returns the
 *  PER-PERIOD rate as a fraction. Null if it can't bracket a root. */
function periodIrr(cashflows: number[]): number | null {
  const npv = (rate: number) => cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t), 0);
  let lo = -0.9999;
  let hi = 1; // 100%/period is plenty for a monthly vector
  let flo = npv(lo);
  let fhi = npv(hi);
  if (Number.isNaN(flo) || Number.isNaN(fhi) || flo * fhi > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (Math.abs(fm) < 1e-7) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/** Annual-vector IRR (kept for backward compatibility / external callers). */
export function irr(cashflows: number[]): number | null {
  const r = periodIrr(cashflows);
  return r == null ? null : r * 100;
}

/** Build the off-plan payment schedule: explicit milestones if given, else
 *  spread the construction % across the build period (~6-month steps) with a
 *  handover slug and an optional post-handover tail. */
function buildSchedule(i: UnderwriteInput, price: number): ResolvedMilestone[] {
  if (i.paymentPlan && i.paymentPlan.length) {
    return i.paymentPlan.map((m) => ({ ...m, amount: price * (m.pct / 100) }));
  }
  const constrMonths = Math.round((i.constructionYears ?? 0) * 12);
  const constrPct = i.constructionPct ?? 100;
  const handoverPct = i.handoverPct ?? 0;
  const postPct = i.postHandoverPct ?? 0;
  const postMonths = Math.round((i.postHandoverYears ?? 0) * 12);
  const out: ResolvedMilestone[] = [];
  const steps = Math.max(1, Math.round(constrMonths / 6) || 1);
  for (let s = 0; s < steps; s++) {
    const off = Math.round((s * constrMonths) / steps);
    out.push({
      label: s === 0 ? "Booking / down payment" : `Construction (month ${off})`,
      pct: constrPct / steps,
      monthOffset: off,
      amount: price * (constrPct / steps / 100),
    });
  }
  if (handoverPct > 0) out.push({ label: "On handover", pct: handoverPct, monthOffset: constrMonths, amount: price * (handoverPct / 100) });
  if (postPct > 0 && postMonths > 0) {
    const psteps = Math.max(1, Math.round(postMonths / 12));
    for (let s = 1; s <= psteps; s++) {
      const off = constrMonths + Math.round((s * postMonths) / psteps);
      out.push({ label: `Post-handover (month ${off})`, pct: postPct / psteps, monthOffset: off, amount: price * (postPct / psteps / 100) });
    }
  }
  return out;
}

export function underwrite(i: UnderwriteInput): UnderwriteResult {
  const assumptions: string[] = [];
  const isOffplan = i.dealType === "offplan";

  // ---- transaction costs ------------------------------------------------
  // DLD/Oqood registration applies to both. Brokerage agency fee is a
  // SECONDARY-MARKET cost — off-plan bought from the developer has none.
  const dldFee = i.price * (i.dldPct / 100);
  const agencyFee = isOffplan ? 0 : i.price * (i.agencyPct / 100);
  const offplanAdminFee = isOffplan ? (i.offplanAdminFee ?? 3150) : 0;
  const transactionCosts = dldFee + agencyFee + offplanAdminFee;
  assumptions.push(
    isOffplan
      ? `Costs: ${i.dldPct}% DLD/Oqood + AED ${Math.round(offplanAdminFee).toLocaleString()} admin (no agency fee on off-plan)`
      : `Costs: ${i.dldPct}% DLD + ${i.agencyPct}% agency`,
  );

  // ---- price-per-sqft + appreciation -----------------------------------
  const entryPricePerSqft = i.bua_sqft && i.bua_sqft > 0 ? i.price / i.bua_sqft : null;
  let effectiveAppreciationPct = i.appreciationPct;
  if (i.targetExitPricePerSqft && entryPricePerSqft && i.holdingYears > 0) {
    // derive the annual rate implied by the ppsf journey
    const growth = i.targetExitPricePerSqft / entryPricePerSqft;
    effectiveAppreciationPct = (Math.pow(growth, 1 / i.holdingYears) - 1) * 100;
    assumptions.push(
      `Appreciation derived from price/sqft: ${Math.round(entryPricePerSqft).toLocaleString()} → ${Math.round(
        i.targetExitPricePerSqft,
      ).toLocaleString()} AED/sqft over ${i.holdingYears}y`,
    );
  } else {
    assumptions.push(`${i.appreciationPct}% p.a. appreciation`);
  }
  const exitValue = i.price * Math.pow(1 + effectiveAppreciationPct / 100, i.holdingYears);
  const exitPricePerSqft = entryPricePerSqft != null ? exitValue / (i.bua_sqft as number) : null;
  const appreciationTotalPct = (Math.pow(1 + effectiveAppreciationPct / 100, i.holdingYears) - 1) * 100;

  // ---- operating assumptions -------------------------------------------
  const serviceChargeRate = i.serviceChargePerSqft ?? 0;
  const annualServiceCharge = (i.bua_sqft ?? 0) * serviceChargeRate;
  const vacancyPct = i.vacancyPct ?? 5;
  const mgmtFeePct = i.mgmtFeePct ?? 5;
  const maintenancePct = i.maintenancePct ?? 0.5;
  const insurancePct = i.insurancePct ?? 0.1;

  // ---- financing (ready / financed structures) -------------------------
  const rate = i.mortgageRatePct ?? 4.5;
  const tenor = i.mortgageTenorYears ?? 25;
  const constructionYears = i.constructionYears ?? 0;
  const constrMonths = Math.round(constructionYears * 12);
  const financed = !isOffplan && (i.financing === "mortgage" || i.financing === "equity_release" || i.financing === "buyout");

  let loanAmount = 0;
  let downPayment = 0;
  let annualDebtService = 0;
  let annualInterestY1 = 0;
  let annualPrincipalY1 = 0;
  let mortgageCosts = 0;

  if (financed) {
    // Manual loan wins (equity release / buyout / custom); else down-payment %;
    // else legacy LTV; else default 20% down.
    if (i.manualLoanAmount != null) {
      loanAmount = Math.max(0, Math.min(i.manualLoanAmount, i.price));
    } else if (i.downPaymentPct != null) {
      loanAmount = i.price * (1 - i.downPaymentPct / 100);
    } else if (i.ltvPct != null) {
      loanAmount = i.price * (i.ltvPct / 100);
    } else {
      loanAmount = i.price * 0.8;
    }
    downPayment = i.price - loanAmount;
    mortgageCosts = loanAmount * 0.0025 + 290 + loanAmount * 0.01 + 3000; // reg + arrangement + valuation
    annualDebtService = amortizedPayment(loanAmount, rate, tenor) * 12;
    annualInterestY1 = firstYearInterest(loanAmount, rate, tenor);
    annualPrincipalY1 = annualDebtService - annualInterestY1;
    const label =
      i.financing === "equity_release" ? "Equity-release financing" : i.financing === "buyout" ? "Buyout financing" : "Mortgage";
    assumptions.push(
      `${label}: loan AED ${Math.round(loanAmount).toLocaleString()} (${Math.round((loanAmount / i.price) * 100)}% of price) @ ${rate}% / ${tenor}y`,
    );
  } else if (!isOffplan) {
    assumptions.push("All-cash purchase");
  }

  // ---- payment schedule (off-plan) + cash invested ---------------------
  const schedule = isOffplan ? buildSchedule(i, i.price) : [];
  const M = Math.max(1, Math.round(i.holdingYears * 12));

  let cashInvested: number;
  let unpaidToDeveloperAtExit = 0;
  if (isOffplan) {
    const paidPct = schedule.filter((m) => m.monthOffset <= M).reduce((s, m) => s + m.pct, 0);
    unpaidToDeveloperAtExit = schedule.filter((m) => m.monthOffset > M).reduce((s, m) => s + m.amount, 0);
    cashInvested = i.price * (paidPct / 100) + transactionCosts;
    const constrPct = schedule.filter((m) => m.monthOffset < constrMonths).reduce((s, m) => s + m.pct, 0);
    assumptions.push(`Payment plan: ~${Math.round(constrPct)}% during construction, balance at/after handover (${constructionYears}y build)`);
  } else if (financed) {
    cashInvested = downPayment + transactionCosts + mortgageCosts;
  } else {
    cashInvested = i.price + transactionCosts; // all cash
  }

  // ---- income (accrues once complete) ----------------------------------
  const incomeYears = isOffplan ? Math.max(0, i.holdingYears - constructionYears) : i.holdingYears;
  const annualGrossRent = i.price * (i.grossYieldPct / 100);
  const effectiveGrossRent = annualGrossRent * (1 - vacancyPct / 100);
  const annualOpEx =
    annualServiceCharge + annualGrossRent * (mgmtFeePct / 100) + i.price * (maintenancePct / 100) + i.price * (insurancePct / 100);
  const noi = effectiveGrossRent - annualOpEx;
  const annualNetCashFlow = noi - annualDebtService;
  const cumulativeNetCashFlow = annualNetCashFlow * incomeYears;
  assumptions.push(
    `${i.grossYieldPct}% gross yield less ${vacancyPct}% vacancy, ${mgmtFeePct}% mgmt, ${maintenancePct}% maintenance, ${insurancePct}% insurance`,
  );

  // ---- exit -------------------------------------------------------------
  const sellingCosts = exitValue * 0.02 + 5000; // ~2% agency on exit + NOC
  const outstandingLoanAtExit = loanAmount > 0 ? outstandingBalance(loanAmount, rate, tenor, i.holdingYears) : 0;
  const exitEquity = exitValue - sellingCosts - outstandingLoanAtExit - unpaidToDeveloperAtExit;

  // ---- returns ----------------------------------------------------------
  const totalProfit = exitEquity + cumulativeNetCashFlow - cashInvested;
  const equityMultiple = cashInvested > 0 ? (exitEquity + cumulativeNetCashFlow) / cashInvested : 0;
  const roiPct = cashInvested > 0 ? (totalProfit / cashInvested) * 100 : 0;
  const annualizedRoiPct =
    cashInvested > 0 && i.holdingYears > 0 && equityMultiple > 0 ? (Math.pow(equityMultiple, 1 / i.holdingYears) - 1) * 100 : 0;
  const cashOnCashPct = incomeYears > 0 && cashInvested > 0 ? ((noi - annualInterestY1) / cashInvested) * 100 : null;
  const appreciationY1 = i.price * (effectiveAppreciationPct / 100);
  const roeYear1Pct =
    cashInvested > 0 && !isOffplan && financed
      ? ((noi - annualInterestY1 + annualPrincipalY1 + appreciationY1) / cashInvested) * 100
      : cashInvested > 0
        ? (appreciationY1 / cashInvested) * 100
        : null;
  const netYieldPct = cashInvested > 0 ? (noi / (i.price + transactionCosts + mortgageCosts)) * 100 : null;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : null;
  const breakevenOccupancyPct = annualGrossRent > 0 ? ((annualDebtService + annualOpEx) / annualGrossRent) * 100 : null;
  const stressedDscr = loanAmount > 0 ? noi / (amortizedPayment(loanAmount, rate + (i.stressRateDeltaPct ?? 2), tenor) * 12) : null;

  // ---- monthly cash-flow vector → true IRR -----------------------------
  const cfM = new Array(M + 1).fill(0);
  const noiMonthly = noi / 12;
  const dsMonthly = annualDebtService / 12;
  if (isOffplan) {
    cfM[0] -= transactionCosts;
    for (const m of schedule) if (m.monthOffset <= M) cfM[m.monthOffset] -= m.amount;
    for (let t = constrMonths + 1; t <= M; t++) cfM[t] += noiMonthly; // rent after handover
    cfM[M] += exitValue - sellingCosts - unpaidToDeveloperAtExit;
  } else {
    cfM[0] -= cashInvested;
    for (let t = 1; t <= M; t++) cfM[t] += noiMonthly - dsMonthly;
    cfM[M] += exitEquity;
  }
  const rMonthly = periodIrr(cfM);
  const irrPct = rMonthly == null ? null : (Math.pow(1 + rMonthly, 12) - 1) * 100;

  // ---- annual vector for the chart -------------------------------------
  const years = Math.max(1, Math.round(i.holdingYears));
  const cf = new Array(years + 1).fill(0);
  for (let t = 0; t <= M; t++) {
    const yr = Math.min(years, Math.round(t / 12));
    cf[yr] += cfM[t];
  }

  return {
    transactionCosts,
    agencyFee,
    dldFee,
    mortgageCosts,
    totalAcquisition: i.price + transactionCosts + mortgageCosts,
    cashInvested,
    loanAmount,
    downPayment,
    entryPricePerSqft,
    exitPricePerSqft,
    appreciationTotalPct,
    effectiveAppreciationPct,
    schedule,
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
    unpaidToDeveloperAtExit,
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
    DSCR: r.dscr,
  };
}
