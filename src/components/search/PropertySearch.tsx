"use client";

import { useState } from "react";
import Link from "next/link";
import {
  parseRequirements,
  searchMatchingUnits,
  type SearchFilters,
  type UnitMatch,
} from "@/app/actions/search";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { StatusTag } from "@/lib/db/types";
import { aed, num } from "@/lib/format";

export function PropertySearch({ defaultBudget }: { defaultBudget?: number | null }) {
  const [brief, setBrief] = useState("");
  const [f, setF] = useState<SearchFilters>({ max_price: defaultBudget ?? null });
  const [parsing, setParsing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [ran, setRan] = useState(false);
  const [res, setRes] = useState<{ exact: UnitMatch[]; near: UnitMatch[] }>({ exact: [], near: [] });
  const [err, setErr] = useState<string | null>(null);

  async function parse() {
    if (!brief.trim()) return;
    setParsing(true);
    setErr(null);
    const { filters, error } = await parseRequirements(brief.trim());
    setParsing(false);
    if (filters) {
      setF({ ...filters, max_price: filters.max_price ?? f.max_price ?? null });
      await run({ ...filters, max_price: filters.max_price ?? f.max_price ?? null });
    } else setErr(error ?? "Could not read that brief.");
  }

  async function run(filters: SearchFilters) {
    setSearching(true);
    setErr(null);
    const r = await searchMatchingUnits(filters);
    setRes(r);
    setRan(true);
    setSearching(false);
  }

  return (
    <div className="space-y-5">
      {/* Natural-language brief */}
      <div className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-5">
        <p className="text-eyebrow">Describe the client&apos;s brief</p>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={2}
          placeholder="e.g. Family man, AED 6M budget, 4-bedroom villa, 3,000+ sqft BUA, 1,500+ sqft plot, gated"
          className="mt-3 w-full rounded-lg border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-paper-100 outline-none placeholder:text-paper-700 focus:border-accent-500"
        />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={parse} disabled={parsing || !brief.trim()} className="btn-primary text-sm disabled:opacity-50">
            {parsing ? "Reading brief…" : "Parse & search"}
          </button>
          <span className="text-xs text-paper-700">Claude turns the brief into the filters below — tweak anything, then search.</span>
        </div>
      </div>

      {/* Structured filters */}
      <div className="elevate grid gap-3 rounded-xl border border-ink-500 bg-ink-800/40 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Sel label="Type" value={f.unit_type ?? ""} onChange={(v) => setF({ ...f, unit_type: (v || null) as SearchFilters["unit_type"] })} options={[["", "Any"], ["villa", "Villa"], ["townhouse", "Townhouse"]]} />
        <Nf label="Min beds" value={f.min_bedrooms} onChange={(v) => setF({ ...f, min_bedrooms: v })} />
        <Nf label="Min baths" value={f.min_bathrooms} onChange={(v) => setF({ ...f, min_bathrooms: v })} />
        <Nf label="Min BUA" value={f.min_bua_sqft} onChange={(v) => setF({ ...f, min_bua_sqft: v })} />
        <Nf label="Min plot" value={f.min_plot_sqft} onChange={(v) => setF({ ...f, min_plot_sqft: v })} />
        <Nf label="Max price" value={f.max_price} onChange={(v) => setF({ ...f, max_price: v })} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => run(f)} disabled={searching} className="btn-primary text-sm disabled:opacity-50">
          {searching ? "Searching…" : "Search Dubai"}
        </button>
        {ran && !searching && (
          <span className="text-sm text-paper-500">
            {res.exact.length} exact match{res.exact.length === 1 ? "" : "es"}
            {res.near.length ? ` · ${res.near.length} close` : ""}
          </span>
        )}
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}

      {/* Results */}
      {ran && (
        <div className="space-y-6">
          {res.exact.length === 0 && res.near.length === 0 ? (
            <p className="rounded-lg border border-ink-500 bg-ink-800/50 p-4 text-sm text-paper-500">
              No priced homes match this brief yet. Coverage grows as you Absorb
              more price lists — the search runs over every unit in the engine.
            </p>
          ) : null}

          {res.exact.length > 0 && (
            <div>
              <p className="text-eyebrow text-accent-400">Matches the brief</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {res.exact.map((m) => <ResultCard key={m.id} m={m} />)}
              </div>
            </div>
          )}

          {res.near.length > 0 && (
            <div>
              <p className="text-eyebrow">Close — misses one criterion</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {res.near.map((m) => <ResultCard key={m.id} m={m} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ m }: { m: UnitMatch }) {
  return (
    <div className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/communities/${m.communitySlug}`} className="font-display text-lg leading-tight text-paper-100 hover:text-white">
            {m.communityName}
          </Link>
          <p className="mt-0.5 text-xs text-paper-500">
            {m.subName ? `${m.subName} · ` : ""}{m.developer ?? "—"} · {m.unitName ?? m.unitType}
          </p>
        </div>
        <StatusBadge status={m.status.toLowerCase() as StatusTag} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-paper-300">
        {m.bedrooms != null && <span className="tnum">{m.bedrooms} bed</span>}
        {m.bathrooms != null && <span className="tnum">{m.bathrooms} bath</span>}
        {m.bua_sqft != null && <span className="tnum">{num(m.bua_sqft)} BUA</span>}
        {m.plot_sqft != null && <span className="tnum">{num(m.plot_sqft)} plot</span>}
        {m.hasGarden && <span className="text-paper-500">Garden</span>}
        {m.hasPool && <span className="text-paper-500">Pool</span>}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-ink-600 pt-3">
        <span className="tnum text-base text-paper-100">{aed(m.price) ?? "Price on request"}</span>
        <div className="flex items-center gap-3 text-xs">
          {m.miss && (
            <span className="rounded-full border border-status-offplan/40 bg-status-offplan/10 px-2 py-0.5 text-status-offplan">
              misses {m.miss.join(", ")}
            </span>
          )}
          <Link href={`/underwrite`} className="text-accent-400 hover:text-accent-500">Underwrite →</Link>
        </div>
      </div>
    </div>
  );
}

function Nf({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-paper-500">{label}</span>
      <input
        value={value == null ? "" : String(value)}
        inputMode="numeric"
        placeholder="Any"
        onChange={(e) => {
          const s = e.target.value.replace(/[^0-9]/g, "");
          onChange(s ? Number(s) : null);
        }}
        className="tnum w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none placeholder:text-paper-700 focus:border-accent-500"
      />
    </label>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-paper-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
