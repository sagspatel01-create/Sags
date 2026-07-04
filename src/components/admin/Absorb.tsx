"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { applyIngest, type ApplyResult } from "@/app/actions/ingest";
import type { IngestProposal, IngestUnit } from "@/lib/ingest";

type Phase = "idle" | "analyzing" | "review" | "applying" | "done";

export function Absorb() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<IngestProposal | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);

  async function analyze(file: File) {
    setPhase("analyzing");
    setError(null);
    setProposal(null);
    setResult(null);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (hint.trim()) fd.append("hint", hint.trim());
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraction failed.");
      setProposal(json.proposal as IngestProposal);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
      setPhase("idle");
    }
  }

  async function apply() {
    if (!proposal) return;
    setPhase("applying");
    setError(null);
    const r = await applyIngest(proposal);
    setResult(r);
    if (r.ok) setPhase("done");
    else {
      setError(r.error ?? "Apply failed.");
      setPhase("review");
    }
  }

  function patchCommunity(k: string, v: unknown) {
    setProposal((p) => (p ? { ...p, community: { ...p.community, [k]: v } } : p));
  }
  function patchUnit(i: number, k: keyof IngestUnit, v: unknown) {
    setProposal((p) => {
      if (!p) return p;
      const units = [...p.units];
      units[i] = { ...units[i], [k]: v };
      return { ...p, units };
    });
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Uploader */}
      <div className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-6">
        <p className="text-eyebrow">Source document</p>
        <p className="mt-1 text-sm text-paper-500">
          Drop a developer brochure, price list, DXB Interact export, or market
          report (PDF, image, or text). Claude reads it and proposes structured
          data — you review before anything is saved.
        </p>
        <textarea
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Optional note for the extractor — e.g. 'Phase 3 price list, villas only'"
          rows={2}
          className="mt-4 w-full rounded-lg border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none placeholder:text-paper-700 focus:border-accent-500"
        />
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*,text/*,.csv,.md"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) analyze(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={phase === "analyzing" || phase === "applying"}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {phase === "analyzing" ? "Reading document…" : "Upload & analyze"}
          </button>
          {fileName && (
            <span className="text-xs text-paper-500">{fileName}</span>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {/* Review */}
      {phase === "review" && proposal && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <p className="text-eyebrow text-accent-400">Extracted — review before saving</p>
            {proposal.source_note && (
              <span className="text-xs text-paper-500">{proposal.source_note}</span>
            )}
          </div>

          {/* Community */}
          <div className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-5">
            <p className="text-eyebrow">Community</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <TextField label="Name *" value={proposal.community.name} onChange={(v) => patchCommunity("name", v)} />
              <TextField label="Developer" value={proposal.community.developer} onChange={(v) => patchCommunity("developer", v)} />
              <SelectField label="Status" value={proposal.community.status} options={["ready", "offplan", "mixed"]} onChange={(v) => patchCommunity("status", v)} />
              <SelectField label="Positioning" value={proposal.community.positioning_tier} options={["ultra_prime", "prime", "premium", "mid", "accessible"]} onChange={(v) => patchCommunity("positioning_tier", v)} />
              <TextField label="Handover" value={proposal.community.age_or_handover} onChange={(v) => patchCommunity("age_or_handover", v)} />
              <TextField label="Total units" value={proposal.community.total_units} onChange={(v) => patchCommunity("total_units", v ? Number(v) : null)} numeric />
            </div>
            {proposal.community.description_long && (
              <p className="mt-3 rounded-lg border border-ink-600 bg-ink-900/50 p-3 text-xs leading-relaxed text-paper-300">
                {proposal.community.description_long}
              </p>
            )}
          </div>

          {/* Sub-communities */}
          {proposal.sub_communities.length > 0 && (
            <div className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-5">
              <p className="text-eyebrow">Sub-communities · {proposal.sub_communities.length}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {proposal.sub_communities.map((s, i) => (
                  <span key={i} className="rounded-full border border-ink-500 bg-ink-900 px-3 py-1 text-sm text-paper-200">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Units */}
          <div className="elevate overflow-x-auto rounded-xl border border-ink-500 bg-ink-800/50 p-5">
            <p className="text-eyebrow">Unit types · {proposal.units.length}</p>
            {proposal.units.length === 0 ? (
              <p className="mt-3 text-sm text-paper-700">No unit-level pricing found in this document.</p>
            ) : (
              <table className="mt-3 w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs text-paper-500">
                    {["Name", "Type", "Beds", "Baths", "BUA", "Plot", "Price (AED)"].map((h) => (
                      <th key={h} className="border-b border-ink-500 pb-2 pr-3 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proposal.units.map((u, i) => (
                    <tr key={i}>
                      <Cell><Inp value={u.name} onChange={(v) => patchUnit(i, "name", v)} /></Cell>
                      <Cell>
                        <select value={u.unit_type ?? "villa"} onChange={(e) => patchUnit(i, "unit_type", e.target.value)} className="rounded border border-ink-500 bg-ink-900 px-2 py-1 text-xs text-paper-100">
                          <option value="villa">villa</option>
                          <option value="townhouse">townhouse</option>
                        </select>
                      </Cell>
                      <Cell><Inp value={u.bedrooms} onChange={(v) => patchUnit(i, "bedrooms", v ? Number(v) : null)} numeric w="3rem" /></Cell>
                      <Cell><Inp value={u.bathrooms} onChange={(v) => patchUnit(i, "bathrooms", v ? Number(v) : null)} numeric w="3rem" /></Cell>
                      <Cell><Inp value={u.bua_sqft} onChange={(v) => patchUnit(i, "bua_sqft", v ? Number(v) : null)} numeric w="5rem" /></Cell>
                      <Cell><Inp value={u.plot_sqft} onChange={(v) => patchUnit(i, "plot_sqft", v ? Number(v) : null)} numeric w="5rem" /></Cell>
                      <Cell><Inp value={u.price} onChange={(v) => patchUnit(i, "price", v ? Number(v) : null)} numeric w="7rem" /></Cell>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Payment plan */}
          {proposal.payment_plan && (proposal.payment_plan.plan_type || proposal.payment_plan.construction_pct) && (
            <div className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-5">
              <p className="text-eyebrow">Payment plan</p>
              <p className="mt-2 text-sm text-paper-200">
                {proposal.payment_plan.plan_type ?? "—"}
                {proposal.payment_plan.construction_pct != null &&
                  ` · ${proposal.payment_plan.construction_pct}% during / ${proposal.payment_plan.handover_pct ?? "?"}% on handover`}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={apply} className="btn-primary text-sm">Apply to engine</button>
            <button onClick={() => { setPhase("idle"); setProposal(null); }} className="text-sm text-paper-500 hover:text-paper-200">Discard</button>
            <span className="text-xs text-paper-700">Writes live — you can refine anything afterwards in Admin.</span>
          </div>
        </div>
      )}

      {phase === "applying" && <p className="text-sm text-paper-500">Saving to the engine…</p>}

      {phase === "done" && result?.ok && (
        <div className="elevate rounded-xl border border-status-ready/40 bg-status-ready/5 p-6">
          <p className="text-eyebrow text-status-ready">Absorbed</p>
          <p className="mt-2 text-paper-100">
            Saved {result.applied?.units ?? 0} unit type{result.applied?.units === 1 ? "" : "s"}
            {result.applied?.subs ? ` across ${result.applied.subs} sub-communit${result.applied.subs === 1 ? "y" : "ies"}` : ""}
            {result.applied?.paymentPlan ? " + payment plan" : ""}.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href={`/communities/${result.communitySlug}`} className="btn-primary text-sm">View community →</Link>
            <button onClick={() => { setPhase("idle"); setProposal(null); setResult(null); setFileName(null); }} className="text-sm text-paper-500 hover:text-paper-200">Absorb another</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-ink-600 py-2 pr-3 align-middle">{children}</td>;
}
function Inp({ value, onChange, numeric, w }: { value: unknown; onChange: (v: string) => void; numeric?: boolean; w?: string }) {
  return (
    <input
      value={value == null ? "" : String(value)}
      inputMode={numeric ? "numeric" : undefined}
      onChange={(e) => onChange(numeric ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)}
      style={w ? { width: w } : undefined}
      className={`rounded border border-ink-500 bg-ink-900 px-2 py-1 text-xs text-paper-100 outline-none focus:border-accent-500 ${numeric ? "tnum" : "min-w-[9rem]"}`}
    />
  );
}
function TextField({ label, value, onChange, numeric }: { label: string; value: unknown; onChange: (v: string) => void; numeric?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-paper-500">{label}</span>
      <Inp value={value} onChange={onChange} numeric={numeric} />
    </label>
  );
}
function SelectField({ label, value, options, onChange }: { label: string; value: unknown; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-paper-500">{label}</span>
      <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500">
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
