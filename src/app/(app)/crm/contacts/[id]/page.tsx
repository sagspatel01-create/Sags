import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getContact,
  getContactDeals,
  getContactNotes,
  getContactFollowups,
} from "@/lib/data/crm";
import {
  createDeal,
  updateDeal,
  updateContact,
  addNote,
  addFollowup,
  completeFollowup,
} from "@/app/actions/crm";
import { Card } from "@/components/ui/Card";
import {
  ALL_STAGES,
  STAGE_LABEL,
  PRODUCT_LABEL,
  CHANNEL_LABEL,
  SOURCE_LABEL,
  productLabel,
  dealDisbursement,
  dealCommission,
  monthLabel,
  toMonthKey,
} from "@/lib/crm";
import { aed } from "@/lib/format";
import type { CrmProduct, CrmChannel } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const PRODUCTS: CrmProduct[] = ["new_purchase", "handover_offplan", "equity_release", "buyout_transfer", "other"];
const CHANNELS: CrmChannel[] = ["whatsapp", "call", "email", "other"];

function waLink(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/[^0-9]/g, "");
  return d ? `https://wa.me/${d}` : null;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10">
        <Link href="/crm/contacts" className="text-sm text-accent-400">← Contacts</Link>
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-300">Preview mode — connect Supabase to view contacts.</p>
        </Card>
      </div>
    );
  }

  const contact = await getContact(id);
  if (!contact) notFound();

  const [deals, notes, followups] = await Promise.all([
    getContactDeals(id),
    getContactNotes(id),
    getContactFollowups(id),
  ]);

  const wa = waLink(contact.phone);
  const openFollowups = followups.filter((f) => !f.done);
  const doneFollowups = followups.filter((f) => f.done);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:px-10">
      <Link href="/crm/contacts" className="text-sm text-accent-400 hover:text-accent-500">← Contacts</Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-paper-100">{contact.full_name}</h1>
          <p className="mt-2 text-sm text-paper-300">
            {contact.phone ?? "no phone"} · {contact.email ?? "no email"}
          </p>
          <p className="mt-1 text-xs text-paper-700">
            {SOURCE_LABEL[contact.source]}
            {contact.source_detail ? ` · ${contact.source_detail}` : ""}
            {contact.is_client ? " · Client" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="chip">WhatsApp</a>}
          {contact.email && <a href={`mailto:${contact.email}`} className="chip">Email</a>}
        </div>
      </div>

      {/* Edit contact */}
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-paper-500 hover:text-paper-300">Edit details</summary>
        <Card className="mt-2 p-4">
          <form action={updateContact} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="id" value={contact.id} />
            <label className="block"><span className="text-eyebrow">Full name</span>
              <input name="full_name" defaultValue={contact.full_name} className="input mt-1" /></label>
            <label className="block"><span className="text-eyebrow">Phone</span>
              <input name="phone" defaultValue={contact.phone ?? ""} className="input mt-1" /></label>
            <label className="block"><span className="text-eyebrow">Email</span>
              <input name="email" defaultValue={contact.email ?? ""} className="input mt-1" /></label>
            <label className="block"><span className="text-eyebrow">Source detail</span>
              <input name="source_detail" defaultValue={contact.source_detail ?? ""} className="input mt-1" /></label>
            <label className="block md:col-span-2"><span className="text-eyebrow">Notes</span>
              <textarea name="notes" rows={2} defaultValue={contact.notes ?? ""} className="input mt-1" /></label>
            <label className="flex items-center gap-2 md:col-span-2 text-sm text-paper-300">
              <input type="checkbox" name="is_client" defaultChecked={contact.is_client} /> Converted to a client (real estate / repeat)
            </label>
            <div className="md:col-span-2"><button className="btn-primary">Save</button></div>
          </form>
        </Card>
      </details>

      {/* Deals */}
      <section className="mt-10">
        <h2 className="font-display text-2xl text-paper-100">Deals</h2>
        <hr className="gold-rule mt-3" />

        <div className="mt-4 space-y-3">
          {deals.length === 0 && <p className="text-sm text-paper-500">No deals yet — add one below.</p>}
          {deals.map((d) => {
            const mk = toMonthKey(d.close_month);
            return (
              <details key={d.id}>
                <summary className="cursor-pointer list-none">
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium text-paper-100">
                        {d.title || productLabel(d.product, d.product_other)}
                      </p>
                      <p className="text-xs text-paper-500">
                        {STAGE_LABEL[d.stage]} · {aed(dealDisbursement(d)) ?? "—"} loan
                        {d.commission_amount != null || d.commission_pct != null
                          ? ` · ${aed(dealCommission(d))} comm`
                          : ""}
                        {mk ? ` · closes ${monthLabel(mk)}` : ""}
                      </p>
                    </div>
                    <span className="chip">{d.probability}%</span>
                  </Card>
                </summary>
                <Card className="mt-2 p-4">
                  <form action={updateDeal} className="grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="contact_id" value={contact.id} />
                    <label className="block md:col-span-2"><span className="text-eyebrow">Title</span>
                      <input name="title" defaultValue={d.title ?? ""} className="input mt-1" placeholder="e.g. Handover mortgage — Dubai Hills" /></label>
                    <label className="block"><span className="text-eyebrow">Stage</span>
                      <select name="stage" defaultValue={d.stage} className="input mt-1">
                        {ALL_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                      </select></label>
                    <label className="block"><span className="text-eyebrow">Probability %</span>
                      <input name="probability" type="number" min={0} max={100} defaultValue={d.probability} className="input mt-1" /></label>
                    <label className="block"><span className="text-eyebrow">Property value (AED)</span>
                      <input name="property_value" defaultValue={d.property_value ?? ""} className="input mt-1" /></label>
                    <label className="block"><span className="text-eyebrow">Loan amount (AED)</span>
                      <input name="loan_amount" defaultValue={d.loan_amount ?? ""} className="input mt-1" /></label>
                    <label className="block"><span className="text-eyebrow">Commission %</span>
                      <input name="commission_pct" defaultValue={d.commission_pct ?? ""} className="input mt-1" placeholder="e.g. 0.75" /></label>
                    <label className="block"><span className="text-eyebrow">Commission amount (AED)</span>
                      <input name="commission_amount" defaultValue={d.commission_amount ?? ""} className="input mt-1" placeholder="auto if % set" /></label>
                    <label className="block"><span className="text-eyebrow">Expected close month</span>
                      <input name="close_month" type="month" defaultValue={mk ? mk.slice(0, 7) : ""} className="input mt-1" /></label>
                    <div className="md:col-span-2"><button className="btn-primary">Save deal</button></div>
                  </form>
                </Card>
              </details>
            );
          })}
        </div>

        {/* Add deal */}
        <details className="mt-4" open={deals.length === 0}>
          <summary className="cursor-pointer text-sm text-accent-400 hover:text-accent-500">+ Add a deal</summary>
          <Card className="mt-2 p-4">
            <form action={createDeal} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="contact_id" value={contact.id} />
              <label className="block"><span className="text-eyebrow">Product</span>
                <select name="product" defaultValue="new_purchase" className="input mt-1">
                  {PRODUCTS.map((p) => <option key={p} value={p}>{PRODUCT_LABEL[p]}</option>)}
                </select></label>
              <label className="block"><span className="text-eyebrow">If &quot;Other&quot;, name it</span>
                <input name="product_other" className="input mt-1" placeholder="Custom product" /></label>
              <label className="block md:col-span-2"><span className="text-eyebrow">Title</span>
                <input name="title" className="input mt-1" placeholder="Short label (optional)" /></label>
              <label className="block"><span className="text-eyebrow">Stage</span>
                <select name="stage" defaultValue="new_lead" className="input mt-1">
                  {ALL_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                </select></label>
              <label className="block"><span className="text-eyebrow">Expected close month</span>
                <input name="close_month" type="month" className="input mt-1" /></label>
              <label className="block"><span className="text-eyebrow">Property value (AED)</span>
                <input name="property_value" className="input mt-1" placeholder="e.g. 3,500,000" /></label>
              <label className="block"><span className="text-eyebrow">Loan amount (AED)</span>
                <input name="loan_amount" className="input mt-1" placeholder="counts toward target" /></label>
              <label className="block"><span className="text-eyebrow">Commission %</span>
                <input name="commission_pct" className="input mt-1" placeholder="e.g. 0.75" /></label>
              <label className="block"><span className="text-eyebrow">Commission amount (AED)</span>
                <input name="commission_amount" className="input mt-1" placeholder="auto if % set" /></label>
              <div className="md:col-span-2"><button className="btn-primary">Add deal</button></div>
            </form>
          </Card>
        </details>
      </section>

      {/* Follow-ups */}
      <section className="mt-10">
        <h2 className="font-display text-2xl text-paper-100">Reminders</h2>
        <hr className="gold-rule mt-3" />

        <Card className="mt-4 p-4">
          <form action={addFollowup} className="grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="contact_id" value={contact.id} />
            <label className="block"><span className="text-eyebrow">Date</span>
              <input name="due_on" type="date" defaultValue={todayIso} required className="input mt-1" /></label>
            <label className="block"><span className="text-eyebrow">Channel</span>
              <select name="channel" defaultValue="whatsapp" className="input mt-1">
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
              </select></label>
            <label className="block sm:col-span-2"><span className="text-eyebrow">What to do</span>
              <input name="note" className="input mt-1" placeholder="e.g. Send rate options on WhatsApp" /></label>
            <div className="sm:col-span-4"><button className="btn-primary">Set reminder</button></div>
          </form>
        </Card>

        {openFollowups.length > 0 && (
          <ul className="mt-4 space-y-2">
            {openFollowups.map((f) => (
              <li key={f.id}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <span className="text-sm text-paper-300">
                    <span className={f.due_on < todayIso ? "text-accent-400" : "text-paper-700"}>{f.due_on}</span>
                    {" · "}{CHANNEL_LABEL[f.channel]}{f.note ? ` · ${f.note}` : ""}
                  </span>
                  <form action={completeFollowup}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="contact_id" value={contact.id} />
                    <button className="seg">Done</button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {doneFollowups.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-paper-700">Completed ({doneFollowups.length})</summary>
            <ul className="mt-2 space-y-1 text-xs text-paper-700">
              {doneFollowups.map((f) => (
                <li key={f.id}>{f.due_on} · {CHANNEL_LABEL[f.channel]}{f.note ? ` · ${f.note}` : ""}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Notes / call log */}
      <section className="mt-10">
        <h2 className="font-display text-2xl text-paper-100">Call log &amp; notes</h2>
        <hr className="gold-rule mt-3" />

        <Card className="mt-4 p-4">
          <form action={addNote} className="grid gap-3">
            <input type="hidden" name="contact_id" value={contact.id} />
            <textarea name="body" rows={3} required className="input" placeholder="What was discussed on the call…" />
            <div><button className="btn-primary">Add note</button></div>
          </form>
        </Card>

        {notes.length > 0 && (
          <ul className="mt-4 space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="border-l-2 border-ink-500 pl-4">
                <p className="text-xs text-paper-700">{fmtDateTime(n.created_at)}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-paper-300">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
