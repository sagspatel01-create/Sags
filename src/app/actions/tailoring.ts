"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveProfile } from "@/lib/client-profile.server";
import { generateText, GENERATION_MODEL } from "@/lib/anthropic";
import {
  buildTailorPrompt,
  type TailorKind,
  type TailorEntity,
} from "@/lib/tailoring";
import { TIER_LABEL } from "@/lib/format";
import type { PositioningTier } from "@/lib/db/types";

export interface TailorResult {
  ok: boolean;
  error?: string;
}

type Target = { communityId?: string | null; subCommunityId?: string | null };

async function loadEntity(
  target: Target,
): Promise<TailorEntity | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  if (target.communityId) {
    const { data } = await supabase
      .from("communities")
      .select(
        "name, status, positioning_tier, master_plan_features, who_its_for_base, description_long, developer:developers(name)",
      )
      .eq("id", target.communityId)
      .maybeSingle();
    if (!data) return null;
    const d = data as unknown as {
      name: string;
      status: string;
      positioning_tier: PositioningTier | null;
      master_plan_features: unknown;
      who_its_for_base: string | null;
      description_long: string | null;
      developer: { name: string } | null;
    };
    return {
      name: d.name,
      kind_label: "community",
      developer: d.developer?.name ?? null,
      status: d.status,
      tier: d.positioning_tier ? TIER_LABEL[d.positioning_tier] : null,
      master_plan_features: Array.isArray(d.master_plan_features)
        ? (d.master_plan_features as string[])
        : [],
      base_who_its_for: d.who_its_for_base,
      base_description: d.description_long,
    };
  }

  if (target.subCommunityId) {
    const { data } = await supabase
      .from("sub_communities")
      .select(
        "name, status, who_its_for_base, description_long, community:communities(name, positioning_tier, developer:developers(name))",
      )
      .eq("id", target.subCommunityId)
      .maybeSingle();
    if (!data) return null;
    const d = data as unknown as {
      name: string;
      status: string;
      who_its_for_base: string | null;
      description_long: string | null;
      community: {
        name: string;
        positioning_tier: PositioningTier | null;
        developer: { name: string } | null;
      } | null;
    };
    return {
      name: `${d.name}${d.community ? `, ${d.community.name}` : ""}`,
      kind_label: "sub-community",
      developer: d.community?.developer?.name ?? null,
      status: d.status,
      tier: d.community?.positioning_tier
        ? TIER_LABEL[d.community.positioning_tier]
        : null,
      master_plan_features: [],
      base_who_its_for: d.who_its_for_base,
      base_description: d.description_long,
    };
  }
  return null;
}

// A minimal typed write handle (supabase-js insert typing is over-strict
// against our hand-authored Database types). Filter is thenable + chainable,
// mirroring the real query builder.
type Filter = Promise<{ error: unknown }> & {
  eq: (c: string, val: unknown) => Filter;
};
function writeHandle(supabase: unknown) {
  return supabase as unknown as {
    from: (t: string) => {
      insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
      update: (v: Record<string, unknown>) => Filter;
      delete: () => Filter;
    };
  };
}

export async function generateTailoredCopy(
  kind: TailorKind,
  target: Target,
): Promise<TailorResult> {
  const profile = await getActiveProfile();
  if (!profile)
    return { ok: false, error: "Start a client session to tailor copy." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase not configured." };

  const entity = await loadEntity(target);
  if (!entity) return { ok: false, error: "Community not found." };

  const { system, prompt } = buildTailorPrompt(kind, entity, profile);
  const body = await generateText({ system, prompt });
  if (!body)
    return {
      ok: false,
      error:
        "Generation unavailable — add ANTHROPIC_API_KEY, then try again.",
    };

  const db = writeHandle(supabase);
  const { error } = await db.from("generated_content").insert({
    content_type: kind,
    client_profile_id: profile.id ?? null,
    community_id: target.communityId ?? null,
    sub_community_id: target.subCommunityId ?? null,
    body,
    prompt_snapshot: prompt,
    model: GENERATION_MODEL,
    is_owner_edited: false,
  });
  if (error) return { ok: false, error: "Could not save the tailored copy." };
  return { ok: true };
}

export async function saveTailoredOverride(
  id: string,
  body: string,
): Promise<TailorResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase not configured." };
  const db = writeHandle(supabase);
  const { error } = await db
    .from("generated_content")
    .update({ body, is_owner_edited: true })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not save your edit." };
  return { ok: true };
}

export async function revertTailored(
  kind: TailorKind,
  target: Target,
): Promise<TailorResult> {
  const profile = await getActiveProfile();
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase not configured." };
  const db = writeHandle(supabase);
  const col = target.communityId ? "community_id" : "sub_community_id";
  const val = target.communityId ?? target.subCommunityId ?? "";
  const { error } = await db
    .from("generated_content")
    .delete()
    .eq("content_type", kind)
    .eq(col, val);
  if (error) return { ok: false, error: "Could not revert." };
  // profile is unused beyond guarding intent; revert clears entity+kind rows.
  void profile;
  return { ok: true };
}
