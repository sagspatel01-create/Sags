"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import {
  normalizeRow,
  aggregate,
  matchCommunity,
  buildCommunityTxns,
  type DldRow,
  type Snapshot,
  type CommunityDetail,
} from "@/lib/sources/dld";
import { applyMarketSnapshots, applyMarketDetail, type ApplyMarketResult } from "@/app/actions/market";
import { aed, num } from "@/lib/format";

type Community = { id: string; name: string; slug: string };
type Sub = { id: string; name: string; slug: string; community_id: string };

export function DldImport({ communities, subs = [] }: { communities: Community[]; subs?: Sub[] }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "parsing" | "review" | "saving" | "done">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [details, setDetails] = useState<CommunityDetail[]>([]);
  const [considered, setConsidered] = useState(0);
  const [result, setResult] = useState<ApplyMarketResult | null>(null);
  const [detailResult, setDetailResult] = useState<{ communities: number; transactions: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parse(file: File) {
    setPhase("parsing");
    setError(null);
    setFileName(file.name);
    const rows: DldRow[] = [];
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      step: (r) => {
        const row = normalizeRow(r.data);
        if (row.price) rows.push(row);
      },
      complete: () => {
        const { snapshots, considered } = aggregate(rows, 6);
        const subsByCommunity = new Map<string, Sub[]>();
        for (const s of subs) {
          const arr = subsByCommunity.get(s.community_id) ?? [];
          arr.push(s);
          subsByCommunity.set(s.community_id, arr);
        }
        const { details } = buildCommunityTxns(rows, communities, subsByCommunity, 6);
        setSnapshots(snapshots);
        setDetails(details);
        setConsidered(considered);
        setPhase(snapshots.length ? "review" : "idle");
        if (!snapshots.length) setError("No villa/townhouse sales in the last 6 months found in this file.");
      },
      error: (e) => {
        setError(e.message);
        setPhase("idle");
      },
    });
  }

  async function apply() {
    setPhase("saving");
    const [r, d] = await Promise.all([
      applyMarketSnapshots(snapshots, "dld"),
      applyMarketDetail(details),
    ]);
    setResult(r);
    setDetailResult(d.ok ? { communities: d.communities, transactions: d.transactions } : null);
    setPhase(r.ok ? "done" : "review");
    if (!r.ok) setError(r.error ?? "Save failed.");
  }

  const mapped = snapshots.filter((s) => matchCommunity(s.groupName, communities));
  const unmapped = [...new Set(snapshots.filter((s) => !matchCommunity(s.groupName, communities)).map((s) => s.groupName))];

  return (
    <div className="mt-8 space-y-5">
      <div className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-6">
        <p className="text-eyebrow">DLD transactions CSV</p>
        <p className="mt-1 text-sm text-paper-500">
          Upload a DLD / Dubai Pulse transactions export (or a DXB Interact CSV).
          It&apos;s parsed in your browser — nothing uploads until you apply —
          filtered to villa &amp; townhouse <b>sales</b> in the last 6 months,
          then aggregated per community.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) parse(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => inputRef.current?.click()} disabled={phase === "parsing" || phase === "saving"} className="btn-primary text-sm disabled:opacity-50">
            {phase === "parsing" ? "Reading…" : "Upload DLD CSV"}
          </button>
          {fileName && <span className="text-xs text-paper-500">{fileName}</span>}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {phase === "review" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-paper-300"><b className="tnum text-paper-100">{num(considered)}</b> villa/TH sales</span>
            <span className="text-paper-300"><b className="tnum text-paper-100">{mapped.length}</b> snapshots matched</span>
            <span className="text-paper-300"><b className="tnum text-paper-100">{details.reduce((s, d) => s + d.txns.length, 0)}</b> txns → {details.length} communit{details.length === 1 ? "y" : "ies"} (trends)</span>
            {unmapped.length > 0 && <span className="text-paper-500">{unmapped.length} area(s) unmapped</span>}
          </div>

          <div className="elevate overflow-x-auto rounded-xl border border-ink-500">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs text-paper-500">
                  {["Area / project", "Type", "Reg", "Txns", "Avg price", "Median", "AED/sqft"].map((h) => (
                    <th key={h} className="border-b border-ink-500 bg-ink-850 px-4 py-2.5 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => {
                  const m = matchCommunity(s.groupName, communities);
                  return (
                    <tr key={i} className={m ? "" : "opacity-45"}>
                      <td className="border-b border-ink-600 px-4 py-2.5 text-paper-200">
                        {s.groupName}{!m && <span className="ml-2 text-[0.625rem] uppercase tracking-wider text-paper-700">unmapped</span>}
                      </td>
                      <td className="border-b border-ink-600 px-4 py-2.5 capitalize text-paper-400">{s.unit_type}</td>
                      <td className="border-b border-ink-600 px-4 py-2.5 capitalize text-paper-400">{s.reg_type}</td>
                      <td className="tnum border-b border-ink-600 px-4 py-2.5 text-paper-200">{s.txn_count}</td>
                      <td className="tnum border-b border-ink-600 px-4 py-2.5 text-paper-200">{aed(s.avg_price)}</td>
                      <td className="tnum border-b border-ink-600 px-4 py-2.5 text-paper-400">{aed(s.median_price)}</td>
                      <td className="tnum border-b border-ink-600 px-4 py-2.5 text-paper-200">{s.avg_price_per_sqft ? num(s.avg_price_per_sqft) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={apply} className="btn-primary text-sm">Apply {mapped.length} to engine</button>
            <button onClick={() => setPhase("idle")} className="text-sm text-paper-500 hover:text-paper-200">Discard</button>
            <span className="text-xs text-paper-700">Replaces prior DLD snapshots for these communities (rolling refresh).</span>
          </div>
        </div>
      )}

      {phase === "done" && result?.ok && (
        <div className="elevate rounded-xl border border-status-ready/40 bg-status-ready/5 p-6">
          <p className="text-eyebrow text-status-ready">Market data updated</p>
          <p className="mt-2 text-paper-100">
            Wrote {result.applied} snapshot{result.applied === 1 ? "" : "s"} across {result.communities} communit{result.communities === 1 ? "y" : "ies"}.
            {detailResult ? ` Stored ${num(detailResult.transactions)} transactions for interactive trends across ${detailResult.communities} communit${detailResult.communities === 1 ? "y" : "ies"}.` : ""}
            {result.unmapped.length ? ` ${result.unmapped.length} area(s) unmapped.` : ""}
          </p>
          {result.unmapped.length > 0 && (
            <p className="mt-2 text-xs text-paper-500">Unmapped: {result.unmapped.join(", ")}. Add these as communities (or refine the name) and re-import.</p>
          )}
          <button onClick={() => { setPhase("idle"); setSnapshots([]); setResult(null); setFileName(null); }} className="btn-primary mt-4 text-sm">Import another</button>
        </div>
      )}
    </div>
  );
}
