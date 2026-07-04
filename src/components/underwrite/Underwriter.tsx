"use client";

import { useMemo, useState } from "react";
import {
  underwrite,
  type UnderwriteInput,
  type DealType,
  type Financing,
} from "@/lib/underwrite";
import { investmentVerdict } from "@/app/actions/underwrite";
import type { DealOption } from "@/lib/data/deals";
import { aed, pct } from "@/lib/format";

const DEFAULTS: Omit<UnderwriteInput, "price" | "dealType"> = {
  holdingYears: 5,
  appreciationPct: 7,
  grossYieldPct: 6,
  dldPct: 4,
  agencyPct: 2,
  constructionYears: 3,
  constructionPct: 60,
  handoverPct: 40,
  financing: "mortgage",
  ltvPct: 75,
  mortgageRatePct: 4.5,
  mortgageTenorYears: 25,
};

export function Underwriter({ deals }: { deals: DealOption[] }) {
  const [dealKey, setDealKey] = useState<string>(deals[0]?.key ?? "manual");
  const deal = deals.find((d) => d.key === dealKey) ?? null;

  const [price, setPrice] = useState<number>(deals[0]?.price ?? 5_000_000);
  const [dealType, setDealType] = useState<DealType>(
    (deals[0]?.status === "offplan" ? "offplan" : "ready") as DealType,
  );
  const [f, setF] = useState({ ...DEFAULTS });
  const [bua, setBua] = useState<number | null>(deals[0]?.bua_sqft ?? null);
  const [sc, setSc] = useState<number | null>(deals[0]?.service_charge_per_sqft ?? 4);

  const [notes, setNotes] = useState("");
  const [verdict, setVerdict] = useState<string | null>(null);
  const [loadingVerdict, setLoadingVerdict] = useState(false);
  const [verdictErr, setVerdictErr] = useState<string | null>(null);

  function selectDeal(key: string) {
    setDealKey(key);
    setVerdict(null);
    const d = deals.find((x) => x.key === key);
    if (d) {
      setPrice(d.price);
      setDealType(d.status === "offplan" ? "offplan" : "ready");
      setBua(d.bua_sqft);
      setSc(d.service_charge_per_sqft ?? 4);
    }
  }

  const input: UnderwriteInput = useMemo(
    () => ({ ...f, dealType, price, bua_sqft: bua, serviceChargePerSqft: sc }),
    [f, dealType, price, bua, sc],
  );
  const r = useMemo(() => underwrite(input), [input]);

  async function getVerdict() {
    setLoadingVerdict(true);
    setVerdict(null);
    setVerdictErr(null);
    const res = await investmentVerdict(input, {
      community: deal?.communityName ?? null,
      status: dealType,
      tier: deal?.tier ?? null,
      developer: deal?.developer ?? null,
      notes: notes.trim() || null,
    });
    setLoadingVerdict(false);
    if (res.verdict) setVerdict(res.verdict);
    else setVerdictErr(res.error ?? "Could not generate a verdict.");
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Inputs */}
      <div className="elevate space-y-5 rounded-xl border border-ink-500 bg-ink-800/50 p-5">
        <div>
          <p className="text-eyebrow">Deal</p>
          <select
            value={dealKey}
            onChange={(e) => selectDeal(e.target.value)}
            className="mt-2 w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-paper-100 outline-none focus:border-accent-500"
          >
            {deals.map((d) => (
              <option key={d.key} value={d.key}>
                {d.communityName} · {d.unitName ?? `${d.bedrooms ?? ""}BR`} · {aed(d.price)}
              </option>
            ))}
            <option value="manual">Manual entry…</option>
          </select>
        </div>

        <Field label="Purchase price (AED)" value={price} onChange={(v) => setPrice(v)} />

        <div>
          <p className="text-eyebrow">Type</p>
          <div className="mt-2 flex gap-2">
            {(["offplan", "ready"] as DealType[]).map((t) => (
              <button
                key={t}
                onClick={() => setDealType(t)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                  dealType === t
                    ? "border-accent-500 bg-accent-500/15 text-paper-100"
                    : "border-ink-500 text-paper-300 hover:bg-ink-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Hold (yrs)" value={f.holdingYears} onChange={(v) => setF({ ...f, holdingYears: v })} />
          <Field label="Appreciation %/yr" value={f.appreciationPct} onChange={(v) => setF({ ...f, appreciationPct: v })} />
          <Field label="Gross yield %" value={f.grossYieldPct} onChange={(v) => setF({ ...f, grossYieldPct: v })} />
          <Field label="Service AED/sqft" value={sc ?? 0} onChange={(v) => setSc(v)} />
        </div>

        {dealType === "offplan" ? (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Constr. yrs" value={f.constructionYears ?? 0} onChange={(v) => setF({ ...f, constructionYears: v })} />
            <Field label="Constr. %" value={f.constructionPct ?? 0} onChange={(v) => setF({ ...f, constructionPct: v })} />
            <Field label="Handover %" value={f.handoverPct ?? 0} onChange={(v) => setF({ ...f, handoverPct: v })} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["mortgage", "cash"] as Financing[]).map((fin) => (
                <button
                  key={fin}
                  onClick={() => setF({ ...f, financing: fin })}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors ${
                    f.financing === fin
                      ? "border-accent-500 bg-accent-500/15 text-paper-100"
                      : "border-ink-500 text-paper-300 hover:bg-ink-700"
                  }`}
                >
                  {fin}
                </button>
              ))}
            </div>
            {f.financing === "mortgage" && (
              <div className="grid grid-cols-3 gap-3">
                <Field label="LTV %" value={f.ltvPct ?? 0} onChange={(v) => setF({ ...f, ltvPct: v })} />
                <Field label="Rate %" value={f.mortgageRatePct ?? 0} onChange={(v) => setF({ ...f, mortgageRatePct: v })} />
                <Field label="Tenor yrs" value={f.mortgageTenorYears ?? 0} onChange={(v) => setF({ ...f, mortgageTenorYears: v })} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Equity multiple" value={`${r.equityMultiple.toFixed(2)}×`} strong />
          <Stat label="Annualized ROI" value={pct(r.annualizedRoiPct)} strong />
          <Stat label="Cash-on-cash" value={r.cashOnCashPct != null ? pct(r.cashOnCashPct) : "—"} />
          <Stat label="Net yield" value={r.netYieldPct != null ? pct(r.netYieldPct) : "—"} />
        </div>

        <div className="elevate overflow-hidden rounded-xl border border-ink-500 bg-ink-800/40">
          <Row k="Cash invested (equity in)" v={aed(r.cashInvested)} />
          {r.loanAmount > 0 && <Row k="Mortgage" v={aed(r.loanAmount)} />}
          <Row k="Transaction costs" v={aed(r.transactionCosts)} />
          <Row k={`Annual net cash flow · ${r.incomeYears}y`} v={aed(r.annualNetCashFlow)} />
          <Row k="Projected exit value" v={aed(r.exitValue)} />
          <Row k="Equity at exit" v={aed(r.exitEquity)} />
          <Row k="Total profit" v={aed(r.totalProfit)} strong />
          <Row k="Total ROI" v={pct(r.roiPct)} />
        </div>

        <p className="text-xs text-paper-700">
          Assumptions: {r.assumptions.join(" · ")}. Figures are model outputs
          from your inputs, not guarantees.
        </p>

        {/* Growth thesis / factors */}
        <div className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-5">
          <p className="text-eyebrow">Growth factors &amp; notes</p>
          <p className="mt-1 text-xs text-paper-500">
            Why you expect this to perform — construction progress, handover /
            completion dates, government &amp; infrastructure plans, developer
            track record, absorption, supply. Claude weaves these into the
            verdict and the investor case.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="e.g. Metro Blue Line station 600m, handover Q4 2027, 90% sold in phase 1, master-community completion 2026, DLD +18% YoY in the district…"
            className="mt-3 w-full rounded-lg border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-paper-100 outline-none placeholder:text-paper-700 focus:border-accent-500"
          />
        </div>

        {/* Verdict */}
        <div className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-eyebrow">Underwriting verdict</p>
            <button onClick={getVerdict} disabled={loadingVerdict} className="btn-primary text-xs disabled:opacity-50">
              {loadingVerdict ? "Underwriting…" : verdict ? "Re-run" : "Get Claude's verdict"}
            </button>
          </div>
          {verdictErr && <p className="mt-3 text-sm text-red-400">{verdictErr}</p>}
          {verdict ? (
            <div className="mt-4 space-y-2 whitespace-pre-line text-sm leading-relaxed text-paper-200">
              {verdict}
            </div>
          ) : (
            !verdictErr && (
              <p className="mt-3 text-sm text-paper-500">
                Runs the numbers above through Claude for a buy-side read —
                strength, risks, and what to adjust.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-paper-500">{label}</span>
      <input
        value={String(value)}
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

function Stat({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <div className={`elevate rounded-xl border p-4 ${strong ? "border-accent-500/40 bg-accent-500/5" : "border-ink-500 bg-ink-800/40"}`}>
      <p className="text-[0.625rem] uppercase tracking-wider text-paper-500">{label}</p>
      <p className={`tnum mt-1 font-display text-2xl ${strong ? "text-accent-400" : "text-paper-100"}`}>{value ?? "—"}</p>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string | null; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-ink-600 px-5 py-3 last:border-b-0 ${strong ? "bg-ink-800/60" : ""}`}>
      <span className="text-sm text-paper-500">{k}</span>
      <span className={`tnum text-sm ${strong ? "font-medium text-paper-100" : "text-paper-200"}`}>{v ?? "—"}</span>
    </div>
  );
}
