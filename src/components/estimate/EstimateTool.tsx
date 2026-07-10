"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { runEstimate, type EstimateReport } from "@/app/actions/estimate";
import type { EstimateCommunity } from "@/lib/data/estimate";
import {
  CONDITION_LABEL, VIEW_LABEL, FURNISHING_LABEL,
  type Condition, type PropertyView, type Furnishing,
} from "@/lib/estimate";
import { aed, num, pct } from "@/lib/format";

export function EstimateTool({ catalogue, initialSlug }: { catalogue: EstimateCommunity[]; initialSlug?: string }) {
  const [slug, setSlug] = useState(
    (initialSlug && catalogue.some((c) => c.slug === initialSlug) ? initialSlug : catalogue[0]?.slug) ?? "",
  );
  const [subCluster, setSubCluster] = useState<string>("");
  const [bedrooms, setBedrooms] = useState<number>(4);
  const [bua, setBua] = useState<number>(3000);
  const [view, setView] = useState<PropertyView>("community");
  const [furnishing, setFurnishing] = useState<Furnishing>("unfurnished");
  const [condition, setCondition] = useState<Condition>("original");
  const [mortgaged, setMortgaged] = useState(false);

  const [report, setReport] = useState<EstimateReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const community = useMemo(() => catalogue.find((c) => c.slug === slug), [catalogue, slug]);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await runEstimate({
        communitySlug: slug,
        subCluster: subCluster || null,
        bedrooms,
        bua_sqft: bua,
        condition,
        view,
        furnishing,
        mortgaged,
      });
      setReport(res.report);
      setError(res.error ?? null);
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Wizard */}
      <div className="elevate space-y-4 rounded-xl border border-ink-500 bg-ink-800/50 p-5">
        <Select label="Community" value={slug} onChange={(v) => { setSlug(v); setSubCluster(""); }}>
          {catalogue.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </Select>

        <Select label="Sub-community / cluster" value={subCluster} onChange={setSubCluster}>
          <option value="">Any / whole community</option>
          {(community?.subs ?? []).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <NumField label="Bedrooms" value={bedrooms} onChange={setBedrooms} />
          <NumField label="Built-up area (sqft)" value={bua} onChange={setBua} />
        </div>

        <Select label="Property view" value={view} onChange={(v) => setView(v as PropertyView)}>
          {(Object.keys(VIEW_LABEL) as PropertyView[]).map((k) => (
            <option key={k} value={k}>{VIEW_LABEL[k]}</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Furnishing" value={furnishing} onChange={(v) => setFurnishing(v as Furnishing)}>
            {(Object.keys(FURNISHING_LABEL) as Furnishing[]).map((k) => (
              <option key={k} value={k}>{FURNISHING_LABEL[k]}</option>
            ))}
          </Select>
          <Select label="Condition" value={condition} onChange={(v) => setCondition(v as Condition)}>
            {(Object.keys(CONDITION_LABEL) as Condition[]).map((k) => (
              <option key={k} value={k}>{CONDITION_LABEL[k]}</option>
            ))}
          </Select>
        </div>

        <div>
          <span className="mb-1 block text-xs text-paper-500">Mortgage status</span>
          <div className="flex gap-2">
            {[false, true].map((m) => (
              <button
                key={String(m)}
                onClick={() => setMortgaged(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  mortgaged === m ? "border-accent-500 bg-accent-500/15 text-paper-100" : "border-ink-500 text-paper-300 hover:bg-ink-700"
                }`}
              >
                {m ? "Mortgaged" : "No mortgage"}
              </button>
            ))}
          </div>
        </div>

        <button onClick={generate} disabled={pending} className="btn-primary w-full disabled:opacity-50">
          {pending ? "Estimating…" : "Generate estimate"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* Report */}
      <div>
        {report ? (
          <Report r={report} />
        ) : (
          <div className="grid h-full min-h-[300px] place-items-center rounded-xl border border-dashed border-ink-600 text-center">
            <div className="max-w-sm px-6">
              <p className="text-paper-300">Pick a community, cluster and unit spec, then generate.</p>
              <p className="mt-2 text-sm text-ink-500">
                The estimate is built from real DLD-registered comparable sales in that
                community — with a confidence range, never an assumed price.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Report({ r }: { r: EstimateReport }) {
  const confCls =
    r.confidence === "high" ? "text-status-ready border-status-ready/50 bg-status-ready/10"
    : r.confidence === "medium" ? "text-accent-400 border-accent-600/50 bg-accent-500/10"
    : "text-ink-500 border-ink-700 bg-ink-900";
  return (
    <div className="space-y-5">
      {/* Headline valuation */}
      <div className="elevate rounded-xl border border-accent-500/40 bg-accent-500/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-eyebrow">Estimated value</p>
            <p className="tnum mt-1 font-display text-4xl text-accent-400">{aed(r.value)}</p>
            <p className="tnum mt-1 text-sm text-paper-300">Range {aed(r.low)} – {aed(r.high)}</p>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.625rem] uppercase tracking-wider ${confCls}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {r.confidence} confidence
            </span>
            <p className="tnum mt-2 text-sm text-paper-300">{num(Math.round(r.adjustedPpsf))} AED/sqft</p>
            {r.appreciationPct != null && (
              <p className={`tnum text-xs ${r.appreciationPct >= 0 ? "text-status-ready" : "text-status-offplan"}`}>
                {pct(r.appreciationPct)} last 6 months
              </p>
            )}
          </div>
        </div>
        <p className="mt-4 text-xs text-paper-500">
          Based on {r.compCount} DLD comparable{r.compCount === 1 ? "" : "s"} — {r.compBasis}.
        </p>
        <Link
          href={`/underwrite?price=${r.value}&bua=${r.bua_sqft}&type=ready&name=${encodeURIComponent(
            `${r.subCluster ? r.subCluster + ", " : ""}${r.communityName}`,
          )}`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-accent-600/60 bg-accent-500/10 px-3.5 py-2 text-sm text-accent-400 transition hover:bg-accent-500/20"
        >
          Underwrite this unit at {aed(r.value)} <span>→</span>
        </Link>
      </div>

      {/* Price trend */}
      {r.trend.length > 1 && <TrendChart trend={r.trend} />}

      {/* Property + adjustments */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="elevate overflow-hidden rounded-xl border border-ink-500 bg-ink-800/40">
          <div className="px-5 py-3 text-eyebrow">Property</div>
          <Row k="Community" v={`${r.subCluster ? r.subCluster + ", " : ""}${r.communityName}`} />
          <Row k="Bedrooms" v={r.bedrooms != null ? String(r.bedrooms) : "—"} />
          <Row k="Built-up area" v={`${num(r.bua_sqft)} sqft`} />
          <Row k="Mortgage" v={r.mortgaged ? "Mortgaged" : "No mortgage"} />
        </div>
        <div className="elevate overflow-hidden rounded-xl border border-ink-500 bg-ink-800/40">
          <div className="px-5 py-3 text-eyebrow">Adjustments applied</div>
          <Row k="Comparable base price/sqft" v={`${num(Math.round(r.basePpsf))} AED`} />
          {r.adjustments.map((a) => (
            <Row key={a.label} k={a.label} v={a.pct === 0 ? "—" : `${a.pct > 0 ? "+" : ""}${a.pct.toFixed(0)}%`} />
          ))}
        </div>
      </div>

      {/* Rental + cost breakdown */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="elevate overflow-hidden rounded-xl border border-ink-500 bg-ink-800/40">
          <div className="px-5 py-3 text-eyebrow">Indicative rental</div>
          <Row k={`Gross rent (~${r.grossYieldPct}% yield)`} v={`${aed(r.rentPerYear)} / yr`} />
          <Row k="Implied gross yield" v={`${r.grossYieldPct}%`} />
        </div>
        <div className="elevate overflow-hidden rounded-xl border border-ink-500 bg-ink-800/40">
          <div className="px-5 py-3 text-eyebrow">Total cost to buy</div>
          <Row k="Estimated value" v={aed(r.value)} />
          <Row k="DLD fee (4%)" v={aed(r.cost.dld)} />
          <Row k="Registration trustee fee" v={aed(r.cost.trustee)} />
          <Row k="Agency fee (2%)" v={aed(r.cost.agency)} />
          <Row k="Total cost to acquire" v={aed(r.cost.total)} strong />
        </div>
      </div>

      {/* Comparable transactions */}
      {r.usedComps.length > 0 && (
        <div className="elevate overflow-hidden rounded-xl border border-ink-500 bg-ink-800/40">
          <div className="px-5 py-3 text-eyebrow">Comparable DLD transactions</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-y border-ink-600 text-left text-xs uppercase tracking-wider text-paper-500">
                  <th className="px-5 py-2">Date</th>
                  <th className="px-3 py-2">Cluster</th>
                  <th className="px-3 py-2 text-right">Beds</th>
                  <th className="px-3 py-2 text-right">Sqft</th>
                  <th className="px-3 py-2 text-right">AED/sqft</th>
                  <th className="px-5 py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {r.usedComps.map((t, i) => (
                  <tr key={i} className="border-b border-ink-600/60 last:border-b-0">
                    <td className="px-5 py-2 text-paper-300">{t.d}</td>
                    <td className="px-3 py-2 text-paper-300">{t.c ?? "—"}</td>
                    <td className="tnum px-3 py-2 text-right text-paper-300">{t.b ?? "—"}</td>
                    <td className="tnum px-3 py-2 text-right text-paper-300">{t.s ? num(t.s) : "—"}</td>
                    <td className="tnum px-3 py-2 text-right text-paper-300">{t.pp ? num(t.pp) : "—"}</td>
                    <td className="tnum px-5 py-2 text-right text-paper-100">{aed(t.p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-paper-700">
        This estimate is for information only and is not a formal valuation. It is
        built from DLD-registered comparable sales; condition, view and furnishing
        adjustments are disclosed model factors. Actual sale price varies with
        fit-out, layout, floor and negotiation.
      </p>
    </div>
  );
}

function TrendChart({ trend }: { trend: { month: string; median_ppsf: number; n: number }[] }) {
  const pts = trend.slice(-12);
  const max = Math.max(...pts.map((p) => p.median_ppsf));
  const min = Math.min(...pts.map((p) => p.median_ppsf));
  const range = max - min || 1;
  return (
    <div className="elevate rounded-xl border border-ink-500 bg-ink-800/40 p-5">
      <p className="text-eyebrow">Price trend · median AED/sqft</p>
      <div className="mt-4 flex items-end gap-1.5" style={{ height: 96 }}>
        {pts.map((p) => (
          <div key={p.month} className="group flex flex-1 flex-col items-center justify-end" title={`${p.month}: ${num(p.median_ppsf)} AED/sqft (${p.n})`}>
            <div
              className="w-full rounded-t bg-accent-500/60 transition group-hover:bg-accent-400"
              style={{ height: `${20 + ((p.median_ppsf - min) / range) * 70}%` }}
            />
            <span className="mt-1 text-[0.5rem] text-ink-500">{p.month.slice(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-paper-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-paper-100 outline-none focus:border-accent-500"
      >
        {children}
      </select>
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-paper-500">{label}</span>
      <input
        value={value ? String(value) : ""}
        inputMode="decimal"
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="tnum w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500"
      />
    </label>
  );
}

function Row({ k, v, strong }: { k: string; v: string | null; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-ink-600 px-5 py-2.5 last:border-b-0 ${strong ? "bg-ink-800/60" : ""}`}>
      <span className="text-sm text-paper-500">{k}</span>
      <span className={`tnum text-sm ${strong ? "font-medium text-paper-100" : "text-paper-200"}`}>{v ?? "—"}</span>
    </div>
  );
}
