import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getTargets } from "@/lib/data/crm";
import { setTarget } from "@/app/actions/crm";
import { Card } from "@/components/ui/Card";
import { DEFAULT_MONTHLY_TARGET, monthRange, monthLabel } from "@/lib/crm";
import { aed } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CrmSettingsPage() {
  const configured = isSupabaseConfigured();
  const targets = configured ? await getTargets() : new Map<string, number>();
  const months = monthRange(new Date(), 12);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
      <Link href="/crm/forecast" className="text-sm text-accent-400 hover:text-accent-500">← Forecast</Link>
      <h1 className="mt-4 font-display text-4xl text-paper-100 md:text-5xl">Monthly targets</h1>
      <p className="mt-3 max-w-2xl text-paper-300">
        The disbursement goal each month is compared against on the forecast. Default is
        {" "}{aed(DEFAULT_MONTHLY_TARGET)} — raise a month as goals grow.
      </p>

      {!configured && (
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-300">Preview mode — connect Supabase to save targets.</p>
        </Card>
      )}

      <div className="mt-8 space-y-2">
        {months.map((m) => {
          const current = targets.get(m) ?? DEFAULT_MONTHLY_TARGET;
          return (
            <Card key={m} className="p-3">
              <form action={setTarget} className="flex flex-wrap items-center justify-between gap-3">
                <input type="hidden" name="month" value={m} />
                <span className="min-w-[9rem] text-sm text-paper-100">{monthLabel(m)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-paper-700">AED</span>
                  <input
                    name="target_amount"
                    defaultValue={current}
                    className="input w-40 text-right"
                    inputMode="numeric"
                  />
                  <button className="seg">Save</button>
                </div>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
