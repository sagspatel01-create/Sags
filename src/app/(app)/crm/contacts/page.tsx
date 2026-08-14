import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getContacts } from "@/lib/data/crm";
import { createContact } from "@/app/actions/crm";
import { Card } from "@/components/ui/Card";
import { SOURCE_LABEL } from "@/lib/crm";
import type { CrmLeadSource } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const SOURCES: CrmLeadSource[] = ["meta_ads", "referral", "website", "walk_in", "manual", "other"];

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; imported?: string }>;
}) {
  const sp = await searchParams;
  const configured = isSupabaseConfigured();
  const contacts = configured ? await getContacts() : [];
  const openNew = sp.new === "1";

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">{contacts.length} in the system</p>
          <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">Contacts</h1>
        </div>
        <Link href="/crm/import" className="chip">Import CSV</Link>
      </div>

      {sp.imported && (
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-100">Imported {sp.imported} lead(s).</p>
        </Card>
      )}

      {!configured && (
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-300">Preview mode — connect Supabase to store contacts.</p>
        </Card>
      )}

      {/* Add lead */}
      <details className="mt-8" open={openNew}>
        <summary className="cursor-pointer text-sm text-accent-400 hover:text-accent-500">
          + Add a lead
        </summary>
        <Card className="mt-3 p-5">
          <form action={createContact} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-eyebrow">Full name *</span>
              <input name="full_name" required className="input mt-1" placeholder="Client name" />
            </label>
            <label className="block">
              <span className="text-eyebrow">Phone</span>
              <input name="phone" className="input mt-1" placeholder="+971 50 000 0000" />
            </label>
            <label className="block">
              <span className="text-eyebrow">Email</span>
              <input name="email" type="email" className="input mt-1" placeholder="name@email.com" />
            </label>
            <label className="block">
              <span className="text-eyebrow">Source</span>
              <select name="source" defaultValue="meta_ads" className="input mt-1">
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-eyebrow">Source detail (campaign / ad / referrer)</span>
              <input name="source_detail" className="input mt-1" placeholder="e.g. Equity-release campaign — Aug" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-eyebrow">Notes</span>
              <textarea name="notes" rows={2} className="input mt-1" placeholder="First impression, what they want…" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary">Save lead</button>
            </div>
          </form>
        </Card>
      </details>

      {/* List */}
      <div className="mt-8 overflow-x-auto">
        {contacts.length === 0 ? (
          <p className="text-sm text-paper-500">No contacts yet.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-paper-700">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Added</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-ink-500">
                  <td className="py-2 pr-4">
                    <Link href={`/crm/contacts/${c.id}`} className="text-paper-100 hover:text-accent-400">
                      {c.full_name}
                    </Link>
                    {c.is_client && <span className="chip ml-2">Client</span>}
                  </td>
                  <td className="py-2 pr-4 text-paper-300">{c.phone ?? "—"}</td>
                  <td className="py-2 pr-4 text-paper-500">{SOURCE_LABEL[c.source]}</td>
                  <td className="py-2 pr-4 text-paper-700">{c.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
