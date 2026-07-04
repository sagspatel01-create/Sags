import { createClient } from "@/lib/supabase/server";

export interface DealOption {
  key: string;
  communitySlug: string;
  communityName: string;
  developer: string | null;
  status: string;
  tier: string | null;
  unitName: string | null;
  unitType: string;
  bedrooms: number | null;
  price: number;
  bua_sqft: number | null;
  service_charge_per_sqft: number | null;
}

/**
 * Flattened list of priced unit archetypes as ready-to-underwrite deals.
 * Only units with a real price appear — the underwriter starts from actual
 * data, not guesses.
 */
export async function getDealOptions(): Promise<DealOption[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("unit_archetypes")
    .select(
      `id, name, unit_type, bedrooms, price, bua_sqft, service_charge_per_sqft,
       sub_community:sub_communities!inner(
         community:communities!inner(slug, name, status, positioning_tier,
           developer:developers(name)))`,
    )
    .not("price", "is", null)
    .order("price");
  if (error || !data) return [];

  type Row = {
    id: string;
    name: string | null;
    unit_type: string;
    bedrooms: number | null;
    price: number;
    bua_sqft: number | null;
    service_charge_per_sqft: number | null;
    sub_community: {
      community: {
        slug: string;
        name: string;
        status: string;
        positioning_tier: string | null;
        developer: { name: string } | { name: string }[] | null;
      } | { community: unknown }[];
    } | null;
  };

  const out: DealOption[] = [];
  for (const r of data as unknown as Row[]) {
    const sc = Array.isArray(r.sub_community) ? r.sub_community[0] : r.sub_community;
    const c = sc && (Array.isArray(sc.community) ? sc.community[0] : sc.community);
    if (!c) continue;
    const dev = Array.isArray(c.developer) ? c.developer[0] : c.developer;
    out.push({
      key: r.id,
      communitySlug: c.slug,
      communityName: c.name,
      developer: dev?.name ?? null,
      status: c.status,
      tier: c.positioning_tier,
      unitName: r.name,
      unitType: r.unit_type,
      bedrooms: r.bedrooms,
      price: Number(r.price),
      bua_sqft: r.bua_sqft != null ? Number(r.bua_sqft) : null,
      service_charge_per_sqft:
        r.service_charge_per_sqft != null ? Number(r.service_charge_per_sqft) : null,
    });
  }
  return out;
}
