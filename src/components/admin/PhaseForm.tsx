import { upsertPhase, deletePhase } from "@/app/actions/admin";
import { Field, Select, STATUS_OPTIONS } from "./fields";
import type { Phase } from "@/lib/db/types";

export function PhaseForm({
  subId,
  phase,
}: {
  subId: string;
  phase?: Phase;
}) {
  return (
    <div className="rounded-lg border border-ink-500 bg-ink-800/40 p-4">
      <form action={upsertPhase.bind(null, subId)} className="space-y-3">
        {phase && <input type="hidden" name="id" value={phase.id} />}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Phase name" name="phase_name" defaultValue={phase?.phase_name} />
          <Select label="Status" name="status" defaultValue={phase?.status ?? "offplan"} options={STATUS_OPTIONS} />
          <Field label="Launch date" name="launch_date" type="date" defaultValue={phase?.launch_date} />
          <Field label="Launch price / sqft" name="launch_price_per_sqft" type="number" defaultValue={phase?.launch_price_per_sqft} />
          <Field label="Current price / sqft" name="current_price_per_sqft" type="number" defaultValue={phase?.current_price_per_sqft} />
          <Field label="Units in phase" name="units_in_phase" type="number" defaultValue={phase?.units_in_phase} />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary text-xs">
            {phase ? "Save phase" : "Add phase"}
          </button>
        </div>
      </form>
      {phase && (
        <form action={deletePhase.bind(null, subId, phase.id)} className="mt-2">
          <button type="submit" className="text-xs text-red-400/80 hover:text-red-400">
            Delete phase
          </button>
        </form>
      )}
    </div>
  );
}
