"use client";

import { useState } from "react";
import { updateCatalysts, draftCatalysts, type Catalyst } from "@/app/actions/catalysts";

const CATS = ["road", "transport", "school", "retail", "government", "development", "infrastructure"];

export function CatalystsEditor({ slug, initial }: { slug: string; initial: Catalyst[] }) {
  const [items, setItems] = useState<Catalyst[]>(initial);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function set(i: number, k: keyof Catalyst, v: string) {
    setItems((p) => p.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  }
  async function draft() {
    setDrafting(true); setStatus(null);
    const { catalysts, error } = await draftCatalysts(slug);
    setDrafting(false);
    if (catalysts) { setItems((p) => [...p, ...catalysts]); setStatus(`Drafted ${catalysts.length} — review and save.`); }
    else setStatus(error ?? "Draft failed.");
  }
  async function save() {
    setSaving(true); setStatus(null);
    const { ok, error } = await updateCatalysts(slug, items);
    setSaving(false); setStatus(ok ? "Saved — live on the community page." : (error ?? "Save failed."));
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={draft} disabled={drafting} className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-xs text-accent-400 transition-colors hover:bg-accent-500/20 disabled:opacity-50">
          {drafting ? "Drafting…" : "＋ Draft with Claude"}
        </button>
        <button onClick={() => setItems((p) => [...p, { title: "", category: "infrastructure", timeline: "", note: "" }])} className="text-xs text-paper-500 hover:text-paper-200">＋ Add blank</button>
        {status && <span className="text-xs text-paper-500">{status}</span>}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-500 bg-ink-800/40 p-4 text-sm text-paper-500">No catalysts yet. Draft them, review, then save.</p>
      ) : (
        <div className="space-y-3">
          {items.map((c, i) => (
            <div key={i} className="rounded-lg border border-ink-500 bg-ink-800/40 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px]">
                <input value={c.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="Title (e.g. Etihad Rail station)" className="rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500" />
                <select value={c.category} onChange={(e) => set(i, "category", e.target.value)} className="rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500">
                  {CATS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <input value={c.timeline} onChange={(e) => set(i, "timeline", e.target.value)} placeholder="Timeline" className="rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500" />
              </div>
              <textarea value={c.note} onChange={(e) => set(i, "note", e.target.value)} placeholder="Why it matters for value" rows={2} className="mt-2 w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-300 outline-none focus:border-accent-500" />
              <button onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="mt-1 text-xs text-red-400/80 hover:text-red-400">Remove</button>
            </div>
          ))}
        </div>
      )}
      <button onClick={save} disabled={saving} className="btn-primary text-xs disabled:opacity-50">{saving ? "Saving…" : "Save catalysts"}</button>
    </div>
  );
}
