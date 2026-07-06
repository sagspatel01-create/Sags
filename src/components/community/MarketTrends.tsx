"use client";

import { useMemo, useState } from "react";
import type { TxnLite } from "@/lib/sources/dld";
import { aed, num, pct } from "@/lib/format";

/**
 * Bayut-style, but from real DLD sold prices. One compact transaction list
 * per community drives the whole thing: chip filters (unit type · reg ·
 * bedrooms · cluster) recompute the KPI band, the 6-month median-AED/sqft
 * trend, and the last-transactions table entirely client-side. Only real
 * rows are shown; empty filters say so rather than inventing a number.
 */

type Reg = "all" | "ready" | "offplan";
type Unit = "all" | "villa" | "townhouse";

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface TrendPoint {
  month: string;
  median_ppsf: number;
  n: number;
}

function monthlyTrend(txns: TxnLite[]): TrendPoint[] {
  const byMonth = new Map<string, number[]>();
  for (const t of txns) {
    if (t.pp == null) continue;
    const month = t.d.slice(0, 7);
    const arr = byMonth.get(month) ?? [];
    arr.push(t.pp);
    byMonth.set(month, arr);
  }
  return [...byMonth.entries()]
    .map(([month, ppsf]) => ({ month, median_ppsf: Math.round(median(ppsf)), n: ppsf.length }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-accent-500/60 bg-accent-500/15 text-accent-400"
          : "border-ink-500 bg-ink-800/50 text-paper-500 hover:border-ink-600 hover:text-paper-100"
      }`}
    >
      {children}
    </button>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-ink-500 bg-ink-800/40 text-sm text-paper-500">
        Not enough months in this filter to draw a trend.
      </div>
    );
  }
  const W = 720;
  const H = 180;
  const padX = 44;
  const padY = 24;
  const vals = points.map((p) => p.median_ppsf);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => padX + (i * (W - padX - 16)) / (points.length - 1);
  const y = (v: number) => padY + (1 - (v - min) / span) * (H - padY * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.median_ppsf)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${H - padY} L${x(0)},${H - padY} Z`;

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-500 bg-ink-850/60 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-500)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* y gridlines: min / mid / max */}
        {[min, (min + max) / 2, max].map((v, i) => (
          <g key={i}>
            <line x1={padX} y1={y(v)} x2={W - 16} y2={y(v)} stroke="var(--ink-600)" strokeWidth="1" />
            <text x={4} y={y(v) + 3} fontSize="10" fill="var(--paper-500)">
              {Math.round(v / 10) * 10}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#mt-fill)" />
        <path d={line} fill="none" stroke="var(--accent-400)" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={x(i)} cy={y(p.median_ppsf)} r="3" fill="var(--accent-400)" />
            <text x={x(i)} y={H - 6} fontSize="10" fill="var(--paper-500)" textAnchor="middle">
              {monthLabel(p.month)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-ink-500 bg-ink-800/50 px-4 py-3">
      <p className="text-[0.625rem] uppercase tracking-wider text-paper-500">{label}</p>
      <p className="tnum mt-1 text-lg text-paper-100">{value}</p>
      {sub && <p className="text-xs text-paper-500">{sub}</p>}
    </div>
  );
}

export function MarketTrends({
  txns,
  asOf,
}: {
  txns: TxnLite[];
  asOf?: string | null;
}) {
  const [unit, setUnit] = useState<Unit>("all");
  const [reg, setReg] = useState<Reg>("all");
  const [beds, setBeds] = useState<number | "all">("all");
  const [cluster, setCluster] = useState<string | "all">("all");

  const bedOptions = useMemo(
    () => [...new Set(txns.map((t) => t.b).filter((b): b is number => b != null))].sort((a, b) => a - b),
    [txns],
  );
  const clusterOptions = useMemo(
    () => [...new Set(txns.map((t) => t.c).filter((c): c is string => !!c))].sort(),
    [txns],
  );

  const filtered = useMemo(
    () =>
      txns.filter(
        (t) =>
          (unit === "all" || t.u === unit) &&
          (reg === "all" || t.r === reg) &&
          (beds === "all" || t.b === beds) &&
          (cluster === "all" || t.c === cluster),
      ),
    [txns, unit, reg, beds, cluster],
  );

  const trend = useMemo(() => monthlyTrend(filtered), [filtered]);
  const kpis = useMemo(() => {
    const prices = filtered.map((t) => t.p);
    const ppsf = filtered.map((t) => t.pp).filter((x): x is number => x != null);
    let appreciation: number | null = null;
    if (trend.length >= 2 && trend[0].median_ppsf > 0) {
      appreciation = Math.round(((trend[trend.length - 1].median_ppsf - trend[0].median_ppsf) / trend[0].median_ppsf) * 1000) / 10;
    }
    return {
      count: filtered.length,
      medianPrice: prices.length ? Math.round(median(prices)) : null,
      medianPpsf: ppsf.length ? Math.round(median(ppsf)) : null,
      appreciation,
    };
  }, [filtered, trend]);

  const recent = filtered.slice(0, 40); // txns already newest-first

  return (
    <div className="space-y-5">
      {/* Filter chips */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[0.625rem] uppercase tracking-wider text-paper-500">Type</span>
          {(["all", "villa", "townhouse"] as Unit[]).map((u) => (
            <Chip key={u} active={unit === u} onClick={() => setUnit(u)}>
              {u === "all" ? "All" : u === "villa" ? "Villas" : "Townhouses"}
            </Chip>
          ))}
          <span className="ml-3 mr-1 text-[0.625rem] uppercase tracking-wider text-paper-500">Status</span>
          {(["all", "ready", "offplan"] as Reg[]).map((r) => (
            <Chip key={r} active={reg === r} onClick={() => setReg(r)}>
              {r === "all" ? "All" : r === "ready" ? "Ready" : "Off-plan"}
            </Chip>
          ))}
        </div>
        {bedOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[0.625rem] uppercase tracking-wider text-paper-500">Beds</span>
            <Chip active={beds === "all"} onClick={() => setBeds("all")}>All</Chip>
            {bedOptions.map((b) => (
              <Chip key={b} active={beds === b} onClick={() => setBeds(b)}>
                {b === 0 ? "Studio" : `${b} BR`}
              </Chip>
            ))}
          </div>
        )}
        {clusterOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[0.625rem] uppercase tracking-wider text-paper-500">Cluster</span>
            <Chip active={cluster === "all"} onClick={() => setCluster("all")}>All</Chip>
            {clusterOptions.map((c) => (
              <Chip key={c} active={cluster === c} onClick={() => setCluster(c)}>{c}</Chip>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-500 bg-ink-800/40 p-5 text-sm text-paper-500">
          No DLD transactions match this filter in the last 6 months.
        </p>
      ) : (
        <>
          {/* KPI band */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Transactions" value={num(kpis.count) ?? "—"} sub="last 6 months" />
            <Kpi label="Median price" value={kpis.medianPrice ? (aed(kpis.medianPrice) ?? "—") : "—"} />
            <Kpi label="Median AED/sqft" value={kpis.medianPpsf ? (num(kpis.medianPpsf) ?? "—") : "—"} />
            <Kpi
              label="6-mo appreciation"
              value={kpis.appreciation != null ? (pct(kpis.appreciation) ?? "—") : "—"}
              sub={kpis.appreciation != null && kpis.appreciation >= 0 ? "median AED/sqft ↑" : kpis.appreciation != null ? "median AED/sqft ↓" : undefined}
            />
          </div>

          {/* Trend */}
          <div>
            <p className="mb-2 text-eyebrow">Median AED/sqft · monthly</p>
            <TrendChart points={trend} />
          </div>

          {/* Last transactions */}
          <div>
            <p className="mb-2 text-eyebrow">Last transactions{filtered.length > recent.length ? ` · latest ${recent.length} of ${filtered.length}` : ""}</p>
            <div className="overflow-x-auto rounded-xl border border-ink-500">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs text-paper-500">
                    {["Date", "Cluster", "Type", "Beds", "Size", "Price", "AED/sqft"].map((h) => (
                      <th key={h} className="border-b border-ink-500 bg-ink-850 px-4 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t, i) => (
                    <tr key={i}>
                      <td className="tnum border-b border-ink-600 px-4 py-2.5 text-paper-500">{t.d}</td>
                      <td className="border-b border-ink-600 px-4 py-2.5 text-paper-100">{t.c ?? "—"}</td>
                      <td className="border-b border-ink-600 px-4 py-2.5 capitalize text-paper-500">
                        {t.u}
                        {t.r === "offplan" && <span className="ml-1.5 text-[0.625rem] uppercase tracking-wider text-paper-500">off-plan</span>}
                      </td>
                      <td className="tnum border-b border-ink-600 px-4 py-2.5 text-paper-500">{t.b == null ? "—" : t.b === 0 ? "Studio" : t.b}</td>
                      <td className="tnum border-b border-ink-600 px-4 py-2.5 text-paper-500">{t.s ? `${num(t.s)} sqft` : "—"}</td>
                      <td className="tnum border-b border-ink-600 px-4 py-2.5 text-paper-100">{aed(t.p)}</td>
                      <td className="tnum border-b border-ink-600 px-4 py-2.5 text-paper-300">{t.pp ? num(t.pp) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-paper-700">
        Source: Dubai Land Department (DLD) transactions{asOf ? ` · as of ${asOf}` : ""}. Trailing 6-month window, sold prices — not asking prices.
      </p>
    </div>
  );
}
