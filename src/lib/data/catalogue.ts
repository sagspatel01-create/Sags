import { createClient } from "@/lib/supabase/server";
import type { PositioningTier, StatusTag } from "@/lib/db/types";

/** A community flattened into the fields the store filters and displays. */
export interface CatalogueRow {
  id: string;
  name: string;
  slug: string;
  status: StatusTag;
  tier: PositioningTier | null;
  developerName: string | null;
  developerSlug: string | null;
  tags: string[];
  subCount: number;

  unitTypes: string[];
  bedrooms: number[];
  bathrooms: number[];
  bua: number[];
  plot: number[];
  kitchenTypes: string[];
  prices: number[];
  serviceCharges: number[];
  phases: string[];
  appreciation: number[];
  yields: number[];
  absorption: number[];
  commuteMin: number | null;
}

type Raw = {
  id: string;
  name: string;
  slug: string;
  status: StatusTag;
  positioning_tier: PositioningTier | null;
  character_tags: string[] | null;
  sub_community_count: number | null;
  developer: { name: string; slug: string } | null;
  commute_times: { minutes_driving: number | null }[];
  sub_communities: {
    unit_archetypes: {
      unit_type: string;
      bedrooms: number | null;
      bathrooms: number | null;
      bua_sqft: number | null;
      plot_sqft: number | null;
      kitchen_type: string | null;
      price: number | null;
      service_charge_per_sqft: number | null;
    }[];
    phases: { phase_name: string }[];
    capital_growth: { pct_change: number | null }[];
    rental_data: { gross_yield_pct: number | null }[];
    absorption: { absorption_rate: number | null }[];
  }[];
};

function nums(vals: (number | null | undefined)[]): number[] {
  return vals.filter((v): v is number => typeof v === "number");
}
function uniq(vals: (string | null | undefined)[]): string[] {
  return [...new Set(vals.filter((v): v is string => Boolean(v)))];
}

export async function getCatalogue(): Promise<CatalogueRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("communities")
    .select(
      `id,name,slug,status,positioning_tier,character_tags,sub_community_count,
       developer:developers(name,slug),
       commute_times(minutes_driving),
       sub_communities(
         unit_archetypes(unit_type,bedrooms,bathrooms,bua_sqft,plot_sqft,kitchen_type,price,service_charge_per_sqft),
         phases(phase_name),
         capital_growth(pct_change),
         rental_data(gross_yield_pct),
         absorption(absorption_rate)
       )`,
    )
    .order("name");
  if (error || !data) return [];

  return (data as unknown as Raw[]).map((c) => {
    const units = c.sub_communities.flatMap((s) => s.unit_archetypes ?? []);
    const phases = c.sub_communities.flatMap((s) => s.phases ?? []);
    const caps = c.sub_communities.flatMap((s) => s.capital_growth ?? []);
    const rents = c.sub_communities.flatMap((s) => s.rental_data ?? []);
    const abs = c.sub_communities.flatMap((s) => s.absorption ?? []);
    const commutes = nums(c.commute_times.map((t) => t.minutes_driving));

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      tier: c.positioning_tier,
      developerName: c.developer?.name ?? null,
      developerSlug: c.developer?.slug ?? null,
      tags: c.character_tags ?? [],
      subCount: c.sub_community_count ?? c.sub_communities.length,
      unitTypes: uniq(units.map((u) => u.unit_type)),
      bedrooms: nums(units.map((u) => u.bedrooms)),
      bathrooms: nums(units.map((u) => u.bathrooms)),
      bua: nums(units.map((u) => u.bua_sqft)),
      plot: nums(units.map((u) => u.plot_sqft)),
      kitchenTypes: uniq(units.map((u) => u.kitchen_type)),
      prices: nums(units.map((u) => u.price)),
      serviceCharges: nums(units.map((u) => u.service_charge_per_sqft)),
      phases: uniq(phases.map((p) => p.phase_name)),
      appreciation: nums(caps.map((g) => g.pct_change)),
      yields: nums(rents.map((r) => r.gross_yield_pct)),
      absorption: nums(abs.map((a) => a.absorption_rate)),
      commuteMin: commutes.length ? Math.min(...commutes) : null,
    };
  });
}
