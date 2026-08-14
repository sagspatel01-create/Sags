import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getDealsWithContacts } from "@/lib/data/crm";
import {
  PARKED_STAGES,
  STAGE_LABEL,
  productLabel,
  dealDisbursement,
  dealCommission,
} from "@/lib/crm";
import { PipelineBoardDnD, type BoardDeal } from "@/components/crm/PipelineBoardDnD";
import { Card } from "@/components/ui/Card";
import { aed } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const configured = isSupabaseConfigured();
  const deals = configured ? await getDealsWithContacts() : [];

  const board: BoardDeal[] = deals.map((d) => ({
    id: d.id,
    contactId: d.contact_id,
    name: d.contact?.full_name ?? "Unknown",
    product: productLabel(d.product, d.product_other),
    value: dealDisbursement(d),
    commission: dealCommission(d),
    probability: d.probability,
    stage: d.stage,
    closeMonth: d.close_month,
  }));

  const parked = deals.filter((d) => PARKED_STAGES.includes(d.stage));

  return (
    <div className="px-6 py-12 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Active pipeline</p>
          <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">Pipeline</h1>
        </div>
        <Link href="/crm/contacts?new=1" className="btn-primary">Add lead</Link>
      </div>
      <p className="mt-3 flex items-center gap-2 text-paper-300">
        <span className="pulse-dot" />
        Drag a card between stages — the forecast and dashboard update the moment you drop it.
      </p>

      {!configured && (
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-300">Preview mode — connect Supabase to see live deals here.</p>
        </Card>
      )}

      <div className="mt-8">
        <PipelineBoardDnD initial={board} />
      </div>

      {parked.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-paper-100">Parked</h2>
          <hr className="gold-rule mt-3" />
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {parked.map((d) => (
              <Card key={d.id} className="p-3">
                <div className="flex items-center justify-between">
                  <Link href={`/crm/contacts/${d.contact_id}`} className="font-medium text-paper-100 hover:text-accent-400">
                    {d.contact?.full_name ?? "Unknown"}
                  </Link>
                  <span className="chip">{STAGE_LABEL[d.stage]}</span>
                </div>
                <p className="mt-1 text-xs text-paper-500">
                  {productLabel(d.product, d.product_other)} · {aed(dealDisbursement(d)) ?? "—"}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
