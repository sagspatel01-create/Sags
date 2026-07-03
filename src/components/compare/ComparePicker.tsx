"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface PickerOption {
  slug: string;
  name: string;
  developer: string | null;
  status: string;
  tier: string | null;
}

const MAX = 4;

export function ComparePicker({
  options,
  selected,
}: {
  options: PickerOption[];
  selected: string[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(selected);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(selected.length === 0);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return options.filter(
      (o) =>
        !query ||
        o.name.toLowerCase().includes(query) ||
        (o.developer ?? "").toLowerCase().includes(query),
    );
  }, [options, q]);

  function toggle(slug: string) {
    setSel((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX
          ? prev
          : [...prev, slug],
    );
  }

  function apply() {
    if (sel.length < 2) return;
    router.push(`/compare?ids=${sel.join(",")}`);
    setOpen(false);
  }

  const dirty = sel.join(",") !== selected.join(",");

  return (
    <div className="rounded-xl border border-ink-500 bg-ink-850">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="text-eyebrow">Selection</p>
          <p className="mt-0.5 text-sm text-paper-300">
            {sel.length === 0
              ? "Choose 2–4 communities to compare"
              : `${sel.length} selected${sel.length < 2 ? " · pick at least 2" : ""}`}
          </p>
        </div>
        <span className="text-paper-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-ink-500 p-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search communities or developers…"
            className="input mb-4"
          />
          <div className="grid max-h-72 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
            {filtered.map((o) => {
              const on = sel.includes(o.slug);
              const full = !on && sel.length >= MAX;
              return (
                <button
                  key={o.slug}
                  onClick={() => toggle(o.slug)}
                  disabled={full}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                    on
                      ? "border-accent-500 bg-accent-500/10"
                      : "border-ink-500 bg-ink-800/40 hover:bg-ink-700"
                  } ${full ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-paper-100">
                      {o.name}
                    </span>
                    <span className="block truncate text-xs text-paper-500">
                      {o.developer ?? "—"}
                      {o.tier ? ` · ${o.tier}` : ""}
                    </span>
                  </span>
                  <span
                    className={`ml-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[0.625rem] ${
                      on
                        ? "border-accent-500 bg-accent-500 text-ink-900"
                        : "border-ink-500"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-ink-500 pt-4">
            <button
              onClick={apply}
              disabled={sel.length < 2 || !dirty}
              className="btn-primary disabled:opacity-40"
            >
              Compare {sel.length >= 2 ? `${sel.length} communities` : ""}
            </button>
            {sel.length > 0 && (
              <button
                onClick={() => setSel([])}
                className="text-xs text-paper-500 hover:text-paper-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
