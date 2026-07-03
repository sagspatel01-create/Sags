import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getCommunities } from "@/lib/data/communities";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NotConfigured } from "@/components/community/NotConfigured";
import { TIER_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const communities = await getCommunities();

  // Group by developer for an editorial catalogue.
  const byDeveloper = new Map<string, typeof communities>();
  for (const c of communities) {
    const key = c.developer?.name ?? "Other";
    const arr = byDeveloper.get(key) ?? [];
    arr.push(c);
    byDeveloper.set(key, arr);
  }
  const groups = [...byDeveloper.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">The catalogue</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        Communities
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        Every villa &amp; townhouse community — a live dashboard for each, with
        its master plan, phases, unit archetypes and documents.
      </p>

      {groups.length === 0 && (
        <p className="mt-10 text-paper-500">
          No communities loaded. Run the seed to populate the catalogue.
        </p>
      )}

      {groups.map(([developer, items]) => (
        <div key={developer} className="mt-12">
          <div className="mb-4 flex items-baseline justify-between border-b border-ink-500 pb-2">
            <h2 className="font-display text-xl text-paper-100">{developer}</h2>
            <span className="text-xs text-paper-700">{items.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => {
                const subCount =
                  c.sub_community_count ?? c.sub_communities[0]?.count ?? 0;
                return (
                  <Link
                    key={c.id}
                    href={`/communities/${c.slug}`}
                    className="group rounded-xl border border-ink-500 bg-ink-800/50 p-5 transition-colors hover:bg-ink-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-lg leading-tight text-paper-100 group-hover:text-white">
                        {c.name}
                      </p>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-paper-500">
                      <span>
                        {subCount} sub-communit{subCount === 1 ? "y" : "ies"}
                      </span>
                      {c.positioning_tier && (
                        <span className="text-paper-700">
                          {TIER_LABEL[c.positioning_tier]}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
