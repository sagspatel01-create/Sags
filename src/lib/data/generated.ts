import { createClient } from "@/lib/supabase/server";
import type { GeneratedContent } from "@/lib/db/types";
import type { TailorKind } from "@/lib/tailoring";

export interface TailorTarget {
  communityId?: string | null;
  subCommunityId?: string | null;
}

/**
 * Latest tailored copy for a given client profile + entity + kind, or null.
 * When profileId is null we match rows with a null profile (cookie-only
 * sessions where Supabase wasn't configured at profile creation).
 */
export async function getTailoredCopy(
  kind: TailorKind,
  profileId: string | null,
  target: TailorTarget,
): Promise<GeneratedContent | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  let query = supabase
    .from("generated_content")
    .select("*")
    .eq("content_type", kind)
    .order("created_at", { ascending: false })
    .limit(1);

  query = profileId
    ? query.eq("client_profile_id", profileId)
    : query.is("client_profile_id", null);

  if (target.communityId) query = query.eq("community_id", target.communityId);
  else query = query.is("community_id", null);
  if (target.subCommunityId)
    query = query.eq("sub_community_id", target.subCommunityId);
  else query = query.is("sub_community_id", null);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as GeneratedContent;
}
