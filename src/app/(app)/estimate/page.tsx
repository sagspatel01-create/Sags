import { isSupabaseConfigured } from "@/lib/env";
import { getEstimateCatalogue } from "@/lib/data/estimate";
import { EstimateTool } from "@/components/estimate/EstimateTool";
import { NotConfigured } from "@/components/community/NotConfigured";
import { HowItWorks } from "@/components/ui/HowItWorks";

export const dynamic = "force-dynamic";

export default async function EstimatePage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const catalogue = await getEstimateCatalogue();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">Valuation</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">Estimate</h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        A comparable-based value estimate for any specific villa or townhouse —
        our answer to a TruEstimate report. Pick the community, cluster and unit
        spec, and the engine values it from real DLD-registered sales nearby,
        with a confidence range, a price-trend, an indicative rental, the full
        cost-to-buy, and the comparables it used. Never an assumed price.
      </p>

      <HowItWorks
        items={[
          {
            q: "How is the value calculated?",
            a: "Like a surveyor's comparable method: it takes the DLD-registered sales in that community — preferring the same cluster and bedroom count — uses their median price-per-sqft as the base, multiplies by built-up area, then applies disclosed adjustments for condition, view and furnishing.",
          },
          {
            q: "What does the confidence / range mean?",
            a: "The more real comparable sales we hold for that exact cluster + bedroom, the tighter the range and higher the confidence (≥8 comps = high ±4%, ≥3 = medium ±7%, otherwise low ±12% off the community average). The range is honest uncertainty, not decoration.",
          },
          {
            q: "What are the condition / view / furnishing adjustments?",
            a: "Disclosed model factors on top of the comparable base — e.g. high-end upgrade +10%, golf/lagoon view +5%, fully furnished +3%. They're shown line-by-line in the report so nothing is hidden.",
          },
          {
            q: "Where does the data come from?",
            a: "Real DLD-registered transactions held in the engine. A community with no DLD data can't be valued — the tool says so rather than inventing a number.",
          },
        ]}
      />

      {catalogue.length === 0 ? (
        <p className="mt-8 text-sm text-paper-500">No communities loaded yet.</p>
      ) : (
        <EstimateTool catalogue={catalogue} />
      )}
    </div>
  );
}
