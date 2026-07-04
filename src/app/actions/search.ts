"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, GENERATION_MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";

export interface SearchFilters {
  unit_type?: "villa" | "townhouse" | null;
  min_bedrooms?: number | null;
  min_bathrooms?: number | null;
  min_bua_sqft?: number | null;
  min_plot_sqft?: number | null;
  max_price?: number | null;
  min_price?: number | null;
}

export interface UnitMatch {
  id: string;
  communitySlug: string;
  communityName: string;
  developer: string | null;
  status: string;
  subName: string | null;
  unitName: string | null;
  unitType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  bua_sqft: number | null;
  plot_sqft: number | null;
  price: number | null;
  hasGarden: boolean | null;
  hasPool: boolean | null;
  miss?: string[]; // which criteria a "near" match misses
}

/** Parse a free-text client brief into structured search filters via Claude. */
export async function parseRequirements(
  text: string,
): Promise<{ filters: SearchFilters | null; error?: string }> {
  const client = getAnthropic();
  if (!client) return { filters: null, error: "Anthropic not configured." };

  const tool: Anthropic.Tool = {
    name: "set_search",
    description:
      "Translate a Dubai property client brief into search filters. Only set " +
      "a field if the brief clearly implies it; leave others null. Budget → " +
      "max_price. '4 bedroom' → min_bedrooms 4. '3000+ sqft BUA' → " +
      "min_bua_sqft 3000. '1500+ plot' → min_plot_sqft 1500.",
    input_schema: {
      type: "object",
      properties: {
        unit_type: { type: "string", enum: ["villa", "townhouse"] },
        min_bedrooms: { type: "number" },
        min_bathrooms: { type: "number" },
        min_bua_sqft: { type: "number" },
        min_plot_sqft: { type: "number" },
        max_price: { type: "number", description: "AED" },
        min_price: { type: "number", description: "AED" },
      },
    },
  };
  try {
    const res = await client.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 500,
      tools: [tool],
      tool_choice: { type: "tool", name: "set_search" },
      messages: [{ role: "user", content: `Client brief: ${text}` }],
    });
    const t = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    return { filters: (t?.input as SearchFilters) ?? {} };
  } catch (e) {
    return { filters: null, error: e instanceof Error ? e.message : "Parse failed." };
  }
}

type Row = {
  id: string;
  name: string | null;
  unit_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  bua_sqft: number | null;
  plot_sqft: number | null;
  price: number | null;
  has_garden: boolean | null;
  has_pool: boolean | null;
  sub_community: {
    name: string;
    community: {
      slug: string; name: string; status: string;
      developer: { name: string } | { name: string }[] | null;
    } | { slug: string }[];
  } | { name: string }[] | null;
};

function toMatch(r: Row): UnitMatch {
  const sc = Array.isArray(r.sub_community) ? r.sub_community[0] : r.sub_community;
  const c = sc && "community" in sc ? (Array.isArray(sc.community) ? sc.community[0] : sc.community) : null;
  const dev = c && "developer" in c ? (Array.isArray(c.developer) ? c.developer[0] : c.developer) : null;
  return {
    id: r.id,
    communitySlug: c && "slug" in c ? c.slug : "",
    communityName: c && "name" in c ? c.name : "—",
    developer: dev?.name ?? null,
    status: c && "status" in c ? c.status : "mixed",
    subName: sc && "name" in sc ? sc.name : null,
    unitName: r.name,
    unitType: r.unit_type,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    bua_sqft: r.bua_sqft != null ? Number(r.bua_sqft) : null,
    plot_sqft: r.plot_sqft != null ? Number(r.plot_sqft) : null,
    price: r.price != null ? Number(r.price) : null,
    hasGarden: r.has_garden,
    hasPool: r.has_pool,
  };
}

// Does a unit satisfy every set criterion? Returns the list of misses.
function evaluate(m: UnitMatch, f: SearchFilters): string[] {
  const miss: string[] = [];
  if (f.unit_type && m.unitType !== f.unit_type) miss.push(f.unit_type);
  if (f.min_bedrooms != null && (m.bedrooms ?? 0) < f.min_bedrooms) miss.push(`${f.min_bedrooms}+ beds`);
  if (f.min_bathrooms != null && (m.bathrooms ?? 0) < f.min_bathrooms) miss.push(`${f.min_bathrooms}+ baths`);
  if (f.min_bua_sqft != null && (m.bua_sqft ?? 0) < f.min_bua_sqft) miss.push(`${f.min_bua_sqft}+ BUA`);
  if (f.min_plot_sqft != null && (m.plot_sqft ?? 0) < f.min_plot_sqft) miss.push(`${f.min_plot_sqft}+ plot`);
  if (f.max_price != null && (m.price ?? Infinity) > f.max_price) miss.push("budget");
  if (f.min_price != null && (m.price ?? 0) < f.min_price) miss.push("min price");
  return miss;
}

/**
 * Requirement-based property search over real unit archetypes — the
 * Bayut/PF-style read. Returns exact matches plus "near" matches (miss one
 * criterion) so the broker always has something to show and can see how close
 * the market gets to the brief.
 */
export async function searchMatchingUnits(
  f: SearchFilters,
): Promise<{ exact: UnitMatch[]; near: UnitMatch[] }> {
  const supabase = await createClient();
  if (!supabase) return { exact: [], near: [] };
  const { data, error } = await supabase
    .from("unit_archetypes")
    .select(
      `id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft, price,
       has_garden, has_pool,
       sub_community:sub_communities!inner(name,
         community:communities!inner(slug, name, status,
           developer:developers(name)))`,
    )
    .order("price");
  if (error || !data) return { exact: [], near: [] };

  const all = (data as unknown as Row[]).map(toMatch);
  const exact: UnitMatch[] = [];
  const near: UnitMatch[] = [];
  for (const m of all) {
    const miss = evaluate(m, f);
    if (miss.length === 0) exact.push(m);
    else if (miss.length === 1) near.push({ ...m, miss });
  }
  return { exact, near: near.slice(0, 12) };
}
