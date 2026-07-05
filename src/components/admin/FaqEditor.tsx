"use client";

import { useState } from "react";
import { updateFaqs, draftFaqs, type Faq } from "@/app/actions/faqs";

export function FaqEditor({ slug, initial }: { slug: string; initial: Faq[] }) {
  const [faqs, setFaqs] = useState<Faq[]>(initial.length ? initial : []);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function set(i: number, k: keyof Faq, v: string) {
    setFaqs((p) => p.map((f, idx) => (idx === i ? { ...f, [k]: v } : f)));
  }
  function add() {
    setFaqs((p) => [...p, { q: "", a: "" }]);
  }
  function remove(i: number) {
    setFaqs((p) => p.filter((_, idx) => idx !== i));
  }

  async function draft() {
    setDrafting(true);
    setStatus(null);
    const { faqs: drafted, error } = await draftFaqs(slug);
    setDrafting(false);
    if (drafted) {
      setFaqs((p) => [...p, ...drafted]);
      setStatus(`Drafted ${drafted.length} — review and edit, then save.`);
    } else setStatus(error ?? "Draft failed.");
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const { ok, error } = await updateFaqs(slug, faqs);
    setSaving(false);
    setStatus(ok ? "Saved — live on the community page." : (error ?? "Save failed."));
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={draft} disabled={drafting} className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-xs text-accent-400 transition-colors hover:bg-accent-500/20 disabled:opacity-50">
          {drafting ? "Drafting from data…" : "＋ Draft with Claude"}
        </button>
        <button onClick={add} className="text-xs text-paper-500 hover:text-paper-200">＋ Add blank</button>
        {status && <span className="text-xs text-paper-500">{status}</span>}
      </div>

      {faqs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-500 bg-ink-800/40 p-4 text-sm text-paper-500">
          No FAQs yet. Draft a set from this community&apos;s data, then review before saving.
        </p>
      ) : (
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-lg border border-ink-500 bg-ink-800/40 p-3">
              <input
                value={f.q}
                onChange={(e) => set(i, "q", e.target.value)}
                placeholder="Question"
                className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500"
              />
              <textarea
                value={f.a}
                onChange={(e) => set(i, "a", e.target.value)}
                placeholder="Answer"
                rows={2}
                className="mt-2 w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-300 outline-none focus:border-accent-500"
              />
              <button onClick={() => remove(i)} className="mt-1 text-xs text-red-400/80 hover:text-red-400">Remove</button>
            </div>
          ))}
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
        {saving ? "Saving…" : "Save FAQs"}
      </button>
    </div>
  );
}
