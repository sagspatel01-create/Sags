"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TIER_LABEL } from "@/lib/format";
import type { StatusTag, PositioningTier } from "@/lib/db/types";

export interface ResultRow {
  id: string;
  name: string;
  slug: string;
  status: StatusTag;
  tier: PositioningTier | null;
  developerName: string | null;
  subCount: number;
  tags: string[];
  fit: number | null;
  inBudget: boolean;
}

const MAX_COMPARE = 4;

export function BrowseResults({ rows }: { rows: ResultRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(slug: string) {
    setSelected((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, slug],
    );
  }

  return (
    <div className="relative">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-500 p-12 text-center">
          <p className="text-eyebrow">Nothing matches</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-paper-500">
            Loosen a filter — or clear all to see the full catalogue.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const on = selected.includes(r.slug);
            return (
              <div
                key={r.id}
                className={`group relative rounded-xl border bg-ink-800/50 p-5 transition-colors ${
                  on ? "border-accent-500" : "border-ink-500 hover:bg-ink-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/communities/${r.slug}`}
                    className="font-display text-lg leading-tight text-paper-100 group-hover:text-white"
                  >
                    {r.name}
                  </Link>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-2 text-xs text-paper-500">
                  {r.developerName ?? "—"}
                  {r.tier ? ` · ${TIER_LABEL[r.tier]}` : ""} · {r.subCount}{" "}
                  sub-communit{r.subCount === 1 ? "y" : "ies"}
                </p>

                {r.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {r.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-ink-500 px-2 py-0.5 text-[0.5625rem] uppercase tracking-wider text-paper-500"
                      >
                        {t.replace(/-/g, " ")}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  {r.fit != null ? (
                    <span className="flex items-center gap-2">
                      <span className="text-[0.625rem] uppercase tracking-wider text-paper-700">
                        Fit
                      </span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-600">
                        <span
                          className="block h-full bg-accent-500"
                          style={{ width: `${r.fit}%` }}
                        />
                      </span>
                      <span className="font-mono text-xs text-accent-400">
                        {r.fit}
                      </span>
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => toggle(r.slug)}
                    className={`rounded-md border px-2.5 py-1 text-[0.625rem] uppercase tracking-wider transition-colors ${
                      on
                        ? "border-accent-500 bg-accent-500 text-ink-900"
                        : "border-ink-500 text-paper-500 hover:text-paper-100"
                    }`}
                  >
                    {on ? "Added" : "Compare"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compare tray */}
      {selected.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-4 rounded-xl border border-accent-600/60 bg-ink-850/95 px-5 py-3 backdrop-blur">
          <p className="text-sm text-paper-300">
            <span className="font-mono text-paper-100">{selected.length}</span>{" "}
            selected {selected.length < 2 && "· pick at least 2"}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelected([])}
              className="text-xs text-paper-500 hover:text-paper-200"
            >
              Clear
            </button>
            <button
              disabled={selected.length < 2}
              onClick={() =>
                router.push(`/compare?ids=${selected.join(",")}`)
              }
              className="btn-primary text-xs disabled:opacity-40"
            >
              Compare →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
