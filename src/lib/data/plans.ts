import { resolveStorageUrl } from "@/lib/supabase/storage";
import type { PlanAssetWithHotspots } from "./communities";
import type {
  PlanAssetView,
  HotspotView,
} from "@/components/community/MasterPlanViewer";

/** Resolve one plan asset (image + hotspots) into viewer-ready props. */
export async function toPlanView(
  asset: PlanAssetWithHotspots | null,
  hrefFor: (h: PlanAssetWithHotspots["plan_hotspots"][number]) => string | null,
): Promise<{ view: PlanAssetView; hotspots: HotspotView[] } | null> {
  if (!asset) return null;
  const url = await resolveStorageUrl(asset.image_url ?? asset.storage_path);
  const view: PlanAssetView = {
    title: asset.title,
    kind: asset.kind,
    url,
    width: asset.natural_width,
    height: asset.natural_height,
  };
  const hotspots: HotspotView[] = (asset.plan_hotspots ?? []).map((h) => {
    const coords = (h.coords ?? {}) as { x?: number; y?: number };
    return {
      id: h.id,
      label: h.label,
      category: h.category,
      x: typeof coords.x === "number" ? coords.x : 50,
      y: typeof coords.y === "number" ? coords.y : 50,
      href: hrefFor(h),
    };
  });
  return { view, hotspots };
}

/** Pick the first asset of a kind (master plans first). */
export function pickAsset(
  assets: PlanAssetWithHotspots[],
  kind: string,
): PlanAssetWithHotspots | null {
  const of = assets
    .filter((a) => a.kind === kind)
    .sort((a, b) => a.sort_order - b.sort_order);
  return of[0] ?? null;
}
