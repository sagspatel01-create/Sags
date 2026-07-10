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
  offplanAdminFee: 3150,
  vacancyPct: 5,
  mgmtFeePct: 5,
  maintenancePct: 0.5,
  insurancePct: 0.1,
  constructionYears: 2,
  constructionPct: 50,
  handoverPct: 50,
  postHandoverPct: 0,
  postHandoverYears: 0,
  financing: "mortgage",
  downPaymentPct: 20,
  mortgageRatePct: 4.5,
  mortgageTenorYears: 25,
  stressRateDeltaPct: 2,
};

// Common Dubai off-plan payment plans → [construction%, handover%, post%, postYrs]
const PLAN_PRESETS: { label: string; c: number; h: number; p: number; py: number }[] = [
  { label: "50 / 50", c: 50, h: 50, p: 0, py: 0 },
  { label: "40 / 60", c: 40, h: 60, p: 0, py: 0 },
  { label: "20 / 80", c: 20, h: 80, p: 0, py: 0 },
  { label: "60 / 40", c: 60, h: 40, p: 0, py: 0 },
  { label: "40 / 10 / 50 PHPP", c: 40, h: 10, p: 50, py: 4 },
  { label: "1%/mo PHPP", c: 20, h: 20, p: 60, py: 5 },
];

const FIN_LABEL: Record<Financing, string> = {
  cash: "Cash",
  mortgage: "Mortgage",
  equity_release: "Equity release",
  buyout: "Buyout",
};

export interface UnderwritePrefill {
  price?: number;
  bua?: number;
  name?: string;
  type?: DealType;
}

export function Underwriter({ deals, prefill }: { deals: DealOption[]; prefill?: UnderwritePrefill }) {
  // A prefill (e.g. handed off from the Estimate tool) starts in manual mode
  // with the estimated value + area already filled.
  const [dealKey, setDealKey] = useState<string>(prefill?.price ? "manual" : deals[0]?.key ?? "manual");
  const deal = deals.find((d) => d.key === dealKey) ?? null;

  const [price, setPrice] = useState<number>(prefill?.price ?? deals[0]?.price ?? 5_000_000);
  const [dealType, setDealType] = useState<DealType>(
    (prefill?.type ?? (deals[0]?.status === "offplan" ? "offplan" : "ready")) as DealType,
  );
  const [f, setF] = useState({ ...DEFAULTS });
  const [bua, setBua] = useState<number | null>(prefill?.bua ?? deals[0]?.bua_sqft ?? null);
  const [sc, setSc] = useState<number | null>(deals[0]?.service_charge_per_sqft ?? 4);
  const [ppsfTarget, setPpsfTarget] = useState<number | null>(null);
  const [manualLoan, setManualLoan] = useState<number | null>(null);

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
    () => ({
      ...f,
      dealType,
      price,
      bua_sqft: bua,
      serviceChargePerSqft: sc,
      targetExitPricePerSqft: ppsfTarget,
      manualLoanAmount: f.financing === "equity_release" || f.financing === "buyout" ? manualLoan : null,
    }),
    [f, dealType, price, bua, sc, ppsfTarget, manualLoan],
  );
  const r = useMemo(() => underwrite(input), [input]);

  const financed = dealType === "ready" && f.financing !== "cash";
  const manualLoanMode = f.financing === "equity_release" || f.financing === "buyout";

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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Built-up area (sqft)" value={bua ?? 0} onChange={(v) => setBua(v || null)} />
          <div>
            <span className="mb-1 block text-xs text-paper-500">Entry AED/sqft</span>
            <div className="tnum rounded-md border border-ink-600 bg-ink-900/60 px-3 py-2 text-sm text-paper-300">
              {r.entryPricePerSqft ? Math.round(r.entryPricePerSqft).toLocaleString() : "—"}
            </div>
          </div>
        </div>

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
          <Field label="Gross yield %" value={f.grossYieldPct} onChange={(v) => setF({ ...f, grossYieldPct: v })} />
          <Field label="Appreciation %/yr" value={f.appreciationPct} onChange={(v) => setF({ ...f, appreciationPct: v })} />
          <Field
            label="…or target exit AED/sqft"
            value={ppsfTarget ?? 0}
            onChange={(v) => setPpsfTarget(v || null)}
          />
        </div>
        {ppsfTarget != null && r.entryPricePerSqft != null && (
          <p className="-mt-2 text-xs text-accent-400">
            Appreciation derived from price/sqft → {r.effectiveAppreciationPct.toFixed(2)}%/yr
          </p>
        )}

        <Field label="Service charge AED/sqft" value={sc ?? 0} onChange={(v) => setSc(v)} />

        <details className="group">
          <summary className="cursor-pointer text-eyebrow marker:content-['']">
            Operating assumptions <span className="text-paper-700 group-open:hidden">▸</span>
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="Vacancy %" value={f.vacancyPct ?? 0} onChange={(v) => setF({ ...f, vacancyPct: v })} />
            <Field label="Mgmt fee %" value={f.mgmtFeePct ?? 0} onChange={(v) => setF({ ...f, mgmtFeePct: v })} />
            <Field label="Maintenance %/yr" value={f.maintenancePct ?? 0} onChange={(v) => setF({ ...f, maintenancePct: v })} />
            <Field label="Insurance %/yr" value={f.insurancePct ?? 0} onChange={(v) => setF({ ...f, insurancePct: v })} />
            <Field label="DLD %" value={f.dldPct} onChange={(v) => setF({ ...f, dldPct: v })} />
            <Field label="Agency % (ready only)" value={f.agencyPct} onChange={(v) => setF({ ...f, agencyPct: v })} />
          </div>
        </details>

        {dealType === "offplan" ? (
          <div className="space-y-3">
            <p className="text-eyebrow">Payment plan</p>
            <div className="flex flex-wrap gap-1.5">
              {PLAN_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setF({ ...f, constructionPct: p.c, handoverPct: p.h, postHandoverPct: p.p, postHandoverYears: p.py })}
                  className="rounded-full border border-ink-500 px-2.5 py-1 text-xs text-paper-300 transition hover:border-accent-500 hover:text-paper-100"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Construction yrs" value={f.constructionYears ?? 0} onChange={(v) => setF({ ...f, constructionYears: v })} />
              <Field label="During construction %" value={f.constructionPct ?? 0} onChange={(v) => setF({ ...f, constructionPct: v })} />
              <Field label="At handover %" value={f.handoverPct ?? 0} onChange={(v) => setF({ ...f, handoverPct: v })} />
              <Field label="Post-handover %" value={f.postHandoverPct ?? 0} onChange={(v) => setF({ ...f, postHandoverPct: v })} />
              <Field label="Post-handover yrs" value={f.postHandoverYears ?? 0} onChange={(v) => setF({ ...f, postHandoverYears: v })} />
            </div>
            <p className="text-xs text-paper-700">
              Off-plan bought from the developer carries DLD/Oqood registration
              but <span className="text-paper-300">no brokerage agency fee</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-eyebrow">Financing</p>
            <div className="grid grid-cols-2 gap-2">
              {(["cash", "mortgage", "equity_release", "buyout"] as Financing[]).map((fin) => (
                <button
                  key={fin}
                  onClick={() => setF({ ...f, financing: fin })}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    f.financing === fin
                      ? "border-accent-500 bg-accent-500/15 text-paper-100"
                      : "border-ink-500 text-paper-300 hover:bg-ink-700"
                  }`}
                >
                  {FIN_LABEL[fin]}
                </button>
              ))}
            </div>
            {financed && (
              <>
                {!manualLoanMode ? (
                  <Field label="Down payment %" value={f.downPaymentPct ?? 20} onChange={(v) => setF({ ...f, downPaymentPct: v })} />
                ) : (
                  <Field
                    label={`${FIN_LABEL[f.financing as Financing]} loan amount (AED)`}
                    value={manualLoan ?? 0}
                    onChange={(v) => setManualLoan(v || null)}
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rate %" value={f.mortgageRatePct ?? 0} onChange={(v) => setF({ ...f, mortgageRatePct: v })} />
                  <Field label="Tenor yrs" value={f.mortgageTenorYears ?? 0} onChange={(v) => setF({ ...f, mortgageTenorYears: v })} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="IRR (on capital in)" value={r.irrPct != null ? pct(r.irrPct) : "—"} strong />
          <Stat label="Equity multiple" value={`${r.equityMultiple.toFixed(2)}×`} strong />
          <Stat label="Cash-on-cash" value={r.cashOnCashPct != null ? pct(r.cashOnCashPct) : "—"} />
          <Stat label="ROE · yr 1" value={r.roeYear1Pct != null ? pct(r.roeYear1Pct) : "—"} />
        </div>

        {/* Price-per-sqft journey */}
        {r.entryPricePerSqft != null && r.exitPricePerSqft != null && (
          <div className="elevate flex items-center justify-between rounded-xl border border-ink-500 bg-ink-800/40 px-5 py-4">
            <div>
              <p className="text-[0.625rem] uppercase tracking-wider text-paper-500">Capital appreciation · price per sqft</p>
              <p className="tnum mt-1 text-lg text-paper-100">
                {Math.round(r.entryPricePerSqft).toLocaleString()}{" "}
                <span className="text-paper-500">→</span>{" "}
                <span className="text-accent-400">{Math.round(r.exitPricePerSqft).toLocaleString()}</span>{" "}
                <span className="text-sm text-paper-500">AED/sqft over {input.holdingYears}y</span>
              </p>
            </div>
            <div className="text-right">
              <p className="tnum font-display text-2xl text-status-ready">{pct(r.appreciationTotalPct)}</p>
              <p className="text-xs text-paper-500">{r.effectiveAppreciationPct.toFixed(2)}% / yr</p>
            </div>
          </div>
        )}

        <div className="elevate overflow-hidden rounded-xl border border-ink-500 bg-ink-800/40">
          <Row k="Cash invested (equity in)" v={aed(r.cashInvested)} strong />
          {r.downPayment > 0 && <Row k="Down payment" v={aed(r.downPayment)} />}
          {r.loanAmount > 0 && <Row k={`Loan (${Math.round((r.loanAmount / price) * 100)}% of price)`} v={aed(r.loanAmount)} />}
          <Row k={`DLD / registration (${f.dldPct}%)`} v={aed(r.dldFee)} />
          {r.agencyFee > 0 && <Row k={`Agency fee (${f.agencyPct}%)`} v={aed(r.agencyFee)} />}
          {r.mortgageCosts > 0 && <Row k="Mortgage set-up costs" v={aed(r.mortgageCosts)} />}
          <Row k="NOI (net of vacancy + all OpEx)" v={aed(r.noi)} />
          {r.loanAmount > 0 && (
            <Row
              k="Annual debt service (int / principal)"
              v={`${aed(r.annualDebtService)} (${aed(r.annualInterestY1)} / ${aed(r.annualPrincipalY1)})`}
            />
          )}
          <Row k={`Annual net cash flow · ${r.incomeYears}y income`} v={aed(r.annualNetCashFlow)} />
          {r.dscr != null && (
            <Row k="DSCR (stress +2%)" v={`${r.dscr.toFixed(2)} (${r.stressedDscr?.toFixed(2) ?? "—"})`} flag={r.dscr < 1.15} />
          )}
          <Row k="Projected exit value" v={aed(r.exitValue)} />
          {r.unpaidToDeveloperAtExit > 0 && <Row k="Unpaid to developer at exit" v={aed(r.unpaidToDeveloperAtExit)} />}
          <Row k="Equity at exit (net of loan + sale)" v={aed(r.exitEquity)} />
          <Row k="Total profit" v={aed(r.totalProfit)} strong />
          <Row k="Total ROI · net yield" v={`${pct(r.roiPct)} · ${r.netYieldPct != null ? pct(r.netYieldPct) : "—"}`} />
        </div>

        {/* Off-plan payment schedule */}
        {r.schedule.length > 0 && (
          <details className="elevate overflow-hidden rounded-xl border border-ink-500 bg-ink-800/40" open>
            <summary className="cursor-pointer px-5 py-3 text-eyebrow">Payment schedule</summary>
            <div className="border-t border-ink-600">
              {r.schedule.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-2 text-sm">
                  <span className="text-paper-300">
                    <span className="text-paper-500">m{m.monthOffset}</span> · {m.label.replace(/ \(month \d+\)/, "")}
                  </span>
                  <span className="tnum text-paper-200">
                    {m.pct.toFixed(1)}% · {aed(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* How it's calculated */}
        <details className="elevate overflow-hidden rounded-xl border border-ink-500 bg-ink-800/40">
          <summary className="cursor-pointer px-5 py-3 text-eyebrow">How this is calculated</summary>
          <div className="space-y-0 border-t border-ink-600">
            <Formula k="Capital appreciation" f={`entry ${r.entryPricePerSqft ? Math.round(r.entryPricePerSqft).toLocaleString() + " AED/sqft" : aed(price)} compounded at ${r.effectiveAppreciationPct.toFixed(2)}%/yr for ${input.holdingYears}y`} v={`exit ${aed(r.exitValue)} (+${pct(r.appreciationTotalPct)})`} />
            <Formula k="Cash invested" f={dealType === "offplan" ? "payments made by exit + registration" : financed ? "down payment + costs + mortgage set-up" : "price + transaction costs"} v={aed(r.cashInvested)} />
            <Formula k="NOI" f={`(${pct(f.grossYieldPct)} gross rent × (1 − ${pct(f.vacancyPct ?? 5)} vacancy)) − service charge − mgmt − maintenance − insurance`} v={`${aed(r.noi)}/yr`} />
            {r.dscr != null && <Formula k="DSCR" f={`NOI ${aed(r.noi)} ÷ debt service ${aed(r.annualDebtService)}`} v={r.dscr.toFixed(2)} />}
            <Formula k="Equity at exit" f={`exit value − 2% sale costs${r.outstandingLoanAtExit > 0 ? " − outstanding loan " + aed(r.outstandingLoanAtExit) : ""}${r.unpaidToDeveloperAtExit > 0 ? " − unpaid to developer" : ""}`} v={aed(r.exitEquity)} />
            <Formula k="Total profit" f={`equity at exit ${aed(r.exitEquity)} + cumulative cash flow ${aed(r.cumulativeNetCashFlow)} − cash invested ${aed(r.cashInvested)}`} v={aed(r.totalProfit)} />
            <Formula k="ROI" f={`total profit ${aed(r.totalProfit)} ÷ cash invested ${aed(r.cashInvested)}`} v={pct(r.roiPct)} />
            <Formula k="Equity multiple" f={`(equity at exit + cumulative cash flow) ÷ cash invested`} v={`${r.equityMultiple.toFixed(2)}×`} />
            <Formula k="IRR" f="rate that discounts every dated cash flow (payments, rent, exit) to zero — timed monthly, annualised" v={r.irrPct != null ? pct(r.irrPct) : "—"} />
            {r.cashOnCashPct != null && <Formula k="Cash-on-cash" f={`(NOI − mortgage interest) ÷ cash invested — excludes principal (that is equity build)`} v={pct(r.cashOnCashPct)} />}
            {r.roeYear1Pct != null && <Formula k="ROE · year 1" f={`(net cash flow + principal paid + year-1 appreciation ${aed(price * (r.effectiveAppreciationPct / 100))}) ÷ cash invested`} v={pct(r.roeYear1Pct)} />}
            <Formula k="Net yield" f={`NOI ${aed(r.noi)} ÷ total acquisition ${aed(r.totalAcquisition)}`} v={r.netYieldPct != null ? pct(r.netYieldPct) : "—"} />
          </div>
        </details>

        <p className="text-xs text-paper-700">
          Assumptions: {r.assumptions.join(" · ")}. Returns are on actual capital
          invested. Figures are model outputs from your inputs, not guarantees.
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
            <div className="mt-4 space-y-2 whitespace-pre-line text-sm leading-relaxed text-paper-200">{verdict}</div>
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

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
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

function Stat({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <div className={`elevate rounded-xl border p-4 ${strong ? "border-accent-500/40 bg-accent-500/5" : "border-ink-500 bg-ink-800/40"}`}>
      <p className="text-[0.625rem] uppercase tracking-wider text-paper-500">{label}</p>
      <p className={`tnum mt-1 font-display text-2xl ${strong ? "text-accent-400" : "text-paper-100"}`}>{value ?? "—"}</p>
    </div>
  );
}

function Row({ k, v, strong, flag }: { k: string; v: string | null; strong?: boolean; flag?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-ink-600 px-5 py-3 last:border-b-0 ${strong ? "bg-ink-800/60" : ""}`}>
      <span className="text-sm text-paper-500">
        {k}
        {flag && <span className="ml-2 rounded-full border border-red-400/40 px-1.5 py-0.5 text-[0.5625rem] uppercase tracking-wider text-red-400/90">tight</span>}
      </span>
      <span className={`tnum text-sm ${flag ? "text-red-400" : strong ? "font-medium text-paper-100" : "text-paper-200"}`}>{v ?? "—"}</span>
    </div>
  );
}

/** One "how it's calculated" line: label, the formula in words with live numbers, and the result. */
function Formula({ k, f, v }: { k: string; f: string; v: string | null }) {
  return (
    <div className="border-b border-ink-600 px-5 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-paper-200">{k}</span>
        <span className="tnum text-sm text-accent-400">{v ?? "—"}</span>
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-paper-500">{f}</p>
    </div>
  );
}
