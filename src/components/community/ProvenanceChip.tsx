type Confidence = "high" | "medium" | "low" | "unverified" | null;

const META: Record<
  "high" | "medium" | "low",
  { label: string; dot: string; text: string }
> = {
  high: { label: "High confidence", dot: "bg-status-ready", text: "text-status-ready" },
  medium: { label: "Medium confidence", dot: "bg-status-offplan", text: "text-status-offplan" },
  low: { label: "Low confidence", dot: "bg-status-mixed", text: "text-status-mixed" },
};

/**
 * Small honesty badge: shows how firm a community's data is (high/medium/low)
 * and, on hover, where it came from. Rendered only for graded rows — curated
 * copy that predates the provenance system (unverified/null) shows nothing
 * rather than a scary "unverified" label. Pure CSS tooltip, SSR-safe.
 */
export function ProvenanceChip({
  confidence,
  sourceNote,
}: {
  confidence: Confidence;
  sourceNote: string | null;
}) {
  if (confidence !== "high" && confidence !== "medium" && confidence !== "low") {
    return null;
  }
  const m = META[confidence];
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-500 bg-ink-800/60 px-2.5 py-1 text-[0.6875rem] font-medium tracking-wide text-paper-300">
        <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
        <span className={m.text}>{m.label}</span>
        {sourceNote && <span className="text-paper-600">· source</span>}
      </span>
      {sourceNote && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 origin-top-left scale-95 rounded-lg border border-ink-500 bg-ink-900 p-3 text-xs leading-relaxed text-paper-300 opacity-0 shadow-xl shadow-black/40 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
        >
          <span className="mb-1 block text-[0.625rem] uppercase tracking-wider text-paper-600">
            Data provenance
          </span>
          {sourceNote}
        </span>
      )}
    </span>
  );
}
