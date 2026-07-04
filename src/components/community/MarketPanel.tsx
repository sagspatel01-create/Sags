import type { MarketSnapshot } from "@/lib/data/communities";
import { aed, num } from "@/lib/format";

/**
 * Community market read from DLD transactions (last-6-month window). Shows a
 * row per unit type × registration (ready/offplan) with real average
 * price/sqft, median, and transaction count. Empty until a DLD import or the
 * weekly sync populates it.
 */
export function MarketPanel({ snapshots }: { snapshots: MarketSnapshot[] }) {
  if (!snapshots || snapshots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-500 bg-ink-800/40 p-5 text-sm text-paper-500">
        No DLD transactions loaded for this community yet. Import a DLD /
        Dubai Pulse CSV in Admin → Transactions, or connect the weekly API sync.
      </p>
    );
  }

  const rows = [...snapshots].sort(
    (a, b) => (b.txn_count ?? 0) - (a.txn_count ?? 0),
  );
  const asOf = snapshots.map((s) => s.as_of).sort().at(-1);

  return (
    <div>
      <div className="elevate overflow-x-auto rounded-xl border border-ink-500">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs text-paper-500">
              {["Segment", "Txns", "Avg price/sqft", "Median price", "Range"].map((h) => (
                <th key={h} className="border-b border-ink-500 bg-ink-850 px-4 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="border-b border-ink-600 px-4 py-3 text-paper-200">
                  <span className="capitalize">{s.unit_type ?? "—"}</span>
                  {s.reg_type && (
                    <span className="ml-2 rounded-full border border-ink-500 px-2 py-0.5 text-[0.625rem] uppercase tracking-wider text-paper-500">
                      {s.reg_type}
                    </span>
                  )}
                </td>
                <td className="tnum border-b border-ink-600 px-4 py-3 text-paper-200">{s.txn_count ?? "—"}</td>
                <td className="tnum border-b border-ink-600 px-4 py-3 text-paper-100">
                  {s.avg_price_per_sqft ? `AED ${num(s.avg_price_per_sqft)}` : "—"}
                </td>
                <td className="tnum border-b border-ink-600 px-4 py-3 text-paper-300">{aed(s.median_price) ?? "—"}</td>
                <td className="tnum border-b border-ink-600 px-4 py-3 text-paper-500">
                  {s.min_price && s.max_price ? `${aed(s.min_price)} – ${aed(s.max_price)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-paper-700">
        Source: Dubai Land Department (DLD) transactions{asOf ? ` · as of ${asOf}` : ""}. Trailing 6-month window.
      </p>
    </div>
  );
}
