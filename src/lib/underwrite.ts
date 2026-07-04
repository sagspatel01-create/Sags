/**
 * Investment underwriting model — deterministic finance math for Dubai
 * villa/townhouse deals, ready and offplan. Every output is derived from
 * explicit inputs + stated assumptions (shown in the report), never guessed.
 * Claude reads these numbers to give the investment verdict; it does not
 * compute them.
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

  // offplan
  constructionYears?: number; // until handover
  constructionPct?: number; // % paid during construction
  handoverPct?: number; // % at handover

  // ready
  financing?: Financing;
  ltvPct?: number; // loan-to-value (typ. 75)
  mortgageRatePct?: number; // annual %
  mortgageTenorYears?: number; // amortization
}

export interface UnderwriteResult {
  // entry
  transactionCosts: number;
  totalAcquisition: number;
  cashInvested: number; // out-of-pocket equity deployed
  loanAmount: number;

  // income (per year, post-handover / ready)
  annualGrossRent: number;
  annualServiceCharge: number;
  annualDebtService: number;
  annualNetCashFlow: number;
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
  annualizedRoiPct: number;
  cashOnCashPct: number | null; // annual net cash flow / cash invested (income phase)
  netYieldPct: number | null; // net operating income / price

  assumptions: string[];
}

function amortizedPayment(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function outstandingBalance(
  principal: number,
  annualRatePct: number,
  years: number,
  afterYears: number,
): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const m = Math.min(afterYears, years) * 12;
  if (principal <= 0) return 0;
  if (r === 0) return Math.max(0, principal * (1 - m / n));
  const pmt = amortizedPayment(principal, annualRatePct, years);
  const bal = principal * Math.pow(1 + r, m) - pmt * ((Math.pow(1 + r, m) - 1) / r);
  return Math.max(0, bal);
}

export function underwrite(i: UnderwriteInput): UnderwriteResult {
  const assumptions: string[] = [];
  const transactionCosts = i.price * ((i.dldPct + i.agencyPct) / 100);
  const totalAcquisition = i.price + transactionCosts;
  assumptions.push(`Transaction costs ${i.dldPct}% DLD + ${i.agencyPct}% agency`);

  const serviceChargeRate = i.serviceChargePerSqft ?? 0;
  const annualServiceCharge = (i.bua_sqft ?? 0) * serviceChargeRate;

  let loanAmount = 0;
  let annualDebtService = 0;
  let cashInvested = 0;
  const constructionYears = i.constructionYears ?? 0;

  if (i.dealType === "ready" && i.financing === "mortgage") {
    const ltv = i.ltvPct ?? 75;
    loanAmount = i.price * (ltv / 100);
    const down = i.price - loanAmount;
    cashInvested = down + transactionCosts;
    annualDebtService = amortizedPayment(loanAmount, i.mortgageRatePct ?? 4.5, i.mortgageTenorYears ?? 25) * 12;
    assumptions.push(`Mortgage ${ltv}% LTV @ ${i.mortgageRatePct ?? 4.5}% over ${i.mortgageTenorYears ?? 25}y`);
  } else if (i.dealType === "ready") {
    cashInvested = totalAcquisition; // all cash
    assumptions.push("All-cash purchase");
  } else {
    // offplan: cash deployed before exit = construction installments + costs,
    // + handover payment if the hold extends past handover.
    const constrShare = (i.constructionPct ?? 100) / 100;
    const handoverShare = (i.handoverPct ?? 0) / 100;
    const paidByExit =
      i.holdingYears >= constructionYears ? constrShare + handoverShare : constrShare;
    cashInvested = i.price * paidByExit + transactionCosts;
    assumptions.push(
      `Payment plan ${i.constructionPct ?? 100}/${i.handoverPct ?? 0} over ~${constructionYears}y to handover`,
    );
  }

  // Rental income only accrues once the unit is complete (ready now, or
  // after construction for offplan) and if held that long.
  const incomeYears =
    i.dealType === "offplan"
      ? Math.max(0, i.holdingYears - constructionYears)
      : i.holdingYears;
  const annualGrossRent = i.price * (i.grossYieldPct / 100);
  const annualNetCashFlow = annualGrossRent - annualServiceCharge - annualDebtService;
  const cumulativeNetCashFlow = annualNetCashFlow * incomeYears;
  assumptions.push(`${i.grossYieldPct}% gross yield, ${i.appreciationPct}% p.a. appreciation`);

  const exitValue = i.price * Math.pow(1 + i.appreciationPct / 100, i.holdingYears);
  const sellingCosts = exitValue * 0.02; // ~2% agency on exit
  const outstandingLoanAtExit =
    loanAmount > 0
      ? outstandingBalance(loanAmount, i.mortgageRatePct ?? 4.5, i.mortgageTenorYears ?? 25, i.holdingYears)
      : 0;
  const exitEquity = exitValue - sellingCosts - outstandingLoanAtExit;

  // Total profit = equity returned at exit + cumulative cash flow − cash in.
  const totalProfit = exitEquity + cumulativeNetCashFlow - cashInvested;
  const equityMultiple = cashInvested > 0 ? (exitEquity + cumulativeNetCashFlow) / cashInvested : 0;
  const roiPct = cashInvested > 0 ? (totalProfit / cashInvested) * 100 : 0;
  const annualizedRoiPct =
    cashInvested > 0 && i.holdingYears > 0
      ? (Math.pow(equityMultiple, 1 / i.holdingYears) - 1) * 100
      : 0;
  const cashOnCashPct =
    incomeYears > 0 && cashInvested > 0 ? (annualNetCashFlow / cashInvested) * 100 : null;
  const netYieldPct =
    i.price > 0 ? ((annualGrossRent - annualServiceCharge) / i.price) * 100 : null;

  return {
    transactionCosts,
    totalAcquisition,
    cashInvested,
    loanAmount,
    annualGrossRent,
    annualServiceCharge,
    annualDebtService,
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
    annualizedRoiPct,
    cashOnCashPct,
    netYieldPct,
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
    "ROI %": r.roiPct,
    "Annualized %": r.annualizedRoiPct,
    "Cash-on-cash %": r.cashOnCashPct,
    "Net yield %": r.netYieldPct,
  };
}
