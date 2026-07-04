"use server";

import { createClient } from "@/lib/supabase/server";

export interface ReportResult {
  ok: boolean;
  error?: string;
}

type Filter = Promise<{ error: unknown }> & {
  eq: (c: string, v: unknown) => Filter;
};
function handle(supabase: unknown) {
  return supabase as unknown as {
    from: (t: string) => {
      update: (v: Record<string, unknown>) => Filter;
      delete: () => Filter;
    };
  };
}

export async function saveReport(
  id: string,
  body: string,
): Promise<ReportResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase not configured." };
  const { error } = await handle(supabase)
    .from("generated_content")
    .update({ body, is_owner_edited: true })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not save your edit." };
  return { ok: true };
}

export async function deleteReport(id: string): Promise<ReportResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase not configured." };
  const { error } = await handle(supabase)
    .from("generated_content")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not delete." };
  return { ok: true };
}
