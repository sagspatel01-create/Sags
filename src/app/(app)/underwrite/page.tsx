import { isSupabaseConfigured } from "@/lib/env";
import { getDealOptions } from "@/lib/data/deals";
import { Underwriter } from "@/components/underwrite/Underwriter";
import { NotConfigured } from "@/components/community/NotConfigured";

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
