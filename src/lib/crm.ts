/**
 * CRM shared vocabulary + pure helpers. No I/O — safe to import from both
 * server and client components. Labels, stage order, default probabilities,
 * and the month/forecast maths live here so the whole module agrees.
 */
import type {
  CrmStage,
  CrmProduct,
  CrmLeadSource,
  CrmChannel,
  CrmDeal,
} from "@/lib/db/types";

// ---- Labels ----------------------------------------------------------

export const STAGE_LABEL: Record<CrmStage, string> = {
  new_lead: "New lead",
  contacted: "Contacted",
  qualified: "Qualified",
  docs_collected: "Docs collected",
  submitted: "Submitted to bank",
  approved: "Approved",
  disbursed: "Disbursed",
  lost: "Lost",
  dormant: "Dormant",
};

/** The stages that form the working pipeline board, left → right. */
export const PIPELINE_STAGES: CrmStage[] = [
  "new_lead",
  "contacted",
  "qualified",
  "docs_collected",
  "submitted",
  "approved",
  "disbursed",
];

/** Off-board holding stages. */
export const PARKED_STAGES: CrmStage[] = ["lost", "dormant"];

export const ALL_STAGES: CrmStage[] = [...PIPELINE_STAGES, ...PARKED_STAGES];

export const PRODUCT_LABEL: Record<CrmProduct, string> = {
  new_purchase: "New purchase mortgage",
  handover_offplan: "Handover / off-plan mortgage",
  equity_release: "Equity release",
  buyout_transfer: "Buyout / balance transfer",
  other: "Other",
};

export const SOURCE_LABEL: Record<CrmLeadSource, string> = {
  meta_ads: "Meta ads",
  referral: "Referral",
  website: "Website",
  walk_in: "Walk-in",
  manual: "Manual",
  other: "Other",
};

export const CHANNEL_LABEL: Record<CrmChannel, string> = {
  whatsapp: "WhatsApp",
  call: "Call",
  email: "Email",
  other: "Other",
};

// ---- Probability defaults by stage ----------------------------------

/** Seed confidence when a deal enters a stage; the owner can override. */
export const STAGE_PROBABILITY: Record<CrmStage, number> = {
  new_lead: 5,
  contacted: 10,
  qualified: 25,
  docs_collected: 40,
  submitted: 60,
  approved: 85,
  disbursed: 100,
  lost: 0,
  dormant: 5,
};

/** Stages that count as an active, open deal (money still in the pipeline). */
export function isOpenStage(stage: CrmStage): boolean {
  return stage !== "disbursed" && stage !== "lost";
}

// ---- Money helpers ---------------------------------------------------

/** The amount a deal contributes toward the monthly disbursement target. */
export function dealDisbursement(deal: Pick<CrmDeal, "loan_amount" | "property_value">): number {
  return deal.loan_amount ?? deal.property_value ?? 0;
}

/** Commission — explicit if entered, else derived from loan × pct. */
export function dealCommission(
  deal: Pick<CrmDeal, "commission_amount" | "commission_pct" | "loan_amount" | "property_value">,
): number {
  if (deal.commission_amount != null) return deal.commission_amount;
  if (deal.commission_pct != null) {
    return (dealDisbursement(deal) * deal.commission_pct) / 100;
  }
  return 0;
}

/** Product display, resolving the free-text label for 'other'. */
export function productLabel(product: CrmProduct, other?: string | null): string {
  if (product === "other") return other?.trim() || "Other";
  return PRODUCT_LABEL[product];
}

// ---- Month helpers ---------------------------------------------------

/** First day of a month as YYYY-MM-01 (date column value). */
export function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** Normalise any date/`YYYY-MM`/`YYYY-MM-DD` string to a month key. */
export function toMonthKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-01`;
}

/** "August 2026" from a month key. */
export function monthLabel(monthKeyStr: string): string {
  const d = new Date(`${monthKeyStr.slice(0, 7)}-01T00:00:00`);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Short "Aug '26". */
export function monthShort(monthKeyStr: string): string {
  const d = new Date(`${monthKeyStr.slice(0, 7)}-01T00:00:00`);
  return `${d.toLocaleDateString("en-GB", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
}

/** The next `count` month keys starting from `from` (inclusive). */
export function monthRange(from: Date, count: number): string[] {
  const out: string[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = 0; i < count; i++) {
    out.push(monthKey(d));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export const DEFAULT_MONTHLY_TARGET = 10_000_000;

// ---- Pure aggregation (shared by the data layer AND the tests) -------

export type ForecastMonth = {
  month: string; // key YYYY-MM-01
  target: number;
  committed: number; // disbursed deals
  weighted: number; // open deals × probability
  gross: number; // open deals at full value (unweighted)
  commission: number; // weighted commission
  dealCount: number;
};

type ForecastInput = Pick<
  CrmDeal,
  | "stage"
  | "probability"
  | "loan_amount"
  | "property_value"
  | "commission_amount"
  | "commission_pct"
  | "close_month"
>;

/**
 * Month-by-month disbursement forecast vs target — the mortgage-specific
 * heart of the CRM. Buckets each deal by its close_month (NOT when work
 * started). Disbursed deals are committed; open deals are probability-
 * weighted. Deals with no close_month are reported separately so nothing
 * silently vanishes. Pure: same inputs → same output, no I/O.
 */
export function buildForecast(
  deals: ForecastInput[],
  targets: Map<string, number>,
  months: number,
  now: Date = new Date(),
): {
  rows: ForecastMonth[];
  undated: { count: number; gross: number; weighted: number };
  totalPipeline: number;
  totalWeighted: number;
} {
  const keys = monthRange(now, months);
  const rows: ForecastMonth[] = keys.map((month) => ({
    month,
    target: targets.get(month) ?? DEFAULT_MONTHLY_TARGET,
    committed: 0,
    weighted: 0,
    gross: 0,
    commission: 0,
    dealCount: 0,
  }));
  const byMonth = new Map(rows.map((r) => [r.month, r]));

  const undated = { count: 0, gross: 0, weighted: 0 };
  let totalPipeline = 0;
  let totalWeighted = 0;

  for (const d of deals) {
    if (d.stage === "lost") continue;
    const disb = dealDisbursement(d);
    const open = isOpenStage(d.stage);
    const weight = d.stage === "disbursed" ? 1 : d.probability / 100;
    if (open) {
      totalPipeline += disb;
      totalWeighted += disb * weight;
    }
    const mk = toMonthKey(d.close_month);
    if (!mk) {
      if (open) {
        undated.count += 1;
        undated.gross += disb;
        undated.weighted += disb * weight;
      }
      continue;
    }
    const row = byMonth.get(mk);
    if (!row) continue; // outside the visible window
    row.dealCount += 1;
    row.gross += disb;
    if (d.stage === "disbursed") {
      row.committed += disb;
      row.commission += dealCommission(d);
    } else {
      row.weighted += disb * weight;
      row.commission += dealCommission(d) * weight;
    }
  }

  return { rows, undated, totalPipeline, totalWeighted };
}

export type PipelineSummary = {
  totalContacts: number;
  openDeals: number;
  openValue: number;
  weightedValue: number;
  weightedCommission: number; // "money to be made" — prob-weighted commission across open + disbursed
  dueToday: number;
  disbursedThisMonth: number;
  commissionThisMonth: number; // committed commission landing this month
};

/** Headline pipeline stats for the CRM overview. Pure. */
export function summarizePipeline(
  deals: ForecastInput[],
  totalContacts: number,
  dueToday: number,
  now: Date = new Date(),
): PipelineSummary {
  const thisMonth = monthKey(now);
  let openDeals = 0;
  let openValue = 0;
  let weightedValue = 0;
  let weightedCommission = 0;
  let disbursedThisMonth = 0;
  let commissionThisMonth = 0;
  for (const d of deals) {
    if (d.stage === "lost") continue;
    const disb = dealDisbursement(d);
    const comm = dealCommission(d);
    if (isOpenStage(d.stage)) {
      openDeals += 1;
      openValue += disb;
      weightedValue += (disb * d.probability) / 100;
      weightedCommission += (comm * d.probability) / 100;
    } else if (d.stage === "disbursed") {
      weightedCommission += comm; // banked
    }
    if (d.stage === "disbursed" && toMonthKey(d.close_month) === thisMonth) {
      disbursedThisMonth += disb;
      commissionThisMonth += comm;
    }
  }
  return {
    totalContacts,
    openDeals,
    openValue,
    weightedValue,
    weightedCommission,
    dueToday,
    disbursedThisMonth,
    commissionThisMonth,
  };
}
