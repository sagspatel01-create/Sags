"use client";

import { useState } from "react";
import { createProfile } from "@/app/(app)/client/actions";
import {
  PRIORITIES,
  PRIORITY_PRESETS,
  DEFAULT_PRIORITIES,
  FINANCING_LABEL,
  BUYER_LABEL,
  type PriorityKey,
  type FinancingApproach,
} from "@/lib/client-profile";
import type { BuyerType } from "@/lib/db/types";
import type { ClientProfileSnapshot } from "@/lib/client-profile";

const BUYERS: BuyerType[] = ["family", "investor", "enduser"];
const FINANCING: FinancingApproach[] = ["cash", "mortgage", "offplan_payment_plan"];
const BUDGET_CHIPS = [2_500_000, 5_000_000, 10_000_000, 20_000_000];

export function IntakeForm({ initial }: { initial?: ClientProfileSnapshot | null }) {
  const [label, setLabel] = useState(initial?.session_label ?? "");
  const [budget, setBudget] = useState<string>(
    initial?.budget ? String(initial.budget) : "",
  );
  const [financing, setFinancing] = useState<FinancingApproach | "">(
    initial?.financing_approach ?? "",
  );
  const [buyer, setBuyer] = useState<BuyerType | "">(initial?.buyer_type ?? "");
  const [goals, setGoals] = useState(initial?.goals ?? "");
  const [priorities, setPriorities] = useState<Record<PriorityKey, number>>(
    initial?.priorities ?? DEFAULT_PRIORITIES,
  );

  function chooseBuyer(b: BuyerType) {
    setBuyer(b);
    // Apply the preset weighting as a starting point (owner can adjust).
    setPriorities(PRIORITY_PRESETS[b]);
  }

  return (
    <form action={createProfile} className="space-y-8">
      {/* Session label */}
      <Field label="Session label" hint="Your name for this call">
        <input
          name="session_label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Al Futtaim family — Sat call"
          className="input"
        />
      </Field>

      {/* Budget */}
      <Field label="Budget" hint="Total budget in AED">
        <input
          name="budget"
          inputMode="numeric"
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="e.g. 8000000"
          className="input font-mono"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {BUDGET_CHIPS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBudget(String(b))}
              className="chip"
            >
              AED {(b / 1_000_000).toFixed(1).replace(/\.0$/, "")}M
            </button>
          ))}
        </div>
      </Field>

      {/* Buyer type */}
      <Field label="Buyer type" hint="Sets a starting weighting below">
        <div className="flex flex-wrap gap-2">
          {BUYERS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => chooseBuyer(b)}
              className={`seg ${buyer === b ? "seg-on" : ""}`}
            >
              {BUYER_LABEL[b]}
            </button>
          ))}
        </div>
        <input type="hidden" name="buyer_type" value={buyer} />
      </Field>

      {/* Financing */}
      <Field label="Financing approach">
        <div className="flex flex-wrap gap-2">
          {FINANCING.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFinancing(f)}
              className={`seg ${financing === f ? "seg-on" : ""}`}
            >
              {FINANCING_LABEL[f]}
            </button>
          ))}
        </div>
        <input type="hidden" name="financing_approach" value={financing} />
      </Field>

      {/* Goals */}
      <Field label="Goals & context" hint="What matters to this client, in their words">
        <textarea
          name="goals"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={3}
          placeholder="e.g. Relocating from London, two children starting school in September, wants a turnkey villa near good schools with strong resale."
          className="input resize-none"
        />
      </Field>

      {/* Priorities */}
      <div>
        <p className="text-eyebrow">Priorities</p>
        <p className="mt-1 text-sm text-paper-500">
          Weight what matters (0–5). These drive tailoring and the fit signals
          across the tool.
        </p>
        <div className="mt-4 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {PRIORITIES.map((p) => (
            <div key={p.key}>
              <div className="flex items-baseline justify-between">
                <label className="text-sm text-paper-200">{p.label}</label>
                <span className="font-mono text-sm text-accent-400">
                  {priorities[p.key]}
                </span>
              </div>
              <input
                type="range"
                name={`priority_${p.key}`}
                min={0}
                max={5}
                step={1}
                value={priorities[p.key]}
                onChange={(e) =>
                  setPriorities((prev) => ({
                    ...prev,
                    [p.key]: Number(e.target.value),
                  }))
                }
                className="range mt-2"
              />
              <p className="mt-1 text-xs text-paper-700">{p.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-ink-500 pt-6">
        <button type="submit" className="btn-primary">
          {initial ? "Update session profile" : "Start session"}
        </button>
        <span className="text-xs text-paper-700">
          Stored for this session and used to tailor the experience.
        </span>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <label className="text-sm font-medium text-paper-100">{label}</label>
        {hint && <span className="ml-2 text-xs text-paper-700">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
