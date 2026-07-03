"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateTailoredCopy,
  saveTailoredOverride,
  revertTailored,
} from "@/app/actions/tailoring";
import type { TailorKind } from "@/lib/tailoring";
import { Empty } from "@/components/ui/Empty";

interface TailoredRow {
  id: string;
  body: string;
  is_owner_edited: boolean;
}

/**
 * Client-tailored copy (Layer 1 base ↔ Layer 2 tailored). Shows base copy
 * when no client session is active; when a session is active the owner can
 * generate copy that speaks directly to that client, edit any wording, or
 * revert to base. The Anthropic call happens server-side.
 */
export function TailoredCopy({
  kind,
  base,
  tailored,
  hasProfile,
  sessionLabel,
  target,
  emptyLabel,
  emptyHint,
}: {
  kind: TailorKind;
  base: string | null;
  tailored: TailoredRow | null;
  hasProfile: boolean;
  sessionLabel: string | null;
  target: { communityId?: string; subCommunityId?: string };
  emptyLabel?: string;
  emptyHint?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tailored?.body ?? "");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  const isTailored = Boolean(tailored);
  const text = tailored?.body ?? base;

  return (
    <div>
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {isTailored ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-600/60 bg-accent-500/10 px-2.5 py-1 text-[0.625rem] uppercase tracking-wider text-accent-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            Tailored for {sessionLabel ?? "this client"}
          </span>
        ) : (
          <span className="text-[0.625rem] uppercase tracking-wider text-paper-700">
            {hasProfile ? "Base copy" : "Base copy · no client session"}
          </span>
        )}
        {tailored?.is_owner_edited && (
          <span className="text-[0.625rem] uppercase tracking-wider text-paper-700">
            Owner-edited
          </span>
        )}
      </div>

      {/* Body */}
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="input resize-none leading-relaxed"
          />
          <div className="mt-2 flex gap-2">
            <button
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await saveTailoredOverride(tailored!.id, draft);
                  if (res.ok) setEditing(false);
                  return res;
                })
              }
              className="btn-primary text-xs"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setDraft(tailored?.body ?? "");
              }}
              className="text-xs text-paper-500 hover:text-paper-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : text ? (
        <p className="max-w-3xl whitespace-pre-line leading-relaxed text-paper-300">
          {text}
        </p>
      ) : (
        <div className="max-w-3xl rounded-lg border border-dashed border-ink-500 p-5">
          <Empty label={emptyLabel ?? "No copy yet"} />
          {emptyHint && (
            <p className="mt-2 text-sm text-paper-500">{emptyHint}</p>
          )}
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {hasProfile ? (
            <>
              <button
                disabled={pending}
                onClick={() =>
                  run(() => generateTailoredCopy(kind, target))
                }
                className="rounded-lg border border-ink-500 bg-ink-800 px-3 py-1.5 text-xs text-paper-200 transition-colors hover:bg-ink-700 hover:text-paper-100 disabled:opacity-50"
              >
                {pending
                  ? "Working…"
                  : isTailored
                    ? "Regenerate"
                    : `Tailor to ${sessionLabel ?? "client"}`}
              </button>
              {isTailored && (
                <>
                  <button
                    onClick={() => {
                      setDraft(tailored!.body);
                      setEditing(true);
                    }}
                    className="text-xs text-paper-500 hover:text-paper-200"
                  >
                    Edit
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => run(() => revertTailored(kind, target))}
                    className="text-xs text-paper-500 hover:text-paper-200"
                  >
                    Revert to base
                  </button>
                </>
              )}
            </>
          ) : (
            <span className="text-xs text-paper-700">
              Start a client session to tailor this copy.
            </span>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      )}
    </div>
  );
}
