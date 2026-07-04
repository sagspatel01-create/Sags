import { upsertUnit, deleteUnit } from "@/app/actions/admin";
import {
  Field,
  Select,
  Checkbox,
  STATUS_OPTIONS,
  UNIT_OPTIONS,
  KITCHEN_OPTIONS,
  FURNISH_OPTIONS,
} from "./fields";
import type { UnitArchetype, Phase } from "@/lib/db/types";

export function UnitForm({
  subId,
  unit,
  phases,
}: {
  subId: string;
  unit?: UnitArchetype;
  phases: Phase[];
}) {
  const cfg = (unit?.config_flags ?? {}) as Record<string, boolean>;
  const phaseOptions = phases.map((p) => ({ value: p.id, label: p.phase_name }));
  return (
    <div className="rounded-lg border border-ink-500 bg-ink-800/40 p-4">
      <form action={upsertUnit.bind(null, subId)} className="space-y-4">
        {unit && <input type="hidden" name="id" value={unit.id} />}

        <p className="text-eyebrow">Basics</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" name="name" defaultValue={unit?.name} placeholder="e.g. Type E5 · 5BR" />
          <Select label="Type" name="unit_type" defaultValue={unit?.unit_type ?? "villa"} options={UNIT_OPTIONS} />
          <Select label="Phase" name="phase_id" defaultValue={unit?.phase_id} options={phaseOptions} allowEmpty />
          <Field label="Bedrooms" name="bedrooms" type="number" defaultValue={unit?.bedrooms} />
          <Field label="Bathrooms" name="bathrooms" type="number" defaultValue={unit?.bathrooms} />
          <Select label="Furnishing" name="furnishing" defaultValue={unit?.furnishing} options={FURNISH_OPTIONS} allowEmpty />
          <Select label="Completion" name="completion_status" defaultValue={unit?.completion_status} options={STATUS_OPTIONS} allowEmpty />
        </div>

        <p className="text-eyebrow">Areas</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="BUA (sqft)" name="bua_sqft" type="number" defaultValue={unit?.bua_sqft} />
          <Field label="Plot (sqft)" name="plot_sqft" type="number" defaultValue={unit?.plot_sqft} />
          <Field label="Internal (sqft)" name="internal_sqft" type="number" defaultValue={unit?.internal_sqft} />
          <Field label="External (sqft)" name="external_sqft" type="number" defaultValue={unit?.external_sqft} />
        </div>

        <p className="text-eyebrow">Layout & features</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Kitchen" name="kitchen_type" defaultValue={unit?.kitchen_type} options={KITCHEN_OPTIONS} allowEmpty />
          <Field label="Floors" name="floors" type="number" defaultValue={unit?.floors} />
          <Field label="Parking" name="parking_spaces" type="number" defaultValue={unit?.parking_spaces} />
          <Field label="View / orientation" name="view_orientation" defaultValue={unit?.view_orientation} />
        </div>
        <div className="flex flex-wrap gap-4">
          <Checkbox label="Maid's" name="cfg_maids" defaultChecked={cfg.maids} />
          <Checkbox label="Study" name="cfg_study" defaultChecked={cfg.study} />
          <Checkbox label="Storage" name="cfg_storage" defaultChecked={cfg.storage} />
          <Checkbox label="Pool" name="has_pool" defaultChecked={unit?.has_pool ?? false} />
          <Checkbox label="Garden" name="has_garden" defaultChecked={unit?.has_garden ?? false} />
          <Checkbox label="Balcony" name="has_balcony" defaultChecked={unit?.has_balcony ?? false} />
        </div>

        <p className="text-eyebrow">Financials</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Price (AED)" name="price" type="number" defaultValue={unit?.price} />
          <Field label="Service charge (AED/sqft)" name="service_charge_per_sqft" type="number" defaultValue={unit?.service_charge_per_sqft} />
          <Field label="Condition" name="condition" defaultValue={unit?.condition} />
        </div>

        <button type="submit" className="btn-primary text-xs">
          {unit ? "Save unit" : "Add unit archetype"}
        </button>
      </form>
      {unit && (
        <form action={deleteUnit.bind(null, subId, unit.id)} className="mt-2">
          <button type="submit" className="text-xs text-red-400/80 hover:text-red-400">
            Delete unit
          </button>
        </form>
      )}
    </div>
  );
}
