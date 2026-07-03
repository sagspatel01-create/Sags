"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/db/types";

/**
 * Browser-side Supabase client. Used from Client Components for the live
 * admin-edit loop (writes to the same DB the front end reads).
 *
 * Returns `null` when Supabase is not configured so the UI can render a
 * "connect Supabase" state instead of throwing.
 */
export function createClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
