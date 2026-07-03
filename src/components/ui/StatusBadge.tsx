import type { StatusTag } from "@/lib/db/types";

const LABEL: Record<StatusTag, string> = {
  ready: "Ready",
  offplan: "Offplan",
  mixed: "Mixed",
};

const DOT: Record<StatusTag, string> = {
  ready: "bg-status-ready",
  offplan: "bg-status-offplan",
  mixed: "bg-status-mixed",
};

/** Ready / Offplan / Mixed tag — used at every taxonomy level. */
export function StatusBadge({ status }: { status: StatusTag }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-500 bg-ink-800/60 px-2.5 py-1 text-[0.6875rem] font-medium tracking-wide text-paper-300">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
    </span>
  );
}
