import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/db/types";

/**
 * Service-role client for trusted server jobs (e.g. the weekly DLD sync)
 * that run without a user session. Bypasses RLS via the service key, so it
 * is used only in server-only code that is never reachable from the client.
 * Returns null when the service key or URL is absent.
 */
export function createServiceClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;
  return createServerClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

/**
 * Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions. Reads/writes the session cookie. Returns `null` when
 * Supabase is not configured.
 */
export async function createClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` was called from a Server Component. Safe to ignore when
          // middleware is refreshing the session.
        }
      },
    },
  });
}
