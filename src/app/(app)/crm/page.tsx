import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getDueFollowups,
  getStaleContacts,
  getPipelineSummary,
} from "@/lib/data/crm";
import { completeFollowup } from "@/app/actions/crm";
import { Card } from "@/components/ui/Card";
import { CHANNEL_LABEL } from "@/lib/crm";
import { aed } from "@/lib/format";

export const dynamic = "force-dynamic";

function waLink(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function daysAgo(iso: string | null): string {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-1 font-display text-2xl text-paper-100">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-paper-700">{hint}</p>}
    </Card>
  );
}

export default async function CrmTodayPage() {
  const configured = isSupabaseConfigured();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const [summary, due, upcoming, stale] = configured
    ? await Promise.all([
        getPipelineSummary(),
        getDueFollowups(0),
        getDueFollowups(7),
        getStaleContacts(7, 8),
      ])
    : [
        { totalContacts: 0, openDeals: 0, openValue: 0, weightedValue: 0, dueToday: 0, disbursedThisMonth: 0 },
        [],
        [],
        [],
      ];

  // "Coming up" = due within 7 days but not already in today's overdue queue.
  const dueIds = new Set(due.map((f) => f.id));
  const comingUp = upcoming.filter((f) => !dueIds.has(f.id));
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">{today}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl text-paper-100 md:text-5xl">Good morning, Krunal</h1>
        <div className="flex gap-2">
          <Link href="/crm/contacts?new=1" className="btn-primary">Add lead</Link>
          <Link href="/crm/import" className="chip">Import CSV</Link>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-paper-300">
        Your day at a glance — who to follow up with, what&apos;s in the pipeline, and where
        the month stands against target. Follow-ups you message yourself; this is the reminder.
      </p>

      {!configured && (
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-300">
            <span className="text-paper-100">Preview mode.</span> Add Supabase
            credentials and run migration <code>0025_crm.sql</code> to start
            storing leads, deals, and reminders.
          </p>
        </Card>
      )}

      {/* Stat row */}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Due today" value={String(summary.dueToday)} hint="follow-ups" />
        <Stat label="Open deals" value={String(summary.openDeals)} hint={aed(summary.openValue) ?? "—"} />
        <Stat label="Weighted pipeline" value={aed(summary.weightedValue) ?? "—"} hint="prob-adjusted" />
        <Stat label="Disbursed this month" value={aed(summary.disbursedThisMonth) ?? "AED 0"} />
      </div>

      {/* Today's follow-ups */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-paper-100">Follow up today</h2>
          <span className="text-xs text-paper-700">{due.length} due &middot; overdue included</span>
        </div>
        <hr className="gold-rule mt-3" />

        {due.length === 0 ? (
          <p className="mt-4 text-sm text-paper-500">
            Nothing due. {configured ? "You're all caught up." : ""}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {due.map((f) => {
              const overdue = f.due_on < todayKey;
              const wa = waLink(f.contact?.phone ?? null);
              return (
                <li key={f.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/crm/contacts/${f.contact_id}`}
                          className="font-medium text-paper-100 hover:text-accent-400"
                        >
                          {f.contact?.full_name ?? "Unknown"}
                        </Link>
                        <span className="chip">{CHANNEL_LABEL[f.channel]}</span>
                        {overdue && (
                          <span className="text-xs font-medium text-accent-400">
                            overdue &middot; {f.due_on}
                          </span>
                        )}
                      </div>
                      {f.note && <p className="mt-1 text-sm text-paper-300">{f.note}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className="chip">
                          WhatsApp
                        </a>
                      )}
                      {f.contact?.email && (
                        <a href={`mailto:${f.contact.email}`} className="chip">Email</a>
                      )}
                      <form action={completeFollowup}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="contact_id" value={f.contact_id} />
                        <button type="submit" className="seg">Done</button>
                      </form>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Coming up */}
      {comingUp.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-paper-100">Coming up (next 7 days)</h2>
          <hr className="gold-rule mt-3" />
          <ul className="mt-4 space-y-1.5">
            {comingUp.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-paper-300">
                  <span className="text-paper-700">{f.due_on}</span>{" "}
                  <Link href={`/crm/contacts/${f.contact_id}`} className="text-paper-100 hover:text-accent-400">
                    {f.contact?.full_name ?? "Unknown"}
                  </Link>
                  {f.note ? ` — ${f.note}` : ""}
                </span>
                <span className="chip">{CHANNEL_LABEL[f.channel]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Gone quiet */}
      {stale.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-paper-100">Gone quiet</h2>
          <p className="mt-1 text-sm text-paper-500">
            No open follow-up and no contact in a week — worth a nudge.
          </p>
          <hr className="gold-rule mt-3" />
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {stale.map(({ contact, lastActivity }) => (
              <li key={contact.id}>
                <Link
                  href={`/crm/contacts/${contact.id}`}
                  className="flex items-center justify-between rounded-lg border border-ink-500 px-3 py-2 text-sm hover:bg-ink-700"
                >
                  <span className="text-paper-100">{contact.full_name}</span>
                  <span className="text-xs text-paper-700">{daysAgo(lastActivity)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
