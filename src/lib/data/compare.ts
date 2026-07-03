import { createClient } from "@/lib/supabase/server";
import type {
  Community,
  Developer,
  SubCommunity,
  UnitArchetype,
  Phase,
  CapitalGrowth,
  RentalData,
  Absorption,
  PaymentPlan,
  CommuteTime,
} from "@/lib/db/types";

export interface SubCommunityCompare extends SubCommunity {
  unit_archetypes: UnitArchetype[];
  phases: Phase[];
  capital_growth: CapitalGrowth[];
  rental_data: RentalData[];
  absorption: Absorption[];
}

export interface CommunityCompare extends Community {
  developer: Developer | null;
  sub_communities: SubCommunityCompare[];
  payment_plans: PaymentPlan[];
  commute_times: CommuteTime[];
}

/**
 * Fetch 2–4 communities with everything the comparison engine needs.
 * Results are re-ordered to match the requested slug order.
 */
export async function getCommunitiesForCompare(
  slugs: string[],
): Promise<CommunityCompare[]> {
  const supabase = await createClient();
  if (!supabase || slugs.length === 0) return [];
  const { data, error } = await supabase
    .from("communities")
    .select(
      `*,
       developer:developers(*),
       sub_communities(*, unit_archetypes(*), phases(*), capital_growth(*), rental_data(*), absorption(*)),
       payment_plans(*),
       commute_times(*)`,
    )
    .in("slug", slugs);
  if (error || !data) return [];
  const bySlug = new Map(
    (data as unknown as CommunityCompare[]).map((c) => [c.slug, c]),
  );
  return slugs
    .map((s) => bySlug.get(s))
    .filter((c): c is CommunityCompare => Boolean(c));
}
