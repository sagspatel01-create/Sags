import { sourceRegistry } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

const CADENCE_LABEL: Record<string, string> = {
  weekly: "Weekly",
  daily: "Daily",
  manual: "Manual",
};

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">Data sources</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        Swappable modules
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        Every external source is an isolated module — one breaking never takes
        the tool down. Phase 1 runs no ingestion; data is entered via Admin.
        Real fetchers land in Phase 2 (DLD-led for transactions), widening
        coverage over time.
      </p>

      <div className="mt-8 divide-y divide-ink-500 overflow-hidden rounded-xl border border-ink-500">
        {sourceRegistry.map((s) => (
          <div key={s.key} className="bg-ink-800/40 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-paper-100">{s.label}</p>
                <p className="text-xs text-paper-500">
                  {s.category} · {CADENCE_LABEL[s.cadence] ?? s.cadence}
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[0.625rem] uppercase tracking-wider ${
                  s.implemented
                    ? "border-status-ready/50 bg-status-ready/10 text-status-ready"
                    : "border-ink-500 text-paper-700"
                }`}
              >
                {s.implemented ? "Live" : "Phase 2"}
              </span>
            </div>
            {s.notes && (
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-paper-500">
                {s.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
