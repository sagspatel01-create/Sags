import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getForecast } from "@/lib/data/crm";
import { ForecastBars } from "@/components/crm/ForecastBars";
import { Card } from "@/components/ui/Card";
import { monthLabel } from "@/lib/crm";
import { aed } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const configured = isSupabaseConfigured();
  const { rows, undated, totalPipeline, totalWeighted } = configured
    ? await getForecast(6)
    : { rows: [], undated: { count: 0, gross: 0, weighted: 0 }, totalPipeline: 0, totalWeighted: 0 };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Loan disbursement by month</p>
          <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">Forecast</h1>
        </div>
        <Link href="/crm/settings" className="chip">Adjust targets</Link>
      </div>
      <p className="mt-3 max-w-2xl text-paper-300">
        Deals bucketed by the month they&apos;re expected to disburse — not when work started.
        Disbursed money is committed; open deals are weighted by probability. Target defaults to
        AED&nbsp;10M/month.
      </p>

      {!configured && (
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-300">Preview mode — connect Supabase to see the live forecast.</p>
        </Card>
      )}

      {/* Totals */}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-eyebrow">Total open pipeline</p>
          <p className="mt-1 font-display text-2xl text-paper-100">{aed(totalPipeline) ?? "—"}</p>
          <p className="mt-0.5 text-xs text-paper-700">gross loan value, all open deals</p>
        </Card>
        <Card className="p-4">
          <p className="text-eyebrow">Weighted pipeline</p>
          <p className="mt-1 font-display text-2xl text-paper-100">{aed(totalWeighted) ?? "—"}</p>
          <p className="mt-0.5 text-xs text-paper-700">probability-adjusted</p>
        </Card>
        <Card className="p-4">
          <p className="text-eyebrow">Undated deals</p>
          <p className="mt-1 font-display text-2xl text-paper-100">{undated.count}</p>
          <p className="mt-0.5 text-xs text-paper-700">
            {aed(undated.gross) ?? "—"} — set a close month to forecast them
          </p>
        </Card>
      </div>

      {/* Chart */}
      <Card className="mt-6 p-5">
        <ForecastBars rows={rows} />
      </Card>

      {/* Table */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-paper-700">
              <th className="py-2 pr-4">Month</th>
              <th className="py-2 pr-4 text-right">Target</th>
              <th className="py-2 pr-4 text-right">Committed</th>
              <th className="py-2 pr-4 text-right">Weighted</th>
              <th className="py-2 pr-4 text-right">Projected</th>
              <th className="py-2 pr-4 text-right">Gap</th>
              <th className="py-2 pr-4 text-right">Deals</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const projected = r.committed + r.weighted;
              const gap = projected - r.target;
              return (
                <tr key={r.month} className="border-t border-ink-500">
                  <td className="py-2 pr-4 text-paper-100">{monthLabel(r.month)}</td>
                  <td className="py-2 pr-4 text-right text-paper-500">{aed(r.target)}</td>
                  <td className="py-2 pr-4 text-right text-paper-300">{aed(r.committed)}</td>
                  <td className="py-2 pr-4 text-right text-paper-300">{aed(r.weighted)}</td>
                  <td className="py-2 pr-4 text-right text-paper-100">{aed(projected)}</td>
                  <td
                    className={`py-2 pr-4 text-right ${gap >= 0 ? "text-accent-400" : "text-paper-700"}`}
                  >
                    {gap >= 0 ? "+" : ""}
                    {aed(gap)}
                  </td>
                  <td className="py-2 pr-4 text-right text-paper-500">{r.dealCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
