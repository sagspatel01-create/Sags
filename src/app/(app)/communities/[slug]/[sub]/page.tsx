import { notFound } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getSubCommunity } from "@/lib/data/communities";
import { getTailoredCopy } from "@/lib/data/generated";
import { getActiveProfile } from "@/lib/client-profile.server";
import { TailoredCopy } from "@/components/community/TailoredCopy";
import { toPlanView, pickAsset } from "@/lib/data/plans";
import { resolveStorageUrl } from "@/lib/supabase/storage";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Empty } from "@/components/ui/Empty";
import { Card } from "@/components/ui/Card";
import { MasterPlanViewer } from "@/components/community/MasterPlanViewer";
import { AssetUploader } from "@/components/community/AssetUploader";
import { UnitSpecGroups } from "@/components/community/UnitSpecGroups";
import { DocumentShelf, type DocView } from "@/components/community/DocumentShelf";
import { NotConfigured } from "@/components/community/NotConfigured";
import { aed } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SubCommunityPage({
  params,
}: {
  params: Promise<{ slug: string; sub: string }>;
}) {
  const { slug, sub } = await params;
  if (!isSupabaseConfigured()) return <NotConfigured />;

  const s = await getSubCommunity(slug, sub);
  if (!s) notFound();

  const profile = await getActiveProfile();
  const whoRow = await getTailoredCopy("who_its_for", profile?.id ?? null, {
    subCommunityId: s.id,
  });
  const whoTailored = whoRow?.body
    ? { id: whoRow.id, body: whoRow.body, is_owner_edited: whoRow.is_owner_edited }
    : null;

  const sitePlan = pickAsset(s.plan_assets, "site_plan") ?? pickAsset(s.plan_assets, "master_plan");
  const planView = await toPlanView(sitePlan, (h) =>
    h.target_type === "url" ? h.target_url : null,
  );

  const phaseById = new Map(s.phases.map((p) => [p.id, p]));

  const docs: DocView[] = await Promise.all(
    s.documents.map(async (d) => ({
      id: d.id,
      title: d.title,
      doc_type: d.doc_type,
      url: await resolveStorageUrl(d.file_url),
    })),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-paper-500">
        <Link href="/communities" className="hover:text-paper-200">
          Communities
        </Link>
        <span>/</span>
        <Link href={`/communities/${slug}`} className="hover:text-paper-200">
          {s.community?.name ?? slug}
        </Link>
        <span>/</span>
        <span className="text-paper-300">{s.name}</span>
      </div>

      {/* Hero */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">{s.community?.name ?? "Sub-community"}</p>
          <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
            {s.name}
          </h1>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {/* Site plan */}
      <div className="mt-8">
        <MasterPlanViewer
          asset={planView?.view ?? { title: null, kind: "site_plan", url: null, width: null, height: null }}
          hotspots={planView?.hotspots ?? []}
          emptyAction={
            <AssetUploader
              scope={{ subCommunityId: s.id }}
              mode="plan"
              planKind="site_plan"
              label="Upload site plan"
            />
          }
        />
      </div>

      {/* Phases — the price journey */}
      <Section eyebrow="Releases" title={`Phases (${s.phases.length})`}>
        {s.phases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-500 p-5">
            <Empty label="No phases recorded" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-paper-500">
                  <th className="pb-3 font-normal">Phase</th>
                  <th className="pb-3 font-normal">Status</th>
                  <th className="pb-3 text-right font-normal">Launch / sqft</th>
                  <th className="pb-3 text-right font-normal">Current / sqft</th>
                  <th className="pb-3 text-right font-normal">Units</th>
                </tr>
              </thead>
              <tbody>
                {s.phases.map((p) => (
                  <tr key={p.id} className="border-t border-ink-500">
                    <td className="py-3 text-paper-100">{p.phase_name}</td>
                    <td className="py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3 text-right text-paper-300">
                      {aed(p.launch_price_per_sqft) ?? <Empty />}
                    </td>
                    <td className="py-3 text-right text-paper-100">
                      {aed(p.current_price_per_sqft) ?? <Empty />}
                    </td>
                    <td className="py-3 text-right text-paper-300">
                      {p.units_in_phase ?? <Empty />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Unit archetypes — the 5 categorized listing groups */}
      <Section
        eyebrow="Unit specifications"
        title={`Unit archetypes (${s.unit_archetypes.length})`}
      >
        {s.unit_archetypes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-500 p-5">
            <Empty label="No unit archetypes yet" />
            <p className="mt-2 text-sm text-paper-500">
              Each archetype shows in the five categorized listing groups —
              basics, areas, layout &amp; features, financials (incl. service
              charge), and position in development.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {s.unit_archetypes.map((u) => (
              <UnitSpecGroups
                key={u.id}
                unit={u}
                phase={u.phase_id ? phaseById.get(u.phase_id) : null}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Who it's for — client-tailored */}
      <Section eyebrow="The buyer" title="Who it's for">
        <TailoredCopy
          kind="who_its_for"
          base={s.who_its_for_base}
          tailored={whoTailored}
          hasProfile={Boolean(profile)}
          sessionLabel={profile?.session_label ?? null}
          target={{ subCommunityId: s.id }}
          emptyLabel="No profile yet"
          emptyHint="With a client session active, tailor this to speak directly to them."
        />
      </Section>

      {/* Documents */}
      <Section eyebrow="Files" title="Documents & assets">
        <DocumentShelf
          docs={docs}
          uploader={
            <AssetUploader
              scope={{ subCommunityId: s.id }}
              mode="document"
              label="Upload document"
            />
          }
        />
      </Section>

      <Card className="mt-6 p-4 text-sm text-paper-700">
        Market figures (price/sqft, transactions, yield, appreciation,
        absorption) resolve here in Phase 2 from the DLD backbone.
      </Card>
    </div>
  );
}
