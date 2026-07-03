import { isSupabaseConfigured } from "@/lib/env";
import { getCommunities } from "@/lib/data/communities";
import { getCommunitiesForCompare } from "@/lib/data/compare";
import { getActiveProfile } from "@/lib/client-profile.server";
import { buildCompareModel } from "@/lib/compare-model";
import { ComparePicker, type PickerOption } from "@/components/compare/ComparePicker";
import { ComparisonTable } from "@/components/compare/ComparisonTable";
import { NotConfigured } from "@/components/community/NotConfigured";
import { Card } from "@/components/ui/Card";
import { TIER_LABEL } from "@/lib/format";
import { PRIORITIES } from "@/lib/client-profile";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  const { ids } = await searchParams;
  const slugs = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const [all, selected, profile] = await Promise.all([
    getCommunities(),
    slugs.length ? getCommunitiesForCompare(slugs) : Promise.resolve([]),
    getActiveProfile(),
  ]);

  const options: PickerOption[] = all.map((c) => ({
    slug: c.slug,
    name: c.name,
    developer: c.developer?.name ?? null,
    status: c.status,
    tier: c.positioning_tier ? TIER_LABEL[c.positioning_tier] : null,
  }));

  const model =
    selected.length >= 2 ? buildCompareModel(selected, profile) : null;

  const topPriorities =
    profile &&
    PRIORITIES.filter((p) => (profile.priorities[p.key] ?? 0) >= 4).map(
      (p) => p.label,
    );

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 md:px-10">
      <p className="text-eyebrow">The comparison engine</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        Side by side
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        Two to four communities across every category — identity, specs,
        financials, market, momentum, financing, projections, context, value
        drivers and the buyer profile. Detailed, never summarised away; empty
        cells stay honestly blank until data lands.
      </p>

      {profile && (
        <Card className="mt-6 p-4">
          <p className="text-sm text-paper-300">
            Tailored to{" "}
            <span className="text-paper-100">{profile.session_label}</span>
            {topPriorities && topPriorities.length > 0 ? (
              <>
                {" "}
                — highlighting{" "}
                <span className="text-accent-400">
                  {topPriorities.join(", ")}
                </span>
                .
              </>
            ) : (
              "."
            )}
          </p>
        </Card>
      )}

      <div className="mt-6">
        <ComparePicker options={options} selected={slugs} />
      </div>

      <div className="mt-8">
        {model ? (
          <ComparisonTable model={model} />
        ) : (
          <div className="rounded-xl border border-dashed border-ink-500 p-12 text-center">
            <p className="text-eyebrow">Nothing selected</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-paper-500">
              Pick at least two communities above to lay them side by side.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
