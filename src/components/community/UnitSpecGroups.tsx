import { Card, Eyebrow } from "@/components/ui/Card";
import { FactList, type Fact } from "@/components/ui/FactList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { UnitArchetype, Phase } from "@/lib/db/types";
import {
  aed,
  sqft,
  num,
  UNIT_TYPE_LABEL,
  KITCHEN_LABEL,
  FURNISHING_LABEL,
} from "@/lib/format";

function flag(v: unknown): string | null {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return null;
}

function boolLabel(v: boolean | null): string | null {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return null;
}

/**
 * A unit archetype rendered in the five categorized listing groups —
 * basics / areas / layout & features / financials / position — laid out
 * the way a Bayut/PF listing is, not a flat list.
 */
export function UnitSpecGroups({
  unit,
  phase,
}: {
  unit: UnitArchetype;
  phase?: Phase | null;
}) {
  const cfg = (unit.config_flags ?? {}) as Record<string, unknown>;

  const pricePerSqft =
    unit.price && unit.bua_sqft
      ? aed(Math.round(unit.price / unit.bua_sqft))
      : null;

  const basics: Fact[] = [
    { label: "Type", value: UNIT_TYPE_LABEL[unit.unit_type] },
    { label: "Bedrooms", value: num(unit.bedrooms) },
    { label: "Bathrooms", value: num(unit.bathrooms) },
    {
      label: "Furnishing",
      value: unit.furnishing ? FURNISHING_LABEL[unit.furnishing] : null,
    },
    {
      label: "Completion",
      value: unit.completion_status
        ? unit.completion_status.replace(/^\w/, (c) => c.toUpperCase())
        : null,
    },
  ];

  const areas: Fact[] = [
    { label: "Built-up area", value: sqft(unit.bua_sqft) },
    { label: "Plot area", value: sqft(unit.plot_sqft) },
    { label: "Internal area", value: sqft(unit.internal_sqft) },
    { label: "External area", value: sqft(unit.external_sqft) },
    { label: "Price / sqft", value: pricePerSqft },
  ];

  const layout: Fact[] = [
    {
      label: "Kitchen",
      value: unit.kitchen_type ? KITCHEN_LABEL[unit.kitchen_type] : null,
    },
    { label: "Maid's room", value: flag(cfg.maids) },
    { label: "Study", value: flag(cfg.study) },
    { label: "Storage", value: flag(cfg.storage) },
    { label: "Floors", value: num(unit.floors) },
    { label: "Parking", value: num(unit.parking_spaces) },
    { label: "View / orientation", value: unit.view_orientation },
    { label: "Pool", value: boolLabel(unit.has_pool) },
    { label: "Garden", value: boolLabel(unit.has_garden) },
    { label: "Balcony / terrace", value: boolLabel(unit.has_balcony) },
  ];

  const financials: Fact[] = [
    { label: "Price", value: aed(unit.price) },
    {
      label: "Service charge",
      value: unit.service_charge_per_sqft
        ? `${aed(unit.service_charge_per_sqft)} / sqft`
        : null,
    },
    { label: "Condition", value: unit.condition },
  ];

  const position: Fact[] = [
    { label: "Phase / release", value: phase?.phase_name ?? null },
    {
      label: "Launch price / sqft",
      value: aed(phase?.launch_price_per_sqft),
    },
    {
      label: "Current price / sqft",
      value: aed(phase?.current_price_per_sqft),
    },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-500 px-6 py-4">
        <div>
          <p className="font-display text-lg text-paper-100">
            {unit.name ?? `${UNIT_TYPE_LABEL[unit.unit_type]}`}
          </p>
          <p className="text-xs text-paper-500">
            {[
              unit.bedrooms ? `${unit.bedrooms} bed` : null,
              UNIT_TYPE_LABEL[unit.unit_type],
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {unit.completion_status && (
          <StatusBadge status={unit.completion_status} />
        )}
      </div>

      <div className="grid gap-x-10 gap-y-6 p-6 md:grid-cols-2">
        <Group title="Property basics" facts={basics} />
        <Group title="Areas" facts={areas} />
        <Group title="Layout & features" facts={layout} />
        <Group title="Financials" facts={financials} />
        <div className="md:col-span-2">
          <Group title="Position in development" facts={position} />
        </div>
      </div>
    </Card>
  );
}

function Group({ title, facts }: { title: string; facts: Fact[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <div className="mt-3">
        <FactList facts={facts} columns={1} />
      </div>
    </div>
  );
}
