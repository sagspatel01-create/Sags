import { isSupabaseConfigured } from "@/lib/env";
import { getScreenerRows, SCREENER_ASSUMPTIONS as A } from "@/lib/data/screener";
import { ScreenerTable } from "@/components/screener/ScreenerTable";
import { NotConfigured } from "@/components/community/NotConfigured";
import { Empty } from "@/components/ui/Empty";
import { HowItWorks } from "@/components/ui/HowItWorks";

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

      <HowItWorks
        intro="The screener answers one question: across every community we hold real transaction data for, where is capital best deployed right now? It runs the same underwriting model on each community's own real numbers, so the ranking is a fair, like-for-like comparison."
        items={[
          {
            q: "Where does the data come from?",
            a: "Every price figure is a real DLD-registered transaction (pulled via the Bayut/DLD feed), stored per community. No prices are assumed or invented — a community with no sourced transaction data simply doesn't appear on this page.",
          },
          {
            q: "What is the “6-mo median” and “AED/sqft”?",
            a: "The median sale price and average price-per-sqft of that community's DLD-registered villa/townhouse transactions over the last ~6 months. Median (not average) so a handful of trophy sales don't distort the typical deal.",
          },
          {
            q: "What is the “6-mo Δ” (appreciation)?",
            a: "The recent price trend in that community's DLD transactions over the window, expressed as an annual rate and used as the appreciation input to its underwrite. Because a short window can be noisy, it's clamped to a defensible band (" + A.apprMinPct + "% … " + A.apprMaxPct + "%) so a spike can't annualise to an absurd number.",
          },
          {
            q: "What is “Liquidity”?",
            a: "The count of DLD-registered sales in the window — a direct proxy for how easily you can enter and exit. More transactions = deeper demand, faster resale, tighter pricing. It's 40% of the composite score.",
          },
          {
            q: "How is the “Ind. IRR / net yield / DSCR” calculated?",
            a: <>Each community's median price is run through the same underwriting engine used on the Underwrite page, under one <span className="text-paper-300">identical set of assumptions</span> held constant across every row: {A.holdingYears}-yr hold, {A.grossYieldPct}% gross yield, {A.ltvPct}% LTV @ {A.mortgageRatePct}% over {A.mortgageTenorYears}y, {A.dldPct}% DLD + {A.agencyPct}% agency, {A.vacancyPct}% vacancy. Only the price and appreciation change between rows — so differences in the output reflect the market, not the assumptions.</>,
          },
          {
            q: "What does the Score mean?",
            a: "A 0–100 composite: 60% the community's indicative-IRR percentile (return) + 40% its liquidity percentile (how tradeable it is). It ranks risk-adjusted opportunity — strong return that you can actually get in and out of. Green ≥ 75, amber ≥ 45.",
          },
          {
            q: "Why is DSCR often the same / below 1.15?",
            a: "DSCR (net operating income ÷ annual debt service) depends on yield, LTV and rate — all held constant here — so it's similar across communities and, at a 5% gross yield with 75% leverage, sits below 1.15. That's an honest signal: Dubai villas are appreciation-led plays, not rent-covers-the-mortgage cashflow plays. Load real per-community rental yields and it becomes a live differentiator.",
          },
        ]}
      />

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
