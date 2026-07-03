import type { BuyerType, PositioningTier } from "@/lib/db/types";

/**
 * Client-profile model shared by client and server (no server-only imports
 * here). The active profile is the thing that makes the whole tool tailor
 * itself to the person on the call.
 */

export const ACTIVE_PROFILE_COOKIE = "active_client_profile";

/** Snapshot stored for the active session (cookie) + persisted to DB. */
export interface ClientProfileSnapshot {
  id?: string;
  session_label: string;
  budget: number | null;
  financing_approach: FinancingApproach | null;
  buyer_type: BuyerType | null;
  goals: string | null;
  priorities: Record<PriorityKey, number>;
  created_at: string;
}

export type FinancingApproach = "cash" | "mortgage" | "offplan_payment_plan";

export const FINANCING_LABEL: Record<FinancingApproach, string> = {
  cash: "Cash",
  mortgage: "Mortgage",
  offplan_payment_plan: "Offplan payment plan",
};

export const BUYER_LABEL: Record<BuyerType, string> = {
  family: "Family",
  investor: "Investor",
  enduser: "End-user",
};

// ---- Priorities (weighted 0–5) --------------------------------------
export type PriorityKey =
  | "schools"
  | "yield"
  | "appreciation"
  | "space"
  | "commute"
  | "lifestyle"
  | "privacy"
  | "payment";

export const PRIORITIES: { key: PriorityKey; label: string; hint: string }[] = [
  { key: "schools", label: "Schools & education", hint: "Proximity and quality of schools" },
  { key: "yield", label: "Rental yield", hint: "Income return on capital" },
  { key: "appreciation", label: "Capital appreciation", hint: "Price growth over time" },
  { key: "space", label: "Space & plot", hint: "Built-up area and plot size" },
  { key: "commute", label: "Commute & connectivity", hint: "Access to key hubs" },
  { key: "lifestyle", label: "Lifestyle & amenities", hint: "Golf, parks, retail, dining" },
  { key: "privacy", label: "Privacy & exclusivity", hint: "Low density, prestige" },
  { key: "payment", label: "Payment flexibility", hint: "Offplan plans, staged capital" },
];

/** Sensible starting weights by buyer type (owner can adjust every slider). */
export const PRIORITY_PRESETS: Record<BuyerType, Record<PriorityKey, number>> = {
  family: { schools: 5, space: 4, commute: 4, lifestyle: 4, privacy: 3, appreciation: 2, yield: 1, payment: 2 },
  investor: { yield: 5, appreciation: 5, payment: 4, commute: 3, lifestyle: 2, space: 2, schools: 1, privacy: 2 },
  enduser: { lifestyle: 5, privacy: 4, space: 4, appreciation: 3, schools: 3, commute: 3, yield: 1, payment: 2 },
};

export const DEFAULT_PRIORITIES: Record<PriorityKey, number> = {
  schools: 3, yield: 3, appreciation: 3, space: 3, commute: 3, lifestyle: 3, privacy: 3, payment: 3,
};

// ---- Budget → positioning tier heuristic ----------------------------
// A transparent, tier-level guide (NOT a price claim) so the store can
// filter "to what's achievable" before real price data lands in Phase 2.
export const TIER_ORDER: PositioningTier[] = [
  "accessible",
  "mid",
  "premium",
  "prime",
  "ultra_prime",
];

export function tiersForBudget(budget: number | null): PositioningTier[] {
  if (!budget || budget <= 0) return [];
  if (budget >= 20_000_000) return ["ultra_prime", "prime"];
  if (budget >= 10_000_000) return ["prime", "ultra_prime", "premium"];
  if (budget >= 5_000_000) return ["premium", "prime", "mid"];
  if (budget >= 2_500_000) return ["mid", "premium", "accessible"];
  return ["accessible", "mid"];
}

/** Is a community's tier within reach of the budget (heuristic)? */
export function tierInReach(
  tier: PositioningTier | null,
  budget: number | null,
): boolean {
  if (!tier || !budget) return false;
  return tiersForBudget(budget).includes(tier);
}
