import Link from "next/link";
import { Empty } from "@/components/ui/Empty";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CompareModel, BudgetFit } from "@/lib/compare-model";
import type { StatusTag } from "@/lib/db/types";

const FIT_STYLE: Record<Exclude<BudgetFit, null>, { label: string; cls: string }> = {
  in: { label: "In budget range", cls: "border-status-ready/50 bg-status-ready/10 text-status-ready" },
  above: { label: "Above range", cls: "border-status-offplan/50 bg-status-offplan/10 text-status-offplan" },
  below: { label: "Below range", cls: "border-ink-500 bg-ink-800 text-paper-500" },
};

export function ComparisonTable({ model }: { model: CompareModel }) {
  const { columns, groups } = model;
  const colCount = columns.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-500">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-[190px] border-b border-r border-ink-500 bg-ink-850 px-4 py-4 text-left align-bottom">
              <span className="text-eyebrow">Comparison</span>
            </th>
            {columns.map((col) => (
              <th
                key={col.slug}
                className="sticky top-0 z-20 min-w-[230px] border-b border-r border-ink-500 bg-ink-850 px-4 py-4 text-left align-bottom last:border-r-0"
              >
                <Link
                  href={`/communities/${col.slug}`}
                  className="font-display text-lg leading-tight text-paper-100 hover:text-white"
                >
                  {col.name}
                </Link>
                <p className="mt-0.5 text-xs text-paper-500">
                  {col.developerName ?? "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={col.status.toLowerCase() as StatusTag} />
                  {col.tierLabel && (
                    <span className="rounded-full border border-ink-500 px-2 py-0.5 text-[0.625rem] text-paper-300">
                      {col.tierLabel}
                    </span>
                  )}
                </div>
                {col.budgetFit && (
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[0.625rem] ${FIT_STYLE[col.budgetFit].cls}`}
                  >
                    {FIT_STYLE[col.budgetFit].label}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {groups.map((g) => (
            <GroupRows key={g.key} group={g} colCount={colCount} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  group,
  colCount,
}: {
  group: CompareModel["groups"][number];
  colCount: number;
}) {
  return (
    <>
      {/* Group band */}
      <tr>
        <td
          colSpan={colCount + 1}
          className={`sticky left-0 z-10 border-b border-ink-500 px-4 py-2.5 ${
            group.highlighted ? "bg-accent-500/10" : "bg-ink-800/60"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-paper-700">
              {String(group.index).padStart(2, "0")}
            </span>
            <span className="font-display text-base text-paper-100">
              {group.title}
            </span>
            {group.highlighted && (
              <span className="rounded-full border border-accent-600/60 bg-accent-500/15 px-2 py-0.5 text-[0.5625rem] uppercase tracking-wider text-accent-400">
                Client priority
              </span>
            )}
          </div>
        </td>
      </tr>

      {group.rows.map((r, ri) => (
        <tr key={ri} className="align-top">
          <th className="sticky left-0 z-10 border-b border-r border-ink-500 bg-ink-900 px-4 py-3 text-left text-xs font-normal text-paper-500">
            {r.label}
          </th>
          {r.cells.map((cell, ci) => (
            <td
              key={ci}
              className="border-b border-r border-ink-500 px-4 py-3 text-paper-200 last:border-r-0"
            >
              {cell === null || cell === undefined || cell === "" ? (
                <Empty />
              ) : r.kind === "para" ? (
                <p className="max-w-[40ch] whitespace-pre-line text-sm leading-relaxed text-paper-300">
                  {cell}
                </p>
              ) : (
                <span>{cell}</span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
