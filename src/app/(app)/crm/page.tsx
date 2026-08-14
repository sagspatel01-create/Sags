import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getDueFollowups,
  getStaleContacts,
  getPipelineSummary,
  getForecast,
} from "@/lib/data/crm";
import { completeFollowup } from "@/app/actions/crm";
import { AutoRefresh } from "@/components/crm/AutoRefresh";
import { ForecastBars } from "@/components/crm/ForecastBars";
import { CHANNEL_LABEL, monthLabel } from "@/lib/crm";
import { aed, aedShort } from "@/lib/format";

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
  return `${d}d ago`;
}

function Kpi({
  label, value, sub, delay = 0, accent = false,
}: { label: string; value: string; sub?: string; delay?: number; accent?: boolean }) {
  return (
    <div className="kpi crm-rise p-5" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-eyebrow">{label}</p>
      <p className={`mt-1.5 font-display text-3xl tnum ${accent ? "text-accent-400" : "text-paper-100"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-paper-500">{sub}</p>}
    </div>
  );
}

export default async function CrmTodayPage() {
  const configured = isSupabaseConfigured();
  const now = new Date();
  const today = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const [summary, forecast, due, upcoming, stale] = configured
    ? await Promise.all([
        getPipelineSummary(),
        getForecast(6),
        getDueFollowups(0),
        getDueFollowups(7),
        getStaleContacts(7, 8),
      ])
    : [
        { totalContacts: 0, openDeals: 0, openValue: 0, weightedValue: 0, weightedCommission: 0, dueToday: 0, disbursedThisMonth: 0, commissionThisMonth: 0 },
        { rows: [], undated: { count: 0, gross: 0, weighted: 0 }, totalPipeline: 0, totalWeighted: 0 },
        [], [], [],
      ];

  const cur = forecast.rows[0];
  const committed = cur?.committed ?? 0;
  const weighted = cur?.weighted ?? 0;
  const target = cur?.target ?? 10_000_000;
  const projected = committed + weighted;
  const projPct = Math.min(100, target > 0 ? (projected / target) * 100 : 0);
  const commPct = Math.min(100, target > 0 ? (committed / target) * 100 : 0);
  const hitTarget = projected >= target;

  const dueIds = new Set(due.map((f) => f.id));
  const comingUp = upcoming.filter((f) => !dueIds.has(f.id));
  const todayKey = now.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <AutoRefresh seconds={120} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-eyebrow">
            <span className="pulse-dot" /> Live · {today}
          </p>
          <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">Good morning, Krunal</h1>
          <p className="mt-2 max-w-2xl text-paper-300">
            Everything moving in your pipeline, and the money it becomes — in one place, refreshed automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/crm/contacts?new=1" className="btn-primary">Add lead</Link>
          <Link href="/crm/import" className="chip">Import</Link>
        </div>
      </div>

      {!configured && (
        <div className="kpi mt-6 p-4">
          <p className="text-sm text-paper-300">
            <span className="text-paper-100">Preview mode.</span> Add Supabase credentials to go live.
          </p>
        </div>
      )}

      {/* Money band — the centrepiece */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {/* This month vs target */}
        <div className="kpi crm-rise p-6 lg:col-span-2" style={{ animationDelay: "0ms" }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-eyebrow">{cur ? monthLabel(cur.month) : "This month"} · disbursement to target</p>
            <p className={`text-xs tnum ${hitTarget ? "text-accent-400" : "text-paper-500"}`}>
              {Math.round(projPct)}% of {aedShort(target)}
            </p>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <span className="font-display text-5xl tnum text-paper-100">{aedShort(projected)}</span>
            <span className="pb-1 text-sm text-paper-500">projected</span>
          </div>
          <div className="meter mt-4">
            <div className="fill" style={{ width: `${projPct}%` }} />
            <div className="committed" style={{ width: `${commPct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-paper-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--status-ready)" }} />
              Banked {aed(committed)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent-400)" }} />
              Weighted {aed(weighted)}
            </span>
            <span className="text-paper-700">Target {aed(target)}</span>
          </div>
        </div>

        {/* Money to be made */}
        <div className="kpi crm-rise p-6" style={{ animationDelay: "80ms" }}>
          <p className="text-eyebrow">Commission to be made</p>
          <p className="mt-1.5 font-display text-5xl tnum text-accent-400">{aedShort(summary.weightedCommission)}</p>
          <p className="mt-2 text-sm text-paper-500">
            Probability-weighted across every open &amp; banked deal — your realistic earnings in flight.
          </p>
          <Link href="/crm/forecast" className="mt-3 inline-block text-xs text-accent-400 hover:text-accent-500">
            See it month by month →
          </Link>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Weighted pipeline" value={aedShort(summary.weightedValue)} sub={`${aedShort(summary.openValue)} gross`} delay={120} />
        <Kpi label="Open deals" value={String(summary.openDeals)} sub={`${summary.totalContacts} contacts`} delay={160} />
        <Kpi label="Due today" value={String(summary.dueToday)} sub="follow-ups" delay={200} accent={summary.dueToday > 0} />
        <Kpi label="Disbursed this month" value={aedShort(summary.disbursedThisMonth)} sub={`${aedShort(summary.commissionThisMonth)} commission`} delay={240} />
      </div>

      {/* Forecast strip */}
      {configured && forecast.rows.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-paper-100">The money, month by month</h2>
            <Link href="/crm/forecast" className="chip">Full forecast</Link>
          </div>
          <hr className="gold-rule mt-3" />
          <div className="kpi mt-4 p-5">
            <ForecastBars rows={forecast.rows} />
          </div>
        </section>
      )}

      {/* Today's follow-ups */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-paper-100">Follow up today</h2>
          <span className="text-xs text-paper-700">{due.length} due · overdue included</span>
        </div>
        <hr className="gold-rule mt-3" />

        {due.length === 0 ? (
          <p className="mt-4 text-sm text-paper-500">Nothing due. {configured ? "You're all caught up." : ""}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {due.map((f, i) => {
              const overdue = f.due_on < todayKey;
              const wa = waLink(f.contact?.phone ?? null);
              return (
                <li key={f.id} className="kpi crm-rise flex flex-wrap items-center justify-between gap-3 p-4" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/crm/contacts/${f.contact_id}`} className="font-medium text-paper-100 hover:text-accent-400">
                        {f.contact?.full_name ?? "Unknown"}
                      </Link>
                      <span className="chip">{CHANNEL_LABEL[f.channel]}</span>
                      {overdue && <span className="text-xs font-medium text-accent-400">overdue · {f.due_on}</span>}
                    </div>
                    {f.note && <p className="mt-1 text-sm text-paper-300">{f.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="chip">WhatsApp</a>}
                    {f.contact?.email && <a href={`mailto:${f.contact.email}`} className="chip">Email</a>}
                    <form action={completeFollowup}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="contact_id" value={f.contact_id} />
                      <button type="submit" className="seg">Done</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Coming up + gone quiet */}
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        {comingUp.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-paper-100">Coming up (7 days)</h2>
            <hr className="gold-rule mt-3" />
            <ul className="mt-4 space-y-1.5">
              {comingUp.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-paper-300">
                    <span className="tnum text-paper-700">{f.due_on}</span>{" "}
                    <Link href={`/crm/contacts/${f.contact_id}`} className="text-paper-100 hover:text-accent-400">
                      {f.contact?.full_name ?? "Unknown"}
                    </Link>
                  </span>
                  <span className="chip">{CHANNEL_LABEL[f.channel]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {stale.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-paper-100">Gone quiet</h2>
            <hr className="gold-rule mt-3" />
            <ul className="mt-4 grid gap-2">
              {stale.map(({ contact, lastActivity }) => (
                <li key={contact.id}>
                  <Link href={`/crm/contacts/${contact.id}`} className="flex items-center justify-between rounded-lg border border-ink-500 px-3 py-2 text-sm hover:bg-ink-700">
                    <span className="text-paper-100">{contact.full_name}</span>
                    <span className="text-xs text-paper-700">{daysAgo(lastActivity)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
