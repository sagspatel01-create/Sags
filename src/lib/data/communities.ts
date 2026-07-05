import { createClient } from "@/lib/supabase/server";
import type {
  Community,
  Developer,
  SubCommunity,
  Phase,
  UnitArchetype,
  Document,
  PlanAsset,
  PlanHotspot,
  CommuteTime,
  PaymentPlan,
} from "@/lib/db/types";

export interface PlanAssetWithHotspots extends PlanAsset {
  plan_hotspots: PlanHotspot[];
}

export interface CommunityListItem extends Community {
  developer: Pick<Developer, "id" | "name" | "slug"> | null;
  sub_communities: { count: number }[];
}

export interface SubCommunityWithChildren extends SubCommunity {
  phases: Phase[];
  unit_archetypes: UnitArchetype[];
}

export interface MarketSnapshot {
  id: string;
  unit_type: string | null;
  reg_type: string | null;
  period_start: string | null;
  period_end: string | null;
  txn_count: number | null;
  avg_price: number | null;
  median_price: number | null;
  avg_price_per_sqft: number | null;
  min_price: number | null;
  max_price: number | null;
  source: string;
  as_of: string;
}

export interface CommunityDetail extends Community {
  developer: Developer | null;
  sub_communities: SubCommunityWithChildren[];
  documents: Document[];
  plan_assets: PlanAssetWithHotspots[];
  commute_times: CommuteTime[];
  payment_plans: PaymentPlan[];
  market_snapshots: MarketSnapshot[];
  faqs: { q: string; a: string }[] | null;
}

/** Full catalogue for the /communities index. */
export async function getCommunities(): Promise<CommunityListItem[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("communities")
    .select("*, developer:developers(id,name,slug), sub_communities(count)")
    .order("name");
  if (error || !data) return [];
  return data as unknown as CommunityListItem[];
}

/** One community dashboard, with everything that hangs off it. */
export async function getCommunityBySlug(
  slug: string,
): Promise<CommunityDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("communities")
    .select(
      `*,
       developer:developers(*),
       sub_communities(*, phases(*), unit_archetypes(*)),
       documents(*),
       plan_assets(*, plan_hotspots!plan_hotspots_plan_asset_id_fkey(*)),
       commute_times(*),
       payment_plans(*),
       market_snapshots(*)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as CommunityDetail;
}

export interface SubCommunityDetail extends SubCommunity {
  community: Pick<Community, "id" | "name" | "slug" | "status"> | null;
  phases: Phase[];
  unit_archetypes: UnitArchetype[];
  documents: Document[];
  plan_assets: PlanAssetWithHotspots[];
}

export interface SubCommunityAdmin extends SubCommunity {
  community: Pick<Community, "id" | "name" | "slug"> | null;
  phases: Phase[];
  unit_archetypes: UnitArchetype[];
}

/** Fetch a sub-community by id with its phases + unit archetypes (admin). */
export async function getSubCommunityById(
  id: string,
): Promise<SubCommunityAdmin | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("sub_communities")
    .select(
      `*, community:communities(id,name,slug), phases(*), unit_archetypes(*)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as SubCommunityAdmin;
}

export async function getSubCommunity(
  communitySlug: string,
  subSlug: string,
): Promise<SubCommunityDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  // Resolve the parent community first (slugs are unique per community).
  const { data: community } = await supabase
    .from("communities")
    .select("id")
    .eq("slug", communitySlug)
    .maybeSingle();
  if (!community) return null;

  const { data, error } = await supabase
    .from("sub_communities")
    .select(
      `*,
       community:communities(id,name,slug,status),
       phases(*),
       unit_archetypes(*),
       documents(*),
       plan_assets(*, plan_hotspots!plan_hotspots_plan_asset_id_fkey(*))`,
    )
    .eq("community_id", community.id)
    .eq("slug", subSlug)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as SubCommunityDetail;
}
