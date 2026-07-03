/**
 * Empty-value marker. Hard rule from the brief: never fabricate data;
 * empty fields render as *visibly* empty. Use this everywhere a real
 * value is not yet present instead of inventing a placeholder number.
 */
export function Empty({ label = "No data yet" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-paper-700">
      <span className="h-px w-3 bg-paper-700" aria-hidden />
      <span className="text-xs italic">{label}</span>
    </span>
  );
}

/** Render a value, or the Empty marker when it is null/undefined/"". */
export function ValueOrEmpty({
  value,
  suffix = "",
  emptyLabel,
}: {
  value: string | number | null | undefined;
  suffix?: string;
  emptyLabel?: string;
}) {
  if (value === null || value === undefined || value === "") {
    return <Empty label={emptyLabel} />;
  }
  return (
    <span>
      {value}
      {suffix}
    </span>
  );
}
