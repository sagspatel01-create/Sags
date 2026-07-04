"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin write actions — the live edit loop. Every update writes to the same
 * Supabase DB the front end reads, so edits are reflected immediately.
 * supabase-js insert/update typing is over-strict against our hand-authored
 * types, so we use a minimal typed handle.
 */
type Filter = Promise<{ error: unknown }> & {
  eq: (c: string, v: unknown) => Filter;
};
function db(supabase: unknown) {
  return supabase as unknown as {
    from: (t: string) => {
      insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
      update: (v: Record<string, unknown>) => Filter;
      delete: () => Filter;
    };
  };
}

function str(fd: FormData, k: string): string | null {
  const v = (fd.get(k) as string | null)?.trim();
  return v ? v : null;
}
function int(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function bool(fd: FormData, k: string): boolean {
  return fd.get(k) === "on";
}
function flt(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function tags(fd: FormData, k: string): string[] {
  const v = str(fd, k);
  return v ? v.split(",").map((t) => t.trim().replace(/\s+/g, "-").toLowerCase()).filter(Boolean) : [];
}

// ---- communities -----------------------------------------------------
export async function updateCommunity(slug: string, fd: FormData) {
  const supabase = await createClient();
  if (!supabase) return;
  await db(supabase)
    .from("communities")
    .update({
      status: str(fd, "status") ?? "mixed",
      positioning_tier: str(fd, "positioning_tier"),
      age_or_handover: str(fd, "age_or_handover"),
      sub_community_count: int(fd, "sub_community_count"),
      villa_count: int(fd, "villa_count"),
      townhouse_count: int(fd, "townhouse_count"),
      total_units: int(fd, "total_units"),
      description_long: str(fd, "description_long"),
      who_its_for_base: str(fd, "who_its_for_base"),
      character_tags: tags(fd, "character_tags"),
      is_placeholder: bool(fd, "is_placeholder"),
    })
    .eq("slug", slug);
  revalidatePath(`/admin/communities/${slug}`);
  revalidatePath(`/communities/${slug}`);
}

// ---- sub-communities -------------------------------------------------
export async function updateSubCommunity(
  id: string,
  backSlug: string,
  fd: FormData,
) {
  const supabase = await createClient();
  if (!supabase) return;
  await db(supabase)
    .from("sub_communities")
    .update({
      status: str(fd, "status") ?? "mixed",
      villa_count: int(fd, "villa_count"),
      townhouse_count: int(fd, "townhouse_count"),
      total_units: int(fd, "total_units"),
      description_long: str(fd, "description_long"),
      who_its_for_base: str(fd, "who_its_for_base"),
      is_placeholder: bool(fd, "is_placeholder"),
    })
    .eq("id", id);
  revalidatePath(`/admin/sub/${id}`);
  revalidatePath(`/communities/${backSlug}`);
}

// ---- phases ----------------------------------------------------------
export async function upsertPhase(subId: string, fd: FormData) {
  const supabase = await createClient();
  if (!supabase) return;
  const id = str(fd, "id");
  const row = {
    sub_community_id: subId,
    phase_name: str(fd, "phase_name") ?? "Phase",
    status: str(fd, "status") ?? "offplan",
    launch_date: str(fd, "launch_date"),
    launch_price_per_sqft: int(fd, "launch_price_per_sqft"),
    current_price_per_sqft: int(fd, "current_price_per_sqft"),
    units_in_phase: int(fd, "units_in_phase"),
  };
  if (id) await db(supabase).from("phases").update(row).eq("id", id);
  else await db(supabase).from("phases").insert(row);
  revalidatePath(`/admin/sub/${subId}`);
}
export async function deletePhase(subId: string, id: string) {
  const supabase = await createClient();
  if (!supabase) return;
  await db(supabase).from("phases").delete().eq("id", id);
  revalidatePath(`/admin/sub/${subId}`);
}

// ---- unit archetypes -------------------------------------------------
export async function upsertUnit(subId: string, fd: FormData) {
  const supabase = await createClient();
  if (!supabase) return;
  const id = str(fd, "id");
  const row = {
    sub_community_id: subId,
    phase_id: str(fd, "phase_id"),
    name: str(fd, "name"),
    unit_type: str(fd, "unit_type") ?? "villa",
    bedrooms: int(fd, "bedrooms"),
    bathrooms: int(fd, "bathrooms"),
    furnishing: str(fd, "furnishing"),
    completion_status: str(fd, "completion_status"),
    bua_sqft: int(fd, "bua_sqft"),
    plot_sqft: int(fd, "plot_sqft"),
    internal_sqft: int(fd, "internal_sqft"),
    external_sqft: int(fd, "external_sqft"),
    kitchen_type: str(fd, "kitchen_type"),
    config_flags: {
      maids: bool(fd, "cfg_maids"),
      study: bool(fd, "cfg_study"),
      storage: bool(fd, "cfg_storage"),
    },
    floors: int(fd, "floors"),
    parking_spaces: int(fd, "parking_spaces"),
    view_orientation: str(fd, "view_orientation"),
    has_pool: bool(fd, "has_pool"),
    has_garden: bool(fd, "has_garden"),
    has_balcony: bool(fd, "has_balcony"),
    price: int(fd, "price"),
    service_charge_per_sqft: int(fd, "service_charge_per_sqft"),
    condition: str(fd, "condition"),
  };
  if (id) await db(supabase).from("unit_archetypes").update(row).eq("id", id);
  else await db(supabase).from("unit_archetypes").insert(row);
  revalidatePath(`/admin/sub/${subId}`);
}
export async function deleteUnit(subId: string, id: string) {
  const supabase = await createClient();
  if (!supabase) return;
  await db(supabase).from("unit_archetypes").delete().eq("id", id);
  revalidatePath(`/admin/sub/${subId}`);
}

// ---- plan hotspots (the interactive-brochure editor) -----------------
// A navigation hotspot drills to a sub-community; an amenity hotspot
// (school/park/beach…) is a non-linking Modon-style marker. coords are
// stored as percentages {x,y} of the source image.
function hotspotRow(fd: FormData) {
  const subId = str(fd, "target_sub_community_id");
  const url = str(fd, "target_url");
  const navigation = Boolean(subId);
  return {
    label: str(fd, "label"),
    category: str(fd, "category") ?? (navigation ? "navigation" : "park"),
    coords: { x: flt(fd, "x") ?? 50, y: flt(fd, "y") ?? 50 },
    shape: "point",
    target_type: navigation ? "sub_community" : "url",
    target_sub_community_id: subId,
    target_url: navigation ? null : url,
  };
}

export async function createHotspot(communitySlug: string, fd: FormData) {
  const supabase = await createClient();
  if (!supabase) return;
  await db(supabase)
    .from("plan_hotspots")
    .insert({ plan_asset_id: str(fd, "plan_asset_id"), ...hotspotRow(fd) });
  revalidatePath(`/admin/communities/${communitySlug}/plan`);
  revalidatePath(`/communities/${communitySlug}`);
}

export async function updateHotspot(
  communitySlug: string,
  id: string,
  fd: FormData,
) {
  const supabase = await createClient();
  if (!supabase) return;
  await db(supabase).from("plan_hotspots").update(hotspotRow(fd)).eq("id", id);
  revalidatePath(`/admin/communities/${communitySlug}/plan`);
  revalidatePath(`/communities/${communitySlug}`);
}

/** Lightweight position-only save (used when a marker is dragged). */
export async function moveHotspot(
  communitySlug: string,
  id: string,
  x: number,
  y: number,
) {
  const supabase = await createClient();
  if (!supabase) return;
  await db(supabase)
    .from("plan_hotspots")
    .update({ coords: { x, y } })
    .eq("id", id);
  revalidatePath(`/admin/communities/${communitySlug}/plan`);
  revalidatePath(`/communities/${communitySlug}`);
}

export async function deleteHotspot(communitySlug: string, id: string) {
  const supabase = await createClient();
  if (!supabase) return;
  await db(supabase).from("plan_hotspots").delete().eq("id", id);
  revalidatePath(`/admin/communities/${communitySlug}/plan`);
  revalidatePath(`/communities/${communitySlug}`);
}

// ---- transactions (Phase-2 groundwork; manual entry) -----------------
export async function addTransaction(subId: string, backSlug: string, fd: FormData) {
  const supabase = await createClient();
  if (!supabase) return;
  await db(supabase).from("transactions").insert({
    sub_community_id: subId,
    price: int(fd, "price"),
    price_per_sqft: int(fd, "price_per_sqft"),
    unit_type: str(fd, "unit_type"),
    bedrooms: int(fd, "bedrooms"),
    bua_sqft: int(fd, "bua_sqft"),
    transaction_date: str(fd, "transaction_date") ?? new Date().toISOString().slice(0, 10),
    source: str(fd, "source") ?? "manual",
  });
  revalidatePath(`/admin/sub/${subId}`);
  revalidatePath(`/communities/${backSlug}`);
  redirect(`/admin/sub/${subId}`);
}
