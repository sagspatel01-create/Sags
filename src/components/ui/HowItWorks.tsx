/**
 * Reusable "How this works" disclosure — a consistent, collapsible explainer
 * that every page can drop in to make its method transparent (what it is, how
 * it's calculated, where the data comes from). Server-safe (no client JS).
 */
export interface HowItWorksItem {
  q: string;
  a: React.ReactNode;
}

export function HowItWorks({
  title = "How this works",
  intro,
  items,
}: {
  title?: string;
  intro?: React.ReactNode;
  items: HowItWorksItem[];
}) {
  return (
    <details className="group mt-6 overflow-hidden rounded-xl border border-ink-700 bg-ink-900/40">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-sm font-medium text-paper-200 transition hover:text-paper-100">
        <span className="inline-flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-ink-600 text-[0.6875rem] text-ink-500">
            ?
          </span>
          {title}
        </span>
        <span className="text-ink-500 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-ink-700 px-5 py-4">
        {intro && <p className="mb-4 text-sm leading-relaxed text-paper-300">{intro}</p>}
        <dl className="space-y-4">
          {items.map((it, i) => (
            <div key={i}>
              <dt className="text-sm font-medium text-paper-100">{it.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-500">{it.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
