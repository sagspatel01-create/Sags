import type {
  PositioningTier,
  UnitType,
  KitchenType,
  FurnishingStatus,
} from "@/lib/db/types";

export const TIER_LABEL: Record<PositioningTier, string> = {
  ultra_prime: "Ultra-prime",
  prime: "Prime",
  premium: "Premium",
  mid: "Mid-market",
  accessible: "Accessible",
};

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  villa: "Villa",
  townhouse: "Townhouse",
};

export const KITCHEN_LABEL: Record<KitchenType, string> = {
  open: "Open",
  closed: "Closed",
  semi_open: "Semi-open",
};

export const FURNISHING_LABEL: Record<FurnishingStatus, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-furnished",
  furnished: "Furnished",
};

/** AED currency, no decimals. */
export function aed(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `AED ${new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

/** Plain grouped number. */
export function num(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("en-AE").format(value);
}

export function sqft(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `${num(value)} sqft`;
}

/** Percentage, rounded to one decimal (drops a trailing .0). */
export function pct(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const r = Math.round(value * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}%`;
}
