import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getSubCommunityById } from "@/lib/data/communities";
import { updateSubCommunity } from "@/app/actions/admin";
import { NotConfigured } from "@/components/community/NotConfigured";
import { PhaseForm } from "@/components/admin/PhaseForm";
import { UnitForm } from "@/components/admin/UnitForm";
import {
  Field,
  Textarea,
  Select,
  Checkbox,
  SaveBar,
  STATUS_OPTIONS,
} from "@/components/admin/fields";

export const dynamic = "force-dynamic";

export default async function AdminSub({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const s = await getSubCommunityById(id);
  if (!s) notFound();

  const backSlug = s.community?.slug ?? "";

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      <div className="flex items-center gap-2 text-sm text-paper-500">
        <Link href="/admin" className="hover:text-paper-200">Admin</Link>
        <span>/</span>
        <Link href={`/admin/communities/${backSlug}`} className="hover:text-paper-200">
          {s.community?.name ?? "Community"}
        </Link>
        <span>/</span>
        <span className="text-paper-300">{s.name}</span>
      </div>

      <h1 className="mt-4 font-display text-3xl text-paper-100">{s.name}</h1>

      {/* Sub-community core */}
      <form
        action={updateSubCommunity.bind(null, id, backSlug)}
        className="mt-8 space-y-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Status" name="status" defaultValue={s.status} options={STATUS_OPTIONS} />
          <Field label="Villas" name="villa_count" type="number" defaultValue={s.villa_count} />
          <Field label="Townhouses" name="townhouse_count" type="number" defaultValue={s.townhouse_count} />
          <Field label="Total units" name="total_units" type="number" defaultValue={s.total_units} />
        </div>
        <Textarea label="Description" name="description_long" defaultValue={s.description_long} rows={4} />
        <Textarea label="Who it's for (base)" name="who_its_for_base" defaultValue={s.who_its_for_base} rows={3} />
        <Checkbox label="Still a skeleton" name="is_placeholder" defaultChecked={s.is_placeholder} />
        <SaveBar />
      </form>

      {/* Phases */}
      <div className="mt-12">
        <p className="text-eyebrow">Phases · price journey</p>
        <div className="mt-3 space-y-3">
          {[...s.phases]
            .sort((a, b) => a.phase_name.localeCompare(b.phase_name))
            .map((p) => (
              <PhaseForm key={p.id} subId={id} phase={p} />
            ))}
          <PhaseForm subId={id} />
        </div>
      </div>

      {/* Unit archetypes */}
      <div className="mt-12">
        <p className="text-eyebrow">Unit archetypes</p>
        <div className="mt-3 space-y-4">
          {s.unit_archetypes.map((u) => (
            <UnitForm key={u.id} subId={id} unit={u} phases={s.phases} />
          ))}
          <UnitForm subId={id} phases={s.phases} />
        </div>
      </div>
    </div>
  );
}
