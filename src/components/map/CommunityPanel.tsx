import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CommunityPin } from "@/lib/map/types";
import type { PositioningTier } from "@/lib/db/types";

const TIER_LABEL: Record<PositioningTier, string> = {
  ultra_prime: "Ultra-prime",
  prime: "Prime",
  premium: "Premium",
  mid: "Mid-market",
  accessible: "Accessible",
};

/**
 * Community detail panel — slides in on marker click. Shows the identity
 * essentials and the sub-community count (a first-class field), and is the
 * entry point into the full community dashboard (Milestone 2: master plan,
 * phases, unit archetypes, documents).
 */
export function CommunityPanel({
  pin,
  onClose,
}: {
  pin: CommunityPin;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col border-l border-ink-500 bg-ink-850/95 backdrop-blur">
      <div className="flex items-start justify-between px-6 pt-6">
        <div>
          <p className="text-eyebrow">{pin.developer_name ?? "Developer —"}</p>
          <h2 className="mt-1 font-display text-2xl leading-tight text-paper-100">
            {pin.name}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg border border-ink-500 px-2 py-1 text-paper-500 transition-colors hover:bg-ink-700 hover:text-paper-100"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 px-6">
        <StatusBadge status={pin.status} />
        {pin.positioning_tier && (
          <span className="rounded-full border border-ink-500 px-2.5 py-1 text-[0.6875rem] text-paper-300">
            {TIER_LABEL[pin.positioning_tier]}
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden border-y border-ink-500 bg-ink-500">
        <Stat label="Sub-communities" value={pin.sub_community_count} />
        <Stat
          label="Depth"
          value={pin.is_placeholder ? "Skeleton" : "Filled"}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <p className="text-sm leading-relaxed text-paper-500">
          Open the full community dashboard for the interactive master plan,
          phases, unit archetypes (in the five categorized listing groups),
          context and documents.
        </p>
      </div>

      <div className="border-t border-ink-500 p-4">
        <Link
          href={`/communities/${pin.slug}`}
          className="block w-full rounded-lg bg-accent-500 px-4 py-2.5 text-center text-sm font-medium text-ink-900 transition-colors hover:bg-accent-400"
        >
          Open community dashboard
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-ink-850 px-6 py-4">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-1 font-mono text-2xl text-paper-100">{value}</p>
    </div>
  );
}
