import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getDealsWithContacts, type DealWithContact } from "@/lib/data/crm";
import {
  PIPELINE_STAGES,
  PARKED_STAGES,
  STAGE_LABEL,
  productLabel,
  dealDisbursement,
  monthShort,
  toMonthKey,
} from "@/lib/crm";
import { StageSelect } from "@/components/crm/StageSelect";
import { Card } from "@/components/ui/Card";
import { aed } from "@/lib/format";
import type { CrmStage } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function DealCard({ deal }: { deal: DealWithContact }) {
  const mk = toMonthKey(deal.close_month);
  return (
    <Card className="p-3">
      <Link
        href={`/crm/contacts/${deal.contact_id}`}
        className="font-medium text-paper-100 hover:text-accent-400"
      >
        {deal.contact?.full_name ?? "Unknown"}
      </Link>
      <p className="mt-0.5 text-xs text-paper-500">
        {productLabel(deal.product, deal.product_other)}
      </p>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-paper-300">{aed(dealDisbursement(deal)) ?? "—"}</span>
        <span className="text-paper-700">{deal.probability}%</span>
      </div>
      {mk && <p className="mt-0.5 text-xs text-accent-400">closes {monthShort(mk)}</p>}
      <div className="mt-2">
        <StageSelect dealId={deal.id} stage={deal.stage} />
      </div>
    </Card>
  );
}

export default async function PipelinePage() {
  const configured = isSupabaseConfigured();
  const deals = configured ? await getDealsWithContacts() : [];

  const byStage = new Map<CrmStage, DealWithContact[]>();
  for (const s of [...PIPELINE_STAGES, ...PARKED_STAGES]) byStage.set(s, []);
  for (const d of deals) byStage.get(d.stage)?.push(d);

  const stageTotal = (s: CrmStage) =>
    (byStage.get(s) ?? []).reduce((sum, d) => sum + dealDisbursement(d), 0);

  return (
    <div className="px-6 py-12 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Active pipeline</p>
          <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">Pipeline</h1>
        </div>
        <Link href="/crm/contacts?new=1" className="btn-primary">Add lead</Link>
      </div>
      <p className="mt-3 max-w-2xl text-paper-300">
        Every open deal by stage. Move a card with the dropdown; disbursed and lost
        drop off the working board. Value shown is the loan amount that counts toward target.
      </p>

      {!configured && (
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-300">
            Preview mode — connect Supabase to see live deals here.
          </p>
        </Card>
      )}

      <div className="mt-8 flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((s) => {
          const list = byStage.get(s) ?? [];
          return (
            <div key={s} className="w-64 shrink-0">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-medium text-paper-100">{STAGE_LABEL[s]}</h2>
                <span className="text-xs text-paper-700">{list.length}</span>
              </div>
              <p className="px-1 text-xs text-paper-700">{aed(stageTotal(s)) ?? "—"}</p>
              <hr className="gold-rule my-2" />
              <div className="space-y-2">
                {list.length === 0 ? (
                  <p className="px-1 py-4 text-xs text-paper-700">—</p>
                ) : (
                  list.map((d) => <DealCard key={d.id} deal={d} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Parked */}
      {PARKED_STAGES.some((s) => (byStage.get(s) ?? []).length > 0) && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-paper-100">Parked</h2>
          <hr className="gold-rule mt-3" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {PARKED_STAGES.map((s) =>
              (byStage.get(s) ?? []).map((d) => (
                <div key={d.id} className="flex items-center gap-2">
                  <span className="chip">{STAGE_LABEL[s]}</span>
                  <DealCard deal={d} />
                </div>
              )),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
