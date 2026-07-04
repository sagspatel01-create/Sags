import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getCommunities } from "@/lib/data/communities";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NotConfigured } from "@/components/community/NotConfigured";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const communities = await getCommunities();
  const filled = communities.filter((c) => !c.is_placeholder).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">Admin · live edit loop</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        Data entry
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        Edit any community, sub-community, phase or unit archetype — every save
        writes to the same database the front end reads, so changes are live
        immediately. Upload master plans and documents from each community
        dashboard.
      </p>

      <div className="mt-6 flex gap-4">
        <div className="rounded-xl border border-ink-500 bg-ink-800/50 px-5 py-3">
          <p className="text-eyebrow">Communities</p>
          <p className="mt-1 font-mono text-2xl text-paper-100">
            {communities.length}
          </p>
        </div>
        <div className="rounded-xl border border-ink-500 bg-ink-800/50 px-5 py-3">
          <p className="text-eyebrow">Depth-filled</p>
          <p className="mt-1 font-mono text-2xl text-paper-100">
            {filled}
            <span className="text-sm text-paper-700"> / {communities.length}</span>
          </p>
        </div>
      </div>

      <div className="mt-8 divide-y divide-ink-500 overflow-hidden rounded-xl border border-ink-500">
        {communities.map((c) => (
          <Link
            key={c.id}
            href={`/admin/communities/${c.slug}`}
            className="flex items-center justify-between gap-4 bg-ink-800/40 px-5 py-3 transition-colors hover:bg-ink-700"
          >
            <div>
              <p className="text-paper-100">{c.name}</p>
              <p className="text-xs text-paper-500">
                {c.developer?.name ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {c.is_placeholder ? (
                <span className="text-[0.625rem] uppercase tracking-wider text-paper-700">
                  Skeleton
                </span>
              ) : (
                <span className="text-[0.625rem] uppercase tracking-wider text-status-ready">
                  Filled
                </span>
              )}
              <StatusBadge status={c.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
