"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { askEngine, type AskSource, type WebSource, type CommunityCard } from "@/app/actions/ask";
import { aed, pct } from "@/lib/format";

const SUGGESTIONS = [
  "Give me everything about Dubai Hills Estate",
  "What unit types are in Tilal Al Ghaf?",
  "Which communities does Emaar have?",
  "Compare The Valley and Arabian Ranches for a family under AED 10M",
];

/**
 * The "Ask the Engine" surface — a NotebookLM-style box over the whole
 * villa/townhouse knowledge base. Every answer is grounded in the engine's own
 * community dossiers (see askEngine); the source chips link straight to the
 * community pages the answer was drawn from.
 */
export function AskEngine() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<AskSource[]>([]);
  const [cards, setCards] = useState<CommunityCard[]>([]);
  const [webSources, setWebSources] = useState<WebSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    setError(null);
    setAsked(text);
    startTransition(async () => {
      const res = await askEngine(text);
      setAnswer(res.answer);
      setSources(res.sources);
      setCards(res.cards ?? []);
      setWebSources(res.webSources ?? []);
      setError(res.error ?? null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Ask box */}
      <div className="rounded-2xl border border-ink-700 bg-ink-900/60 p-2 shadow-lg">
        <div className="flex items-end gap-2">
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run(q);
              }
            }}
            rows={2}
            placeholder="Ask anything about Dubai villa & townhouse communities…"
            className="min-h-[3rem] flex-1 resize-none rounded-xl bg-transparent px-4 py-3 text-paper-100 placeholder:text-ink-500 focus:outline-none"
          />
          <button
            onClick={() => run(q)}
            disabled={pending || !q.trim()}
            className="mb-1 shrink-0 rounded-xl bg-accent-500 px-5 py-3 text-sm font-medium text-ink-900 transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Thinking…" : "Ask"}
          </button>
        </div>
      </div>

      {/* Suggestions (only before first ask) */}
      {!asked && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQ(s);
                run(s);
              }}
              className="rounded-full border border-ink-700 px-3 py-1.5 text-xs text-ink-500 transition hover:border-accent-600 hover:text-paper-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Answer */}
      {asked && (
        <div className="rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
          <div className="mb-4 text-xs uppercase tracking-wider text-ink-500">
            Asked: <span className="text-paper-300">{asked}</span>
          </div>

          {!pending && cards.length > 0 && (
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              {cards.map((c) => (
                <CommunityTile key={c.slug} c={c} />
              ))}
            </div>
          )}

          {pending && <div className="animate-pulse text-ink-500">Searching the engine…</div>}

          {!pending && error && (
            <div className="rounded-lg border border-status-offplan/40 bg-status-offplan/10 px-4 py-3 text-sm text-paper-300">
              {error}
            </div>
          )}

          {!pending && answer && (
            <div className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper-100">
              {answer}
            </div>
          )}

          {!pending && sources.length > 0 && (
            <div className="mt-6 border-t border-ink-700 pt-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-ink-500">
                From the engine
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/communities/${s.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent-600/60 bg-accent-500/10 px-3 py-1.5 text-xs text-accent-400 transition hover:bg-accent-500/20"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!pending && webSources.length > 0 && (
            <div className="mt-4 border-t border-ink-700 pt-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-ink-500">
                Live web · cited
              </div>
              <div className="flex flex-wrap gap-2">
                {webSources.map((w) => (
                  <a
                    key={w.url}
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={w.url}
                    className="inline-flex max-w-[18rem] items-center gap-1.5 truncate rounded-full border border-ink-700 px-3 py-1.5 text-xs text-ink-500 transition hover:border-paper-700 hover:text-paper-300"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-500" />
                    <span className="truncate">{w.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CONF: Record<string, { label: string; cls: string }> = {
  high: { label: "High confidence", cls: "border-status-ready/50 bg-status-ready/10 text-status-ready" },
  medium: { label: "Medium", cls: "border-accent-600/50 bg-accent-500/10 text-accent-400" },
  low: { label: "Low", cls: "border-ink-700 bg-ink-900 text-ink-500" },
};

/** Rich, clickable summary tile for a community the answer is grounded in. */
function CommunityTile({ c }: { c: CommunityCard }) {
  const conf = c.confidence ? CONF[c.confidence] : undefined;
  const counts = [
    c.villaCount != null ? `${c.villaCount} villas` : null,
    c.townhouseCount != null ? `${c.townhouseCount} TH` : null,
    c.subCount != null ? `${c.subCount} sub-communities` : null,
  ].filter(Boolean);
  return (
    <Link
      href={`/communities/${c.slug}`}
      className="group flex flex-col rounded-xl border border-ink-700 bg-ink-900/50 p-4 transition hover:border-accent-600 hover:bg-ink-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-paper-100 group-hover:text-accent-400">{c.name}</div>
        <span className="shrink-0 rounded-full border border-ink-700 px-2 py-0.5 text-[0.625rem] uppercase tracking-wider text-ink-500 capitalize">
          {c.status}
        </span>
      </div>
      {c.developer && <div className="mt-0.5 text-xs text-ink-500">{c.developer}</div>}
      {counts.length > 0 && <div className="mt-2 text-xs text-paper-300">{counts.join(" · ")}</div>}
      {(c.medianPrice != null || c.appreciationPct != null) && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          {c.medianPrice != null && (
            <span className="text-paper-300">
              Median <span className="text-paper-100">{aed(c.medianPrice)}</span>
            </span>
          )}
          {c.appreciationPct != null && (
            <span className={c.appreciationPct >= 0 ? "text-status-ready" : "text-status-offplan"}>
              {pct(c.appreciationPct)} 6-mo
            </span>
          )}
        </div>
      )}
      {conf && (
        <span className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.625rem] uppercase tracking-wider ${conf.cls}`}>
          <span className="h-1 w-1 rounded-full bg-current" />
          {conf.label}
        </span>
      )}
    </Link>
  );
}
