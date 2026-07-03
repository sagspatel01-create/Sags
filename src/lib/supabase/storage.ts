import { createClient } from "./server";
import { ASSET_BUCKET } from "./constants";

export { ASSET_BUCKET };

/**
 * Resolve a stored reference to a displayable URL. A value that is already
 * an http(s) URL is returned as-is; otherwise it is treated as a path in the
 * private `assets` bucket and a short-lived signed URL is minted.
 */
export async function resolveStorageUrl(
  pathOrUrl: string | null,
): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(pathOrUrl, 60 * 60);
  return data?.signedUrl ?? null;
}
