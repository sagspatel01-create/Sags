"use client";

import { moveDealStage } from "@/app/actions/crm";
import { ALL_STAGES, STAGE_LABEL } from "@/lib/crm";
import type { CrmStage } from "@/lib/db/types";

/**
 * Inline stage picker on a pipeline card. Submits the moveDealStage server
 * action the moment the value changes — no separate save button.
 */
export function StageSelect({ dealId, stage }: { dealId: string; stage: CrmStage }) {
  return (
    <form action={moveDealStage}>
      <input type="hidden" name="id" value={dealId} />
      <select
        name="stage"
        defaultValue={stage}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input py-1 text-xs"
        aria-label="Move stage"
      >
        {ALL_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
