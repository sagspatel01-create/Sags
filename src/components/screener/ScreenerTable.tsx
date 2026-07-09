"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ScreenerRow } from "@/lib/data/screener";
import { aed, pct } from "@/lib/format";

type SortKey =
  | "score" | "medianPrice" | "pricePerSqft" | "appreciationPct"
  | "txnCount" | "irrPct" | "netYieldPct" | "dscr";

const COLS: { key: SortKey; label: string; hint?: string }[] = [
  { key: "score", label: "Score", hint: "60% return + 40% liquidity, percentile-ranked" },
  { key: "medianPrice", label: "Median", hint: "DLD median sale price (6-mo)" },
  { key: "pricePerSqft", label: "AED/sqft", hint: "DLD average price per sqft" },
  { key: "appreciationPct", label: "6-mo Δ", hint: "Recent DLD price trend" },
  { key: "txnCount", label: "Liquidity", hint: "DLD sales in the window" },
  { key: "irrPct", label: "Ind. IRR", hint: "Indicative 5-yr IRR, identical assumptions" },
  { key: "netYieldPct", label: "Net yield", hint: "NOI / total acquisition" },
  { key: "dscr", label: "DSCR", hint: "NOI / annual debt service" },
];

const num = (v: number | null | undefined) => (v == null ? -Infinity : v);

export function ScreenerTable({ rows }: { rows: ScreenerRow[] }) {
  const [sort, setSort] = useState<SortKey>("score");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [status, setStatus] = useState<"all" | "ready" | "offplan" | "mixed">("all");
  const [q, setQ] = useState("");

  const view = useMemo(() => {
    let r = rows;
    if (status !== "all") r = r.filter((x) => x.status === status);
    if (q.trim()) {
      const n = q.toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(n) || (x.developer ?? "").toLowerCase().includes(n));
    }
    const s = [...r].sort((a, b) => {
      const av = num(a[sort]), bv = num(b[sort]);
      return dir === "desc" ? bv - av : av - bv;
    });
    return s;
  }, [rows, sort, dir, status, q]);

  function toggle(k: SortKey) {
    if (k === sort) setDir(dir === "desc" ? "asc" : "desc");
    else { setSort(k); setDir("desc"); }
  }

  const scoreColor = (s: number) =>
    s >= 75 ? "text-status-ready" : s >= 45 ? "text-accent-400" : "text-ink-500";

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter community or developer…"
          className="w-64 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-paper-100 placeholder:text-ink-500 focus:border-accent-600 focus:outline-none"
        />
        <div className="flex gap-1">
          {(["all", "ready", "offplan", "mixed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${
                status === s
                  ? "bg-accent-500 text-ink-900"
                  : "border border-ink-700 text-ink-500 hover:text-paper-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-ink-500">{view.length} communities with live DLD data</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-ink-700">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 bg-ink-900/60 text-left">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-ink-500">Community</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggle(c.key)}
                  title={c.hint}
                  className="cursor-pointer select-none px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-ink-500 transition hover:text-paper-300"
                >
                  {c.label}
                  {sort === c.key && <span className="ml-1 text-accent-400">{dir === "desc" ? "▼" : "▲"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.slug} className="border-b border-ink-700/50 transition hover:bg-ink-900/40">
                <td className="px-4 py-3">
                  <Link href={`/communities/${r.slug}`} className="font-medium text-paper-100 hover:text-accent-400">
                    {r.name}
                  </Link>
                  <div className="text-xs text-ink-500">{r.developer ?? "—"}</div>
                </td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${scoreColor(r.score)}`}>{r.score}</td>
                <td className="px-4 py-3 text-right tabular-nums text-paper-300">{r.medianPrice ? aed(r.medianPrice) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-paper-300">{r.pricePerSqft ? Math.round(r.pricePerSqft).toLocaleString() : "—"}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${r.appreciationPct != null && r.appreciationPct >= 0 ? "text-status-ready" : "text-status-offplan"}`}>
                  {r.appreciationPct != null ? pct(r.appreciationPct) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-paper-300">{r.txnCount || "—"}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-paper-100">{r.irrPct != null ? pct(r.irrPct) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-paper-300">{r.netYieldPct != null ? pct(r.netYieldPct) : "—"}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${r.dscr != null && r.dscr < 1.15 ? "text-status-offplan" : "text-paper-300"}`}>
                  {r.dscr != null ? r.dscr.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
