import { Empty } from "./Empty";

export type Fact = {
  label: string;
  value: string | number | null | undefined;
};

/**
 * Label/value grid mirroring a portal listing block. Missing values render
 * as visibly empty (never fabricated).
 */
export function FactList({
  facts,
  columns = 2,
}: {
  facts: Fact[];
  columns?: 1 | 2 | 3;
}) {
  const cols =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-2 md:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2";
  return (
    <dl className={`grid ${cols} gap-x-8 gap-y-4`}>
      {facts.map((f) => (
        <div
          key={f.label}
          className="flex items-baseline justify-between gap-4 border-b border-ink-500/60 pb-2"
        >
          <dt className="text-sm text-paper-500">{f.label}</dt>
          <dd className="text-right text-sm text-paper-100">
            {f.value === null || f.value === undefined || f.value === "" ? (
              <Empty />
            ) : (
              f.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
