import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getCommunityBySlug } from "@/lib/data/communities";
import { updateCommunity } from "@/app/actions/admin";
import { NotConfigured } from "@/components/community/NotConfigured";
import {
  Field,
  Textarea,
  Select,
  Checkbox,
  SaveBar,
  STATUS_OPTIONS,
  TIER_OPTIONS,
} from "@/components/admin/fields";

export const dynamic = "force-dynamic";

export default async function AdminCommunity({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const c = await getCommunityBySlug(slug);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      <div className="flex items-center gap-2 text-sm text-paper-500">
        <Link href="/admin" className="hover:text-paper-200">Admin</Link>
        <span>/</span>
        <span className="text-paper-300">{c.name}</span>
        <Link
          href={`/communities/${c.slug}`}
          className="ml-auto text-xs text-paper-500 hover:text-paper-200"
        >
          View live →
        </Link>
      </div>

      <h1 className="mt-4 font-display text-3xl text-paper-100">{c.name}</h1>
      <p className="text-sm text-paper-500">{c.developer?.name ?? "—"}</p>

      <Link
        href={`/admin/communities/${c.slug}/plan`}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent-500/40 bg-accent-500/10 px-4 py-2 text-sm text-accent-400 transition-colors hover:bg-accent-500/20"
      >
        ◲ Edit master-plan hotspots →
      </Link>

      <form action={updateCommunity.bind(null, slug)} className="mt-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Status" name="status" defaultValue={c.status} options={STATUS_OPTIONS} />
          <Select label="Positioning tier" name="positioning_tier" defaultValue={c.positioning_tier} options={TIER_OPTIONS} allowEmpty />
          <Field label="Age / handover" name="age_or_handover" defaultValue={c.age_or_handover} placeholder="e.g. Handover from 2019" />
          <Field label="Sub-communities (count)" name="sub_community_count" type="number" defaultValue={c.sub_community_count} />
          <Field label="Villas" name="villa_count" type="number" defaultValue={c.villa_count} />
          <Field label="Townhouses" name="townhouse_count" type="number" defaultValue={c.townhouse_count} />
          <Field label="Total units" name="total_units" type="number" defaultValue={c.total_units} />
          <Field label="Character tags" name="character_tags" defaultValue={(c.character_tags ?? []).join(", ")} hint="comma-separated" />
        </div>
        <Textarea label="Description" name="description_long" defaultValue={c.description_long} rows={5} />
        <Textarea label="Who it's for (base)" name="who_its_for_base" defaultValue={c.who_its_for_base} rows={4} />
        <Checkbox label="Still a skeleton (mark off once depth is filled)" name="is_placeholder" defaultChecked={c.is_placeholder} />
        <SaveBar />
      </form>

      <div className="mt-12">
        <p className="text-eyebrow">Sub-communities</p>
        <div className="mt-3 divide-y divide-ink-500 overflow-hidden rounded-xl border border-ink-500">
          {c.sub_communities.length === 0 ? (
            <p className="bg-ink-800/40 px-5 py-4 text-sm text-paper-500">None.</p>
          ) : (
            [...c.sub_communities]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/sub/${s.id}`}
                  className="flex items-center justify-between bg-ink-800/40 px-5 py-3 text-sm transition-colors hover:bg-ink-700"
                >
                  <span className="text-paper-100">{s.name}</span>
                  <span className="text-xs text-paper-500">
                    {s.phases.length} phase{s.phases.length === 1 ? "" : "s"} ·{" "}
                    {s.unit_archetypes.length} unit type
                    {s.unit_archetypes.length === 1 ? "" : "s"} · edit →
                  </span>
                </Link>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
