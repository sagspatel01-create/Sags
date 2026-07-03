"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  setActiveProfile,
  clearActiveProfile,
} from "@/lib/client-profile.server";
import {
  PRIORITIES,
  type ClientProfileSnapshot,
  type FinancingApproach,
  type PriorityKey,
} from "@/lib/client-profile";
import type { BuyerType } from "@/lib/db/types";

const FINANCING = new Set(["cash", "mortgage", "offplan_payment_plan"]);
const BUYERS = new Set(["family", "investor", "enduser"]);

export async function createProfile(formData: FormData): Promise<void> {
  const session_label =
    (formData.get("session_label") as string)?.trim() || "Untitled session";

  const budgetRaw = (formData.get("budget") as string)?.replace(/[^0-9.]/g, "");
  const budget = budgetRaw ? Number(budgetRaw) : null;

  const financingRaw = formData.get("financing_approach") as string;
  const financing_approach = FINANCING.has(financingRaw)
    ? (financingRaw as FinancingApproach)
    : null;

  const buyerRaw = formData.get("buyer_type") as string;
  const buyer_type = BUYERS.has(buyerRaw) ? (buyerRaw as BuyerType) : null;

  const goals = ((formData.get("goals") as string) || "").trim() || null;

  const priorities = {} as Record<PriorityKey, number>;
  for (const { key } of PRIORITIES) {
    const v = Number(formData.get(`priority_${key}`));
    priorities[key] = Number.isFinite(v) ? Math.max(0, Math.min(5, v)) : 3;
  }

  const snapshot: ClientProfileSnapshot = {
    session_label,
    budget,
    financing_approach,
    buyer_type,
    goals,
    priorities,
    created_at: new Date().toISOString(),
  };

  // Persist to the durable history when Supabase is configured.
  const supabase = await createClient();
  if (supabase) {
    const db = supabase as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, val: unknown) => Promise<{ error: unknown }>;
        };
        insert: (v: Record<string, unknown>) => {
          select: (c: string) => {
            single: () => Promise<{ data: { id: string } | null; error: unknown }>;
          };
        };
      };
    };
    // Only one active profile at a time.
    await db.from("client_profiles").update({ is_active: false }).eq("is_active", true);
    const { data } = await db
      .from("client_profiles")
      .insert({
        session_label,
        budget,
        financing_approach,
        buyer_type,
        goals,
        priorities,
        is_active: true,
      })
      .select("id")
      .single();
    if (data?.id) snapshot.id = data.id;
  }

  await setActiveProfile(snapshot);
  redirect("/client");
}

export async function clearProfile(): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    const db = supabase as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, val: unknown) => Promise<{ error: unknown }>;
        };
      };
    };
    await db.from("client_profiles").update({ is_active: false }).eq("is_active", true);
  }
  await clearActiveProfile();
  redirect("/client");
}
