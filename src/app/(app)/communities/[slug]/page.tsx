import { notFound } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getCommunityBySlug } from "@/lib/data/communities";
import { getTailoredCopy } from "@/lib/data/generated";
import { getActiveProfile } from "@/lib/client-profile.server";
import { toPlanView, pickAsset } from "@/lib/data/plans";
import { resolveStorageUrl } from "@/lib/supabase/storage";
import { TailoredCopy } from "@/components/community/TailoredCopy";
import { Section } from "@/components/ui/Section";
import { FactList } from "@/components/ui/FactList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Empty } from "@/components/ui/Empty";
import { Card } from "@/components/ui/Card";
import { MasterPlanViewer } from "@/components/community/MasterPlanViewer";
import { MarketPanel } from "@/components/community/MarketPanel";
import { MarketTrends } from "@/components/community/MarketTrends";
import { ProvenanceChip } from "@/components/community/ProvenanceChip";
import { CatalystsPanel } from "@/components/community/CatalystsPanel";
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

  const profile = await getActiveProfile();
  const [whoRow, descRow] = await Promise.all([
    getTailoredCopy("who_its_for", profile?.id ?? null, { communityId: c.id }),
    getTailoredCopy("description", profile?.id ?? null, { communityId: c.id }),
  ]);
  const whoTailored = whoRow?.body
    ? { id: whoRow.id, body: whoRow.body, is_owner_edited: whoRow.is_owner_edited }
    : null;
  const descTailored = descRow?.body
    ? { id: descRow.id, body: descRow.body, is_owner_edited: descRow.is_owner_edited }
    : null;

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
          <ProvenanceChip confidence={c.data_confidence} sourceNote={c.source_note} />
          <Link
            href={`/compare?ids=${c.slug}`}
            className="rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-paper-300 transition-colors hover:bg-ink-700 hover:text-paper-100"
          >
            Compare
          </Link>
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
          <TailoredCopy
            kind="description"
            base={c.description_long}
            tailored={descTailored}
            hasProfile={Boolean(profile)}
            sessionLabel={profile?.session_label ?? null}
            target={{ communityId: c.id }}
            emptyLabel="No description yet"
            emptyHint="Content-grade narrative — character, lifestyle, what it's known for."
          />
        </div>
      </Section>

      {/* Area Intelligence — the USP */}
      {Array.isArray(c.catalysts) && c.catalysts.length > 0 && (
        <Section
          eyebrow="Area intelligence · the edge"
          title="What's driving value here"
        >
          <p className="mb-4 max-w-2xl text-sm text-paper-500">
            The roads, transport, schools and government projects in and around
            {" "}{c.name} — the &ldquo;why behind the price&rdquo; that listing
            portals don&apos;t show.
          </p>
          <CatalystsPanel catalysts={c.catalysts} />
        </Section>
      )}

      {/* Market — DLD transactions. A single 'dld-detail' row carries the
          full drill-down (interactive trends); the aggregate rows feed the
          compact segment table as a fallback. */}
      <Section eyebrow="Market · DLD" title="Transactions & trends (last 6 months)">
        {(() => {
          const all = c.market_snapshots ?? [];
          const detail = all.find((s) => s.source === "dld-detail" && (s.sample_txns?.length ?? 0) > 0);
          if (detail?.sample_txns?.length) {
            return <MarketTrends txns={detail.sample_txns} asOf={detail.as_of} />;
          }
          return <MarketPanel snapshots={all.filter((s) => s.source !== "dld-detail")} />;
        })()}
      </Section>

      {/* Who it's for — client-tailored */}
      <Section eyebrow="The buyer" title="Who it's for">
        <TailoredCopy
          kind="who_its_for"
          base={c.who_its_for_base}
          tailored={whoTailored}
          hasProfile={Boolean(profile)}
          sessionLabel={profile?.session_label ?? null}
          target={{ communityId: c.id }}
          emptyLabel="No profile yet"
          emptyHint="The base buyer profile. With a client session active, tailor it to speak directly to them."
        />
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

      {/* FAQs */}
      {Array.isArray(c.faqs) && c.faqs.length > 0 && (
        <Section eyebrow="Good to know" title="Frequently asked">
          <div className="divide-y divide-ink-500 overflow-hidden rounded-xl border border-ink-500">
            {c.faqs.map((f, i) => (
              <details key={i} className="group bg-ink-800/40 open:bg-ink-800/60">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-paper-100 marker:content-['']">
                  <span className="font-medium">{f.q}</span>
                  <span className="shrink-0 text-paper-500 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-paper-300">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

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
