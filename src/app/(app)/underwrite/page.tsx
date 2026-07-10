import { isSupabaseConfigured } from "@/lib/env";
import { getDealOptions } from "@/lib/data/deals";
import { Underwriter } from "@/components/underwrite/Underwriter";
import { NotConfigured } from "@/components/community/NotConfigured";
import { HowItWorks } from "@/components/ui/HowItWorks";

export const dynamic = "force-dynamic";

export default async function UnderwritePage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const deals = await getDealOptions();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">Investment underwriting</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        Underwrite
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        Model any deal — ready or offplan. Pick a priced unit (or enter it),
        set the payment plan or mortgage, and the engine computes the full
        investor picture: cash in, projected exit, cash flow, equity multiple
        and returns. Then Claude reads the numbers and gives a buy-side verdict.
      </p>

      <HowItWorks
        intro="Every number is derived deterministically from your inputs and the stated assumptions — nothing is guessed. Returns are always expressed on the actual capital you deploy. Open “How this is calculated” under the results to see each metric's live formula."
        items={[
          {
            q: "Ready vs off-plan — what changes?",
            a: "Ready (secondary) purchases carry DLD 4% + a brokerage agency fee (typ. 2%). Off-plan bought from the developer carries DLD/Oqood registration but no agency fee — and instead of a mortgage you set a payment plan (a % during construction, a % at handover, and optionally a post-handover tail), each instalment timed to when it's actually paid.",
          },
          {
            q: "How do I model financing?",
            a: "For ready deals choose Cash, Mortgage (enter your own down-payment %), Equity release, or Buyout (enter the actual loan amount for the last two). Rate and tenor are yours to set. Cash-invested, debt service and DSCR all follow from that.",
          },
          {
            q: "Capital appreciation & price-per-sqft",
            a: "Enter built-up area and the engine shows entry AED/sqft. Either set an annual appreciation %, or enter a target exit AED/sqft (e.g. 1,700 → 2,200) and the engine derives the implied annual rate. The projected exit value grows the price by that rate over your hold.",
          },
          {
            q: "IRR, ROI, ROE, cash-on-cash — what's the difference?",
            a: "ROI is total profit ÷ cash invested over the whole hold. IRR is the time-weighted rate that accounts for when each cash flow lands (computed on a monthly vector, so a “5% after 10 months” milestone is timed correctly). Cash-on-cash is annual cash yield excluding principal. ROE (yr 1) adds principal build + appreciation to that. Each is spelled out with live numbers in “How this is calculated”.",
          },
        ]}
      />

      {deals.length === 0 ? (
        <p className="mt-8 max-w-2xl rounded-lg border border-ink-500 bg-ink-800/50 p-4 text-sm text-paper-500">
          No priced units yet. Add pricing via Admin or Absorb a price list, then
          any unit becomes an underwritable deal here. You can still model a deal
          manually below.
        </p>
      ) : null}

      <Underwriter deals={deals} />
    </div>
  );
}
