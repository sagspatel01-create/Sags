import type { ReactNode } from "react";

/** Server-safe form primitives for the admin surface (plain inputs). */

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-paper-300">
        {label}
        {hint && <span className="ml-2 text-paper-700">{hint}</span>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="input py-2 text-sm"
      />
    </label>
  );
}

export function Textarea({
  label,
  name,
  defaultValue,
  rows = 4,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-paper-300">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        className="input resize-none py-2 text-sm leading-relaxed"
      />
    </label>
  );
}

export function Select({
  label,
  name,
  defaultValue,
  options,
  allowEmpty,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  allowEmpty?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-paper-300">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="input py-2 text-sm"
      >
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-paper-300">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-ink-500 bg-ink-800 accent-[var(--accent-500)]"
      />
      {label}
    </label>
  );
}

export function SaveBar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-ink-500 pt-4">
      <button type="submit" className="btn-primary text-sm">
        Save changes
      </button>
      {children}
    </div>
  );
}

export const STATUS_OPTIONS = [
  { value: "ready", label: "Ready" },
  { value: "offplan", label: "Offplan" },
  { value: "mixed", label: "Mixed" },
];
export const TIER_OPTIONS = [
  { value: "ultra_prime", label: "Ultra-prime" },
  { value: "prime", label: "Prime" },
  { value: "premium", label: "Premium" },
  { value: "mid", label: "Mid-market" },
  { value: "accessible", label: "Accessible" },
];
export const UNIT_OPTIONS = [
  { value: "villa", label: "Villa" },
  { value: "townhouse", label: "Townhouse" },
];
export const KITCHEN_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "semi_open", label: "Semi-open" },
];
export const FURNISH_OPTIONS = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi-furnished" },
  { value: "furnished", label: "Furnished" },
];
