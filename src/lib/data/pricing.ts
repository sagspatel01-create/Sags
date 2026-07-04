import { createClient } from "@/lib/supabase/server";

export interface CommunityPricing {
  /** Lowest priced unit archetype in the community (AED). */
  from: number;
  /** Distinct bedroom counts available. */
  beds: number[];
  /** Number of priced unit archetypes. */
  count: number;
}

/**
 * Entry pricing per master community, derived from real unit-archetype
 * prices (which resolve at the sub-community level). Powers the "from
 * AED X" line and the budget-match signal on the client shortlist — so
 * the achievable list is concrete where real prices exist, and silently
 * falls back to tier bands where they don't. Honesty-preserving: only
 * priced units contribute; nothing is inferred.
 */
export async function getCommunityPricing(): Promise<Map<string, CommunityPricing>> {
  const supabase = await createClient();
  const out = new Map<string, CommunityPricing>();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("unit_archetypes")
    .select("price, bedrooms, sub_community:sub_communities!inner(community_id)")
    .not("price", "is", null);
  if (error || !data) return out;

  type Row = {
    price: number | null;
    bedrooms: number | null;
    sub_community: { community_id: string } | { community_id: string }[] | null;
  };

  for (const r of data as unknown as Row[]) {
    const sc = Array.isArray(r.sub_community) ? r.sub_community[0] : r.sub_community;
    const cid = sc?.community_id;
    if (!cid || r.price == null) continue;
    const cur = out.get(cid) ?? { from: r.price, beds: [], count: 0 };
    cur.from = Math.min(cur.from, r.price);
    cur.count += 1;
    if (r.bedrooms != null && !cur.beds.includes(r.bedrooms)) cur.beds.push(r.bedrooms);
    out.set(cid, cur);
  }
  for (const v of out.values()) v.beds.sort((a, b) => a - b);
  return out;
}
