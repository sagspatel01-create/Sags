"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  STAGE_PROBABILITY,
  dealCommission,
  toMonthKey,
} from "@/lib/crm";
import type { CrmStage, CrmProduct, CrmLeadSource, CrmChannel } from "@/lib/db/types";

/**
 * CRM write actions. Mirrors the admin edit loop: every write goes to the
 * same Supabase DB the screens read, so changes show immediately.
 * supabase-js insert/update typing is over-strict against our hand-authored
 * types, so — as in actions/admin.ts — we use a minimal typed handle.
 */
type Filter = Promise<{ error: unknown; data?: unknown }> & {
  eq: (c: string, v: unknown) => Filter;
  select: (c?: string) => Filter;
  single: () => Promise<{ error: unknown; data: unknown }>;
};
function db(supabase: unknown) {
  return supabase as unknown as {
    from: (t: string) => {
      insert: (v: Record<string, unknown> | Record<string, unknown>[]) => Filter;
      update: (v: Record<string, unknown>) => Filter;
      upsert: (v: Record<string, unknown>, o?: Record<string, unknown>) => Filter;
      delete: () => Filter;
    };
  };
}

// ---- FormData helpers ------------------------------------------------

function str(fd: FormData, k: string): string | null {
  const v = (fd.get(k) as string | null)?.trim();
  return v ? v : null;
}
function money(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function flt(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const STAGES = new Set<CrmStage>([
  "new_lead", "contacted", "qualified", "docs_collected",
  "submitted", "approved", "disbursed", "lost", "dormant",
]);
const PRODUCTS = new Set<CrmProduct>([
  "new_purchase", "handover_offplan", "equity_release", "buyout_transfer", "other",
]);
const SOURCES = new Set<CrmLeadSource>([
  "meta_ads", "referral", "website", "walk_in", "manual", "other",
]);
const CHANNELS = new Set<CrmChannel>(["whatsapp", "call", "email", "other"]);

// ---- Contacts --------------------------------------------------------

export async function createContact(fd: FormData): Promise<void> {
  const sb = await createClient();
  const full_name = str(fd, "full_name");
  if (!sb || !full_name) return;
  const sourceRaw = str(fd, "source") as CrmLeadSource | null;
  const source = sourceRaw && SOURCES.has(sourceRaw) ? sourceRaw : "manual";

  const { data } = await db(sb)
    .from("crm_contacts")
    .insert({
      full_name,
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      source,
      source_detail: str(fd, "source_detail"),
      notes: str(fd, "notes"),
    })
    .select("id")
    .single();

  revalidatePath("/crm/contacts");
  revalidatePath("/crm");
  const id = (data as { id?: string } | null)?.id;
  if (id) redirect(`/crm/contacts/${id}`);
}

export async function updateContact(fd: FormData): Promise<void> {
  const sb = await createClient();
  const id = str(fd, "id");
  if (!sb || !id) return;
  await db(sb)
    .from("crm_contacts")
    .update({
      full_name: str(fd, "full_name") ?? undefined,
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      source_detail: str(fd, "source_detail"),
      notes: str(fd, "notes"),
      is_client: fd.get("is_client") === "on",
    })
    .eq("id", id);
  revalidatePath(`/crm/contacts/${id}`);
  revalidatePath("/crm/contacts");
}

// ---- Deals -----------------------------------------------------------

export async function createDeal(fd: FormData): Promise<void> {
  const sb = await createClient();
  const contact_id = str(fd, "contact_id");
  if (!sb || !contact_id) return;

  const productRaw = str(fd, "product") as CrmProduct | null;
  const product = productRaw && PRODUCTS.has(productRaw) ? productRaw : "new_purchase";
  const stageRaw = str(fd, "stage") as CrmStage | null;
  const stage = stageRaw && STAGES.has(stageRaw) ? stageRaw : "new_lead";

  const loan_amount = money(fd, "loan_amount");
  const property_value = money(fd, "property_value");
  const commission_pct = flt(fd, "commission_pct");
  let commission_amount = money(fd, "commission_amount");
  if (commission_amount == null && commission_pct != null) {
    commission_amount = dealCommission({
      commission_amount: null,
      commission_pct,
      loan_amount,
      property_value,
    });
  }

  await db(sb).from("crm_deals").insert({
    contact_id,
    title: str(fd, "title"),
    product,
    product_other: product === "other" ? str(fd, "product_other") : null,
    stage,
    property_value,
    loan_amount,
    commission_pct,
    commission_amount,
    close_month: toMonthKey(str(fd, "close_month")),
    probability: flt(fd, "probability") ?? STAGE_PROBABILITY[stage],
  });

  revalidatePath(`/crm/contacts/${contact_id}`);
  revalidatePath("/crm/pipeline");
  revalidatePath("/crm/forecast");
  revalidatePath("/crm");
}

export async function updateDeal(fd: FormData): Promise<void> {
  const sb = await createClient();
  const id = str(fd, "id");
  const contact_id = str(fd, "contact_id");
  if (!sb || !id) return;

  const stageRaw = str(fd, "stage") as CrmStage | null;
  const stage = stageRaw && STAGES.has(stageRaw) ? stageRaw : undefined;

  const loan_amount = money(fd, "loan_amount");
  const property_value = money(fd, "property_value");
  const commission_pct = flt(fd, "commission_pct");
  let commission_amount = money(fd, "commission_amount");
  if (commission_amount == null && commission_pct != null) {
    commission_amount = dealCommission({
      commission_amount: null,
      commission_pct,
      loan_amount,
      property_value,
    });
  }

  const patch: Record<string, unknown> = {
    title: str(fd, "title"),
    property_value,
    loan_amount,
    commission_pct,
    commission_amount,
    close_month: toMonthKey(str(fd, "close_month")),
    probability: flt(fd, "probability"),
  };
  if (stage) {
    patch.stage = stage;
    if (stage === "disbursed" || stage === "lost") patch.closed_at = new Date().toISOString();
  }

  await db(sb).from("crm_deals").update(patch).eq("id", id);

  if (contact_id) revalidatePath(`/crm/contacts/${contact_id}`);
  revalidatePath("/crm/pipeline");
  revalidatePath("/crm/forecast");
  revalidatePath("/crm");
}

/** Quick stage move from the pipeline board. */
export async function moveDealStage(fd: FormData): Promise<void> {
  const sb = await createClient();
  const id = str(fd, "id");
  const stageRaw = str(fd, "stage") as CrmStage | null;
  if (!sb || !id || !stageRaw || !STAGES.has(stageRaw)) return;

  const patch: Record<string, unknown> = {
    stage: stageRaw,
    probability: STAGE_PROBABILITY[stageRaw],
  };
  if (stageRaw === "disbursed" || stageRaw === "lost") {
    patch.closed_at = new Date().toISOString();
  } else {
    patch.closed_at = null;
  }
  await db(sb).from("crm_deals").update(patch).eq("id", id);
  revalidatePath("/crm/pipeline");
  revalidatePath("/crm/forecast");
  revalidatePath("/crm");
}

// ---- Notes -----------------------------------------------------------

export async function addNote(fd: FormData): Promise<void> {
  const sb = await createClient();
  const contact_id = str(fd, "contact_id");
  const body = str(fd, "body");
  if (!sb || !contact_id || !body) return;
  await db(sb).from("crm_notes").insert({
    contact_id,
    deal_id: str(fd, "deal_id"),
    body,
  });
  revalidatePath(`/crm/contacts/${contact_id}`);
}

// ---- Follow-ups ------------------------------------------------------

export async function addFollowup(fd: FormData): Promise<void> {
  const sb = await createClient();
  const contact_id = str(fd, "contact_id");
  const due_on = str(fd, "due_on");
  if (!sb || !contact_id || !due_on) return;
  const channelRaw = str(fd, "channel") as CrmChannel | null;
  const channel = channelRaw && CHANNELS.has(channelRaw) ? channelRaw : "whatsapp";
  await db(sb).from("crm_followups").insert({
    contact_id,
    deal_id: str(fd, "deal_id"),
    due_on,
    channel,
    note: str(fd, "note"),
  });
  revalidatePath(`/crm/contacts/${contact_id}`);
  revalidatePath("/crm");
}

export async function completeFollowup(fd: FormData): Promise<void> {
  const sb = await createClient();
  const id = str(fd, "id");
  if (!sb || !id) return;
  await db(sb)
    .from("crm_followups")
    .update({ done: true, done_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/crm");
  const contact_id = str(fd, "contact_id");
  if (contact_id) revalidatePath(`/crm/contacts/${contact_id}`);
}

// ---- Targets ---------------------------------------------------------

export async function setTarget(fd: FormData): Promise<void> {
  const sb = await createClient();
  const month = toMonthKey(str(fd, "month"));
  const target_amount = money(fd, "target_amount");
  if (!sb || !month || target_amount == null) return;
  await db(sb)
    .from("crm_targets")
    .upsert({ month, target_amount }, { onConflict: "month" });
  revalidatePath("/crm/settings");
  revalidatePath("/crm/forecast");
  revalidatePath("/crm");
}

// ---- CSV import ------------------------------------------------------

/**
 * Bulk lead import. Accepts pasted CSV with a header row. Recognised columns
 * (case-insensitive, flexible names): name/full_name, phone/mobile,
 * email, source, campaign/source_detail, notes. Everything else is ignored.
 * A `meta_ads`/`Meta` source is normalised so ad ROI stays measurable.
 */
export async function importContactsCsv(fd: FormData): Promise<void> {
  const sb = await createClient();
  const raw = str(fd, "csv");
  if (!sb || !raw) return;

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    redirect("/crm/import?err=empty");
  }

  const split = (line: string): string[] => {
    // Minimal CSV: handles quoted fields with commas.
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const header = split(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iName = idx(["name", "full_name", "full name", "lead name", "contact"]);
  const iPhone = idx(["phone", "mobile", "phone number", "contact number", "whatsapp"]);
  const iEmail = idx(["email", "e-mail", "email address"]);
  const iSource = idx(["source", "lead source"]);
  const iDetail = idx(["campaign", "source_detail", "ad", "ad name", "form", "detail"]);
  const iNotes = idx(["notes", "note", "comment", "comments", "message"]);

  const normSource = (v: string | undefined): CrmLeadSource => {
    const s = (v ?? "").toLowerCase();
    if (!s) return "manual";
    if (s.includes("meta") || s.includes("facebook") || s.includes("insta") || s.includes("fb")) return "meta_ads";
    if (s.includes("refer")) return "referral";
    if (s.includes("web")) return "website";
    if (s.includes("walk")) return "walk_in";
    if (SOURCES.has(s as CrmLeadSource)) return s as CrmLeadSource;
    return "other";
  };

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = split(lines[i]);
    const full_name = (iName >= 0 ? cols[iName] : cols[0])?.trim();
    if (!full_name) continue;
    rows.push({
      full_name,
      phone: iPhone >= 0 ? cols[iPhone] || null : null,
      email: iEmail >= 0 ? cols[iEmail] || null : null,
      source: normSource(iSource >= 0 ? cols[iSource] : undefined),
      source_detail: iDetail >= 0 ? cols[iDetail] || null : null,
      notes: iNotes >= 0 ? cols[iNotes] || null : null,
    });
  }

  if (rows.length === 0) redirect("/crm/import?err=norows");
  await db(sb).from("crm_contacts").insert(rows);

  revalidatePath("/crm/contacts");
  revalidatePath("/crm");
  redirect(`/crm/contacts?imported=${rows.length}`);
}
