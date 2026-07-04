import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getCommunityBySlug } from "@/lib/data/communities";
import { pickAsset } from "@/lib/data/plans";
import { resolveStorageUrl } from "@/lib/supabase/storage";
import { NotConfigured } from "@/components/community/NotConfigured";
import { AssetUploader } from "@/components/community/AssetUploader";
import {
  HotspotEditor,
  type EditorHotspot,
} from "@/components/community/HotspotEditor";

export const dynamic = "force-dynamic";

export default async function PlanEditor({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const c = await getCommunityBySlug(slug);
  if (!c) notFound();

  const masterPlan = pickAsset(c.plan_assets, "master_plan");
  const imageUrl = masterPlan
    ? await resolveStorageUrl(masterPlan.image_url ?? masterPlan.storage_path)
    : null;

  const hotspots: EditorHotspot[] = (masterPlan?.plan_hotspots ?? []).map(
    (h) => {
      const coords = (h.coords ?? {}) as { x?: number; y?: number };
      return {
        id: h.id,
        label: h.label,
        category: h.category,
        x: typeof coords.x === "number" ? coords.x : 50,
        y: typeof coords.y === "number" ? coords.y : 50,
        target_type: h.target_type,
        target_sub_community_id: h.target_sub_community_id,
        target_url: h.target_url,
      };
    },
  );

  const subCommunities = [...c.sub_communities]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-10">
      <div className="flex items-center gap-2 text-sm text-paper-500">
        <Link href="/admin" className="hover:text-paper-200">
          Admin
        </Link>
        <span>/</span>
        <Link
          href={`/admin/communities/${c.slug}`}
          className="hover:text-paper-200"
        >
          {c.name}
        </Link>
        <span>/</span>
        <span className="text-paper-300">Master plan</span>
        <Link
          href={`/communities/${c.slug}`}
          className="ml-auto text-xs text-paper-500 hover:text-paper-200"
        >
          View live →
        </Link>
      </div>

      <h1 className="mt-4 font-display text-3xl text-paper-100">
        {c.name} · plan hotspots
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-paper-500">
        Author the interactive brochure. Drop navigation hotspots that drill
        into each sub-community, and Modon-style amenity markers for schools,
        parks, beaches and more. Everything you place here appears on the live
        community page immediately.
      </p>

      <div className="mt-8">
        {imageUrl ? (
          <HotspotEditor
            communitySlug={c.slug}
            planAssetId={masterPlan!.id}
            imageUrl={imageUrl}
            hotspots={hotspots}
            subCommunities={subCommunities}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-ink-500 bg-ink-800/40 p-10 text-center">
            <p className="text-eyebrow">No master plan uploaded</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-paper-500">
              Upload the developer&apos;s master-plan image to start placing
              hotspots.
            </p>
            <div className="mt-4 flex justify-center">
              <AssetUploader
                scope={{ communityId: c.id }}
                mode="plan"
                planKind="master_plan"
                label="Upload master plan"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
