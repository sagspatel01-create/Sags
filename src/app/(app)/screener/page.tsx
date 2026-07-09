import { isSupabaseConfigured } from "@/lib/env";
import { getScreenerRows, SCREENER_ASSUMPTIONS as A } from "@/lib/data/screener";
import { ScreenerTable } from "@/components/screener/ScreenerTable";
import { NotConfigured } from "@/components/community/NotConfigured";
import { Empty } from "@/components/ui/Empty";

export const dynamic = "force-dynamic";

export default async function ScreenerPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const rows = await getScreenerRows();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">Investor screener</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        Where capital works hardest
      </h1>
      <p className="mt-4 max-w-3xl text-paper-300">
        Every community with live DLD transaction data, ranked by an{" "}
        <span className="text-paper-100">identical-assumption underwrite</span>.
        Each community&apos;s own median sale price and recent price trend are
        its real, DLD-sourced figures; the financing and operating assumptions
        are held the same across every row, so the comparison is fair — not a
        black box. Sort any column; click a name for the full dossier.
      </p>

      {/* Disclosed assumptions */}
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-ink-700 bg-ink-900/40 px-4 py-3 text-xs text-ink-500">
        <span className="text-paper-300">Held-constant assumptions:</span>
        <span>{A.holdingYears}-yr hold</span>
        <span>{A.grossYieldPct}% gross yield</span>
        <span>{A.ltvPct}% LTV @ {A.mortgageRatePct}% / {A.mortgageTenorYears}y</span>
        <span>{A.dldPct}% DLD + {A.agencyPct}% agency</span>
        <span>{A.vacancyPct}% vacancy</span>
        <span>appreciation clamped {A.apprMinPct}…{A.apprMaxPct}%</span>
      </div>

      <div className="mt-8">
        {rows.length === 0 ? (
          <div className="space-y-3">
            <Empty label="No live market data yet" />
            <p className="max-w-xl text-sm text-ink-500">
              Communities appear here once DLD transaction data is loaded (the
              Bayut/DLD pull or Absorb). Prices are never assumed — a community
              with no sourced data is not ranked.
            </p>
          </div>
        ) : (
          <ScreenerTable rows={rows} />
        )}
      </div>
    </div>
  );
}
