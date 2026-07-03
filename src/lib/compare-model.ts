import type { CommunityCompare } from "@/lib/data/compare";
import type { ClientProfileSnapshot, PriorityKey } from "@/lib/client-profile";
import { tiersForBudget, TIER_ORDER } from "@/lib/client-profile";
import {
  aed,
  sqft,
  num,
  pct,
  TIER_LABEL,
  UNIT_TYPE_LABEL,
  KITCHEN_LABEL,
  FURNISHING_LABEL,
} from "@/lib/format";
import type { UnitArchetype, Phase } from "@/lib/db/types";

export type BudgetFit = "in" | "above" | "below" | null;

export interface CompareColumn {
  name: string;
  slug: string;
  status: string;
  developerName: string | null;
  tierLabel: string | null;
  budgetFit: BudgetFit;
}

export interface CompareRowM {
  label: string;
  cells: (string | number | null)[];
  kind: "value" | "para";
}

export interface CompareGroupM {
  key: string;
  title: string;
  index: number;
  rows: CompareRowM[];
  highlighted: boolean;
}

export interface CompareModel {
  columns: CompareColumn[];
  groups: CompareGroupM[];
  hasProfile: boolean;
}

// ---- helpers ---------------------------------------------------------
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function allUnits(c: CommunityCompare): UnitArchetype[] {
  return c.sub_communities.flatMap((s) => s.unit_archetypes ?? []);
}
function allPhases(c: CommunityCompare): Phase[] {
  return c.sub_communities.flatMap((s) => s.phases ?? []);
}

function rangeStr(
  values: (number | null | undefined)[],
  fmt: (n: number) => string | null,
): string | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

function uniqueList<T>(
  values: (T | null | undefined)[],
  fmt: (v: T) => string,
): string | null {
  const set = new Set<string>();
  for (const v of values) if (v !== null && v !== undefined) set.add(fmt(v));
  return set.size ? [...set].join(", ") : null;
}

// ---- priority → group highlighting ----------------------------------
const PRIORITY_GROUP: Record<PriorityKey, string[]> = {
  schools: ["context"],
  yield: ["market", "financials"],
  appreciation: ["market", "projections"],
  space: ["areas", "layout"],
  commute: ["context"],
  lifestyle: ["value_drivers", "description", "who"],
  privacy: ["identity", "who"],
  payment: ["financials", "financing"],
};

function highlightedGroups(profile: ClientProfileSnapshot | null): Set<string> {
  const set = new Set<string>();
  if (!profile) return set;
  for (const [key, weight] of Object.entries(profile.priorities)) {
    if (weight >= 4) {
      for (const g of PRIORITY_GROUP[key as PriorityKey] ?? []) set.add(g);
    }
  }
  return set;
}

function budgetFit(
  tier: string | null,
  budget: number | null,
): BudgetFit {
  if (!tier || !budget) return null;
  const reach = tiersForBudget(budget);
  if (reach.length === 0) return null;
  if (reach.includes(tier as (typeof TIER_ORDER)[number])) return "in";
  const maxReach = Math.max(
    ...reach.map((t) => TIER_ORDER.indexOf(t)),
  );
  const tierIdx = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  return tierIdx > maxReach ? "above" : "below";
}

// ---- build -----------------------------------------------------------
export function buildCompareModel(
  items: CommunityCompare[],
  profile: ClientProfileSnapshot | null,
): CompareModel {
  const budget = profile?.budget ?? null;
  const hl = highlightedGroups(profile);

  const columns: CompareColumn[] = items.map((c) => ({
    name: c.name,
    slug: c.slug,
    status: cap(c.status),
    developerName: c.developer?.name ?? null,
    tierLabel: c.positioning_tier ? TIER_LABEL[c.positioning_tier] : null,
    budgetFit: budgetFit(c.positioning_tier, budget),
  }));

  // Per-community derived aggregates (computed once).
  const agg = items.map((c) => {
    const units = allUnits(c);
    const phases = allPhases(c);
    const caps = c.sub_communities.flatMap((s) => s.capital_growth ?? []);
    const rents = c.sub_communities.flatMap((s) => s.rental_data ?? []);
    const abs = c.sub_communities.flatMap((s) => s.absorption ?? []);
    return { c, units, phases, caps, rents, abs };
  });

  const row = (
    label: string,
    fn: (a: (typeof agg)[number]) => string | number | null,
    kind: "value" | "para" = "value",
  ): CompareRowM => ({ label, kind, cells: agg.map(fn) });

  const groups: CompareGroupM[] = [
    {
      key: "identity",
      title: "Identity",
      rows: [
        row("Developer", (a) => a.c.developer?.name ?? null),
        row("Status", (a) => cap(a.c.status)),
        row("Positioning", (a) =>
          a.c.positioning_tier ? TIER_LABEL[a.c.positioning_tier] : null,
        ),
        row("Age / handover", (a) => a.c.age_or_handover),
        row(
          "Sub-communities",
          (a) => a.c.sub_community_count ?? a.c.sub_communities.length,
        ),
        row("Villas", (a) => num(a.c.villa_count)),
        row("Townhouses", (a) => num(a.c.townhouse_count)),
        row("Total units", (a) => num(a.c.total_units)),
      ],
    },
    {
      key: "basics",
      title: "Property basics",
      rows: [
        row("Unit types", (a) =>
          uniqueList(a.units.map((u) => u.unit_type), (t) => UNIT_TYPE_LABEL[t]),
        ),
        row("Bedrooms", (a) => rangeStr(a.units.map((u) => u.bedrooms), (n) => `${n}`)),
        row("Bathrooms", (a) => rangeStr(a.units.map((u) => u.bathrooms), (n) => `${n}`)),
        row("Furnishing", (a) =>
          uniqueList(a.units.map((u) => u.furnishing), (f) => FURNISHING_LABEL[f]),
        ),
      ],
    },
    {
      key: "areas",
      title: "Areas",
      rows: [
        row("Built-up area", (a) => rangeStr(a.units.map((u) => u.bua_sqft), (n) => sqft(n)!)),
        row("Plot area", (a) => rangeStr(a.units.map((u) => u.plot_sqft), (n) => sqft(n)!)),
        row("Price / sqft", (a) =>
          rangeStr(
            a.units.map((u) =>
              u.price && u.bua_sqft ? Math.round(u.price / u.bua_sqft) : null,
            ),
            (n) => aed(n)!,
          ),
        ),
      ],
    },
    {
      key: "layout",
      title: "Layout & features",
      rows: [
        row("Kitchen", (a) =>
          uniqueList(a.units.map((u) => u.kitchen_type), (k) => KITCHEN_LABEL[k]),
        ),
        row("Configuration", (a) => {
          const flags = new Set<string>();
          for (const u of a.units) {
            const cfg = (u.config_flags ?? {}) as Record<string, unknown>;
            if (cfg.maids) flags.add("Maid's");
            if (cfg.study) flags.add("Study");
            if (cfg.storage) flags.add("Storage");
          }
          return flags.size ? [...flags].join(", ") : null;
        }),
        row("Floors", (a) => rangeStr(a.units.map((u) => u.floors), (n) => `${n}`)),
        row("Parking", (a) => rangeStr(a.units.map((u) => u.parking_spaces), (n) => `${n}`)),
        row("Pool / garden", (a) => {
          const f = new Set<string>();
          for (const u of a.units) {
            if (u.has_pool) f.add("Pool");
            if (u.has_garden) f.add("Garden");
          }
          return f.size ? [...f].join(", ") : null;
        }),
      ],
    },
    {
      key: "financials",
      title: "Financials",
      rows: [
        row("Price", (a) => rangeStr(a.units.map((u) => u.price), (n) => aed(n)!)),
        row("Service charge / sqft", (a) =>
          rangeStr(a.units.map((u) => u.service_charge_per_sqft), (n) => aed(n)!),
        ),
        row("Payment plans", (a) =>
          uniqueList(a.c.payment_plans.map((p) => p.plan_type), (t) => t),
        ),
      ],
    },
    {
      key: "position",
      title: "Position in development",
      rows: [
        row("Phases", (a) => (a.phases.length ? a.phases.length : null)),
        row("Launch price / sqft", (a) =>
          rangeStr(a.phases.map((p) => p.launch_price_per_sqft), (n) => aed(n)!),
        ),
        row("Current price / sqft", (a) =>
          rangeStr(a.phases.map((p) => p.current_price_per_sqft), (n) => aed(n)!),
        ),
      ],
    },
    {
      key: "market",
      title: "Market · trailing 6 months",
      rows: [
        row("Price / sqft", () => null),
        row("Transactions", () => null),
        row("Capital appreciation", (a) =>
          rangeStr(a.caps.map((g) => g.pct_change), (n) => pct(n)!),
        ),
        row("Rental yield", (a) =>
          rangeStr(a.rents.map((r) => r.gross_yield_pct), (n) => pct(n)!),
        ),
        row("Strongest unit type", () => null),
      ],
    },
    {
      key: "absorption",
      title: "Offplan absorption & momentum",
      rows: [
        row("Absorption rate", (a) =>
          rangeStr(a.abs.map((x) => x.absorption_rate), (n) => pct(n)!),
        ),
        row("Units sold / released", (a) => {
          const sold = a.abs.reduce((s, x) => s + (x.units_sold ?? 0), 0);
          const rel = a.abs.reduce((s, x) => s + (x.units_released ?? 0), 0);
          return rel ? `${num(sold)} / ${num(rel)}` : null;
        }),
        row("Sales velocity", (a) =>
          rangeStr(a.abs.map((x) => x.sales_velocity), (n) => `${num(n)}`),
        ),
        row("Launch-to-launch movement", (a) =>
          rangeStr(a.abs.map((x) => x.launch_price_movement), (n) => pct(n)!),
        ),
      ],
    },
    {
      key: "financing",
      title: "Financing scenarios",
      rows: [
        row("Payment structure", (a) =>
          uniqueList(a.c.payment_plans.map((p) => p.plan_type), (t) => t),
        ),
        row("Capital-in vs value (offplan)", () => null),
        row("Down payment + mortgage (ready)", () => null),
      ],
    },
    {
      key: "projections",
      title: "Projections & exit",
      rows: [
        row("Conservative / base / optimistic", () => null),
        row("Exit timeframe", () => null),
        row("Return vs capital deployed", () => null),
      ],
    },
    {
      key: "context",
      title: "Context",
      rows: [
        row("Commute to hubs", (a) => {
          const t = a.c.commute_times
            .filter((x) => x.minutes_driving != null)
            .map((x) => `${x.destination_name} ${x.minutes_driving}m`);
          return t.length ? t.join(" · ") : null;
        }),
        row("Schools", () => null),
        row("Malls / hospitals", () => null),
        row("Connectivity", () => null),
      ],
    },
    {
      key: "value_drivers",
      title: "Value drivers",
      rows: [
        row("Master-plan features", (a) => {
          const f = a.c.master_plan_features;
          return Array.isArray(f) && f.length
            ? (f as string[]).join(" · ")
            : null;
        }),
        row("Infrastructure catalysts", () => null),
      ],
    },
    {
      key: "who",
      title: "Who it's for",
      rows: [row("", (a) => a.c.who_its_for_base, "para")],
    },
    {
      key: "description",
      title: "Description",
      rows: [row("", (a) => a.c.description_long, "para")],
    },
  ].map((g, i) => ({ ...g, index: i + 1, highlighted: hl.has(g.key) }));

  return { columns, groups, hasProfile: Boolean(profile) };
}
