import { notFound } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getCommunityBySlug } from "@/lib/data/communities";
import { toPlanView, pickAsset } from "@/lib/data/plans";
import { resolveStorageUrl } from "@/lib/supabase/storage";
import { Section } from "@/components/ui/Section";
import { FactList } from "@/components/ui/FactList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Empty } from "@/components/ui/Empty";
import { Card } from "@/components/ui/Card";
import { MasterPlanViewer } from "@/components/community/MasterPlanViewer";
import { AssetUploader } from "@/components/community/AssetUploader";
import { DocumentShelf, type DocView } from "@/components/community/DocumentShelf";
import { NotConfigured } from "@/components/community/NotConfigured";
import { TIER_LABEL, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) return <NotConfigured />;

  const c = await getCommunityBySlug(slug);
  if (!c) notFound();

  const masterPlan = pickAsset(c.plan_assets, "master_plan");
  const subSlug = new Map(c.sub_communities.map((s) => [s.id, s.slug]));
  const planView = await toPlanView(masterPlan, (h) => {
    if (h.target_type === "url") return h.target_url;
    if (h.target_type === "sub_community" && h.target_sub_community_id) {
      const s = subSlug.get(h.target_sub_community_id);
      return s ? `/communities/${c.slug}/${s}` : null;
    }
    return null;
  });

  const docs: DocView[] = await Promise.all(
    c.documents.map(async (d) => ({
      id: d.id,
      title: d.title,
      doc_type: d.doc_type,
      url: await resolveStorageUrl(d.file_url),
    })),
  );

  const facts = [
    { label: "Developer", value: c.developer?.name ?? null },
    { label: "Status", value: c.status[0].toUpperCase() + c.status.slice(1) },
    {
      label: "Positioning",
      value: c.positioning_tier ? TIER_LABEL[c.positioning_tier] : null,
    },
    { label: "Age / handover", value: c.age_or_handover },
    {
      label: "Sub-communities",
      value: c.sub_community_count ?? c.sub_communities.length,
    },
    { label: "Villas", value: num(c.villa_count) },
    { label: "Townhouses", value: num(c.townhouse_count) },
    { label: "Total units", value: num(c.total_units) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-paper-500">
        <Link href="/map" className="hover:text-paper-200">
          Map
        </Link>
        <span>/</span>
        <Link href="/communities" className="hover:text-paper-200">
          Communities
        </Link>
        <span>/</span>
        <span className="text-paper-300">{c.name}</span>
      </div>

      {/* Hero */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">{c.developer?.name ?? "Developer —"}</p>
          <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
            {c.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={c.status} />
          {c.positioning_tier && (
            <span className="rounded-full border border-ink-500 px-2.5 py-1 text-[0.6875rem] text-paper-300">
              {TIER_LABEL[c.positioning_tier]}
            </span>
          )}
        </div>
      </div>

      {/* Master plan */}
      <div className="mt-8">
        <MasterPlanViewer
          asset={planView?.view ?? { title: null, kind: "master_plan", url: null, width: null, height: null }}
          hotspots={planView?.hotspots ?? []}
          emptyAction={
            <AssetUploader
              scope={{ communityId: c.id }}
              mode="plan"
              planKind="master_plan"
              label="Upload master plan"
            />
          }
        />
      </div>

      {/* Key facts + description */}
      <Section eyebrow="At a glance" title="Community facts">
        <div className="grid gap-10 md:grid-cols-2">
          <FactList facts={facts} columns={1} />
          <div>
            {c.description_long ? (
              <p className="whitespace-pre-line leading-relaxed text-paper-300">
                {c.description_long}
              </p>
            ) : (
              <div className="rounded-lg border border-dashed border-ink-500 p-5">
                <Empty label="No description yet" />
                <p className="mt-2 text-sm text-paper-500">
                  Content-grade narrative — character, lifestyle, what it&apos;s
                  known for — will live here.
                </p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Who it's for */}
      <Section eyebrow="The buyer" title="Who it's for">
        {c.who_its_for_base ? (
          <p className="max-w-3xl leading-relaxed text-paper-300">
            {c.who_its_for_base}
          </p>
        ) : (
          <div className="max-w-3xl rounded-lg border border-dashed border-ink-500 p-5">
            <Empty label="No profile yet" />
            <p className="mt-2 text-sm text-paper-500">
              The base buyer profile (Layer 1). In a client session this
              regenerates to speak directly to the entered client (Milestone 5).
            </p>
          </div>
        )}
      </Section>

      {/* Sub-communities */}
      <Section
        eyebrow="Within the master plan"
        title={`Sub-communities (${c.sub_communities.length})`}
      >
        {c.sub_communities.length === 0 ? (
          <Empty label="None recorded" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...c.sub_communities]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <Link
                  key={s.id}
                  href={`/communities/${c.slug}/${s.slug}`}
                  className="group rounded-xl border border-ink-500 bg-ink-800/50 p-5 transition-colors hover:bg-ink-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg text-paper-100 group-hover:text-white">
                      {s.name}
                    </p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-3 text-xs text-paper-500">
                    {s.phases.length} phase{s.phases.length === 1 ? "" : "s"} ·{" "}
                    {s.unit_archetypes.length} unit type
                    {s.unit_archetypes.length === 1 ? "" : "s"}
                  </p>
                </Link>
              ))}
          </div>
        )}
      </Section>

      {/* Context */}
      <Section eyebrow="Location & value" title="Context">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <p className="text-eyebrow">Commute</p>
            {c.commute_times.length === 0 ? (
              <div className="mt-3">
                <Empty label="No commute data yet" />
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {c.commute_times.map((t) => (
                  <li
                    key={t.id}
                    className="flex justify-between border-b border-ink-500/60 pb-2 text-sm"
                  >
                    <span className="text-paper-500">{t.destination_name}</span>
                    <span className="text-paper-100">
                      {t.minutes_driving ? `${t.minutes_driving} min` : <Empty />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-eyebrow">Payment plans</p>
            {c.payment_plans.length === 0 ? (
              <div className="mt-3">
                <Empty label="No payment plan yet" />
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {c.payment_plans.map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between border-b border-ink-500/60 pb-2 text-sm"
                  >
                    <span className="text-paper-500">{p.plan_type ?? "Plan"}</span>
                    <span className="text-paper-100">
                      {p.construction_pct && p.handover_pct
                        ? `${pct(p.construction_pct)} / ${pct(p.handover_pct)}`
                        : <Empty />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <p className="mt-4 text-sm text-paper-700">
          Schools, amenities, infrastructure catalysts and market figures land
          in Phase 2 via the DLD / KHDA / Maps pipelines.
        </p>
      </Section>

      {/* Documents */}
      <Section eyebrow="Files" title="Documents & assets">
        <DocumentShelf
          docs={docs}
          uploader={
            <AssetUploader
              scope={{ communityId: c.id }}
              mode="document"
              label="Upload document"
            />
          }
        />
      </Section>
    </div>
  );
}
