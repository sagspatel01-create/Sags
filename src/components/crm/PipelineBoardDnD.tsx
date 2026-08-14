"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { moveDealStage } from "@/app/actions/crm";
import { PIPELINE_STAGES, STAGE_LABEL, monthShort, toMonthKey } from "@/lib/crm";
import { aed } from "@/lib/format";
import type { CrmStage } from "@/lib/db/types";

export type BoardDeal = {
  id: string;
  contactId: string;
  name: string;
  product: string;
  value: number;
  commission: number;
  probability: number;
  stage: CrmStage;
  closeMonth: string | null;
};

/**
 * Drag-and-drop pipeline. Cards are draggable; columns are drop targets.
 * Dropping moves the card optimistically, fires the moveDealStage server
 * action, then refreshes so the forecast and dashboard stay in lockstep.
 * Native HTML5 DnD — zero dependencies.
 */
export function PipelineBoardDnD({ initial }: { initial: BoardDeal[] }) {
  const [deals, setDeals] = useState<BoardDeal[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function drop(stage: CrmStage) {
    const id = dragId;
    setOverStage(null);
    setDragId(null);
    if (!id) return;
    const current = deals.find((d) => d.id === id);
    if (!current || current.stage === stage) return;

    // Optimistic move
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));

    const fd = new FormData();
    fd.set("id", id);
    fd.set("stage", stage);
    startTransition(async () => {
      await moveDealStage(fd);
      router.refresh();
    });
  }

  const total = (stage: CrmStage) =>
    deals.filter((d) => d.stage === stage).reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map((stage) => {
        const list = deals.filter((d) => d.stage === stage);
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              e.preventDefault();
              if (overStage !== stage) setOverStage(stage);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
            }}
            onDrop={() => drop(stage)}
            className={`pcol w-64 shrink-0 rounded-xl border border-ink-500 bg-ink-800/40 p-2 ${
              overStage === stage ? "dragover" : ""
            }`}
          >
            <div className="flex items-center justify-between px-1.5 pt-1">
              <h2 className="text-sm font-medium text-paper-100">{STAGE_LABEL[stage]}</h2>
              <span className="text-xs text-paper-700">{list.length}</span>
            </div>
            <p className="px-1.5 text-xs tnum text-accent-400/80">{aed(total(stage)) ?? "—"}</p>
            <hr className="gold-rule my-2" />

            <div className="min-h-[60px] space-y-2">
              {list.length === 0 ? (
                <p className="px-1.5 py-6 text-center text-xs text-paper-700">
                  {overStage === stage ? "Drop here" : "—"}
                </p>
              ) : (
                list.map((d) => {
                  const mk = toMonthKey(d.closeMonth);
                  return (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      className={`pcard rounded-lg border border-ink-500 bg-ink-800/80 p-3 ${
                        dragId === d.id ? "dragging" : ""
                      }`}
                    >
                      <Link
                        href={`/crm/contacts/${d.contactId}`}
                        className="font-medium text-paper-100 hover:text-accent-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {d.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-paper-500">{d.product}</p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="tnum text-paper-200">{aed(d.value) ?? "—"}</span>
                        <span className="tnum text-paper-700">{d.probability}%</span>
                      </div>
                      {d.commission > 0 && (
                        <p className="mt-0.5 text-xs tnum text-accent-400/70">
                          {aed(d.commission)} comm
                        </p>
                      )}
                      {mk && <p className="mt-1 text-xs text-paper-500">closes {monthShort(mk)}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
