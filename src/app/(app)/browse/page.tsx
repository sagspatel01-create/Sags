import { isSupabaseConfigured } from "@/lib/env";
import { getCatalogue } from "@/lib/data/catalogue";
import { getActiveProfile } from "@/lib/client-profile.server";
import {
  parseFilters,
  applyFilters,
  facetOptions,
  fitFor,
} from "@/lib/filters";
import { FilterBar } from "@/components/browse/FilterBar";
import { BrowseResults, type ResultRow } from "@/components/browse/BrowseResults";
import { NotConfigured } from "@/components/community/NotConfigured";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  const sp = await searchParams;
  const [rows, profile] = await Promise.all([
    getCatalogue(),
    getActiveProfile(),
  ]);

  const active = parseFilters(sp);
  const filtered = applyFilters(rows, active);
  const facets = facetOptions(rows);
  const sort = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) ?? "name";

  const withFit = filtered.map((r) => ({ row: r, fit: fitFor(r, profile) }));
  if (sort === "fit" && profile) {
    withFit.sort((a, b) => (b.fit?.score ?? 0) - (a.fit?.score ?? 0));
  } else {
    withFit.sort((a, b) => a.row.name.localeCompare(b.row.name));
  }

  const results: ResultRow[] = withFit.map(({ row, fit }) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    tier: row.tier,
    developerName: row.developerName,
    subCount: row.subCount,
    tags: row.tags,
    fit: fit?.score ?? null,
    inBudget: fit?.inBudget ?? false,
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 md:px-10">
      <p className="text-eyebrow">Browse the catalogue</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        The store
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        Filter the catalogue to what fits. Every field is a filter, driven by a
        config so new ones slot in without rebuilding. Select communities to
        drop them straight into the comparison.
      </p>

      <div className="mt-8 space-y-6">
        <FilterBar
          active={active}
          facets={facets}
          sort={sort}
          resultCount={filtered.length}
          totalCount={rows.length}
          clientLabel={profile?.session_label ?? null}
          clientBudget={profile?.budget ?? null}
        />
        <BrowseResults rows={results} />
      </div>

      <p className="mt-6 text-sm text-paper-700">
        Filters over market fields (price, yield, appreciation, absorption) are
        unknown-friendly — a community isn&apos;t excluded for a figure that
        lands in Phase 2. Budget falls back to positioning tier until real
        prices are ingested.
      </p>
    </div>
  );
}
