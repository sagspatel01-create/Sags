"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/ui/Markdown";
import { saveReport, deleteReport } from "@/app/actions/compare-report";

interface SavedReport {
  id: string;
  body: string;
  is_owner_edited: boolean;
}

/**
 * The "Generate client-ready comparison" surface. Streams a tailored brief
 * live (types out on a call), then persists it for editing. Grounded in the
 * selected communities' data + the active client profile.
 */
export function CompareReport({
  slugs,
  initial,
  hasProfile,
  sessionLabel,
}: {
  slugs: string[];
  initial: SavedReport | null;
  hasProfile: boolean;
  sessionLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial?.body ?? "");
  const [copied, setCopied] = useState(false);

  const displayed = streaming ? live : (initial?.body ?? live);
  const hasBody = Boolean(displayed);

  async function generate() {
    setError(null);
    setLive("");
    setStreaming(true);
    try {
      const res = await fetch("/api/compare-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: slugs }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Generation failed.");
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setLive(acc);
      }
      setStreaming(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Generation failed.");
      setStreaming(false);
    }
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-ink-500 bg-ink-850">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-500 px-6 py-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-eyebrow">Generate</p>
            <p className="mt-0.5 font-display text-lg text-paper-100">
              Client-ready comparison
            </p>
          </div>
          {hasProfile && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-600/60 bg-accent-500/10 px-2.5 py-1 text-[0.625rem] uppercase tracking-wider text-accent-400">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              For {sessionLabel ?? "this client"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasBody && !editing && !streaming && (
            <>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(displayed);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-xs text-paper-500 hover:text-paper-200"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              {initial && (
                <button
                  onClick={() => {
                    setDraft(initial.body);
                    setEditing(true);
                  }}
                  className="text-xs text-paper-500 hover:text-paper-200"
                >
                  Edit
                </button>
              )}
            </>
          )}
          <button
            onClick={generate}
            disabled={streaming || pending}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {streaming
              ? "Writing…"
              : hasBody
                ? "Regenerate"
                : "Generate brief"}
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={14}
              className="input resize-none font-mono text-xs leading-relaxed"
            />
            <div className="mt-3 flex gap-2">
              <button
                disabled={pending}
                onClick={() =>
                  act(async () => {
                    const r = await saveReport(initial!.id, draft);
                    if (r.ok) setEditing(false);
                    return r;
                  })
                }
                className="btn-primary text-xs"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-paper-500 hover:text-paper-200"
              >
                Cancel
              </button>
              <button
                disabled={pending}
                onClick={() => act(() => deleteReport(initial!.id))}
                className="ml-auto text-xs text-red-400/80 hover:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ) : hasBody ? (
          <>
            <Markdown text={displayed} />
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent-400 align-middle" />
            )}
            {initial?.is_owner_edited && (
              <p className="mt-4 text-[0.625rem] uppercase tracking-wider text-paper-700">
                Owner-edited
              </p>
            )}
          </>
        ) : (
          <div className="py-4 text-center">
            <p className="mx-auto max-w-md text-sm text-paper-500">
              Write a client-ready brief comparing these communities — a
              buy-side analyst&apos;s read, tailored to
              {hasProfile ? ` ${sessionLabel ?? "the client"}` : " a private buyer"}
              , grounded in the data above. It streams live and saves for editing.
            </p>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
