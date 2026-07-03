"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FILTER_CONFIG,
  type ActiveFilters,
  type RangeVal,
} from "@/lib/filters";

type Facets = Record<string, { value: string; label: string }[]>;

// Filters that read as a single "maximum" rather than a min–max band.
const MAX_ONLY = new Set(["budget", "commute"]);

export function FilterBar({
  active,
  facets,
  sort,
  resultCount,
  totalCount,
  clientLabel,
  clientBudget,
}: {
  active: ActiveFilters;
  facets: Facets;
  sort: string;
  resultCount: number;
  totalCount: number;
  clientLabel: string | null;
  clientBudget: number | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActiveFilters>(active);
  const [sortState, setSortState] = useState(sort);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, typeof FILTER_CONFIG>();
    for (const d of FILTER_CONFIG) {
      const arr = m.get(d.group) ?? [];
      arr.push(d);
      m.set(d.group, arr);
    }
    return [...m.entries()];
  }, []);

  function buildQuery(next: ActiveFilters, nextSort: string): string {
    const p = new URLSearchParams();
    for (const def of FILTER_CONFIG) {
      const v = next[def.key];
      if (v === undefined) continue;
      if (def.control === "range") {
        const r = v as RangeVal;
        if (r.min !== undefined) p.set(`${def.key}_min`, String(r.min));
        if (r.max !== undefined) p.set(`${def.key}_max`, String(r.max));
      } else if (def.control === "multiselect") {
        const arr = v as string[];
        if (arr.length) p.set(def.key, arr.join(","));
      } else if (def.control === "toggle") {
        if (v === true) p.set(def.key, "1");
      } else if (v) {
        p.set(def.key, v as string);
      }
    }
    if (nextSort) p.set("sort", nextSort);
    return p.toString();
  }

  function commit(next: ActiveFilters, nextSort = sortState, debounce = false) {
    setState(next);
    const go = () => router.push(`/browse?${buildQuery(next, nextSort)}`);
    if (timer.current) clearTimeout(timer.current);
    if (debounce) timer.current = setTimeout(go, 350);
    else go();
  }

  function setRange(key: string, part: "min" | "max", raw: string) {
    const cur = (state[key] as RangeVal) ?? {};
    const n = raw === "" ? undefined : Number(raw);
    const next = { ...state, [key]: { ...cur, [part]: n } };
    if (next[key] && (next[key] as RangeVal).min === undefined && (next[key] as RangeVal).max === undefined)
      delete next[key];
    commit(next, sortState, true);
  }

  function setSelect(key: string, value: string) {
    const next = { ...state };
    if (value) next[key] = value;
    else delete next[key];
    commit(next);
  }

  function toggleMulti(key: string, value: string) {
    const cur = (state[key] as string[]) ?? [];
    const arr = cur.includes(value)
      ? cur.filter((v) => v !== value)
      : [...cur, value];
    const next = { ...state };
    if (arr.length) next[key] = arr;
    else delete next[key];
    commit(next);
  }

  function clearAll() {
    setState({});
    router.push("/browse");
  }

  function matchToClient() {
    const next: ActiveFilters = { ...state };
    if (clientBudget) next.budget = { max: clientBudget };
    commit(next, "fit");
    setSortState("fit");
  }

  const activeCount = Object.keys(state).length;

  return (
    <div className="rounded-xl border border-ink-500 bg-ink-850">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-500 px-5 py-4">
        <div>
          <p className="text-eyebrow">The store</p>
          <p className="mt-0.5 text-sm text-paper-300">
            <span className="font-mono text-paper-100">{resultCount}</span> of{" "}
            {totalCount} communities
          </p>
        </div>
        <div className="flex items-center gap-2">
          {clientLabel && (
            <button onClick={matchToClient} className="btn-primary text-xs">
              Match to {clientLabel}
            </button>
          )}
          <select
            value={sortState}
            onChange={(e) => commit(state, e.target.value)}
            className="input w-auto py-1.5 text-xs"
          >
            <option value="name">Sort: A–Z</option>
            {clientLabel && <option value="fit">Sort: Best fit</option>}
          </select>
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-paper-500 hover:text-paper-200"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter groups */}
      <div className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(([group, defs]) => (
          <div key={group}>
            <p className="text-eyebrow mb-3">{group}</p>
            <div className="space-y-4">
              {defs.map((def) => {
                if (def.control === "range") {
                  const r = (state[def.key] as RangeVal) ?? {};
                  const maxOnly = MAX_ONLY.has(def.key);
                  return (
                    <div key={def.key}>
                      <label className="text-xs text-paper-300">
                        {def.label}
                        {def.unit ? ` (${def.unit})` : ""}
                      </label>
                      <div className="mt-1.5 flex items-center gap-2">
                        {!maxOnly && (
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="min"
                            defaultValue={r.min ?? ""}
                            onChange={(e) => setRange(def.key, "min", e.target.value)}
                            className="input py-1.5 text-xs"
                          />
                        )}
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder={maxOnly ? "max" : "max"}
                          defaultValue={r.max ?? ""}
                          onChange={(e) => setRange(def.key, "max", e.target.value)}
                          className="input py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  );
                }
                const opts = def.options ?? facets[def.key] ?? [];
                if (def.control === "select") {
                  return (
                    <div key={def.key}>
                      <label className="text-xs text-paper-300">{def.label}</label>
                      <select
                        value={(state[def.key] as string) ?? ""}
                        onChange={(e) => setSelect(def.key, e.target.value)}
                        className="input mt-1.5 py-1.5 text-xs"
                      >
                        <option value="">Any</option>
                        {opts.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                // multiselect → chips
                const sel = (state[def.key] as string[]) ?? [];
                return (
                  <div key={def.key}>
                    <label className="text-xs text-paper-300">{def.label}</label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {opts.length === 0 && (
                        <span className="text-[0.625rem] text-paper-700">
                          No options yet
                        </span>
                      )}
                      {opts.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => toggleMulti(def.key, o.value)}
                          className={`chip ${
                            sel.includes(o.value)
                              ? "border-accent-500 bg-accent-500/10 text-paper-100"
                              : ""
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
