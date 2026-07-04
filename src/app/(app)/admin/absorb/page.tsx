import Link from "next/link";
import { isSupabaseConfigured, isAnthropicConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/community/NotConfigured";
import { Absorb } from "@/components/admin/Absorb";

export const dynamic = "force-dynamic";

export default function AbsorbPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <div className="flex items-center gap-2 text-sm text-paper-500">
        <Link href="/admin" className="hover:text-paper-200">Admin</Link>
        <span>/</span>
        <span className="text-paper-300">Absorb</span>
      </div>

      <p className="mt-6 text-eyebrow">Document ingestion</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        Absorb
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        Feed the engine. Upload any brochure, price list, DXB Interact export or
        market report and Claude extracts the structured facts — community,
        sub-communities, unit types, pricing, payment plan. You review every
        value, then it writes live across the tool. Nothing is invented; blanks
        stay blank.
      </p>

      {!isAnthropicConfigured() && (
        <p className="mt-6 rounded-lg border border-ink-500 bg-ink-800/50 p-4 text-sm text-paper-500">
          Add <code className="text-paper-200">ANTHROPIC_API_KEY</code> to enable
          extraction.
        </p>
      )}

      <Absorb />
    </div>
  );
}
