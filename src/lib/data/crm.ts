import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  CrmContact,
  CrmDeal,
  CrmNote,
  CrmFollowup,
  CrmTarget,
} from "@/lib/db/types";
import { buildForecast, summarizePipeline, type PipelineSummary } from "@/lib/crm";

export type { ForecastMonth } from "@/lib/crm";

/**
 * CRM reads. Every function degrades to empty/neutral data when Supabase
 * isn't configured, so the screens render in preview mode exactly like the
 * rest of the engine.
 */

export type DealWithContact = CrmDeal & { contact: CrmContact | null };

// ---- Contacts --------------------------------------------------------

export async function getContacts(): Promise<CrmContact[]> {
  const sb = await createClient();
  if (!sb) return [];
  const { data } = await sb
    .from("crm_contacts")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as CrmContact[]) ?? [];
}

export async function getContact(id: string): Promise<CrmContact | null> {
  const sb = await createClient();
  if (!sb) return null;
  const { data } = await sb.from("crm_contacts").select("*").eq("id", id).single();
  return (data as CrmContact) ?? null;
}

export async function getContactDeals(contactId: string): Promise<CrmDeal[]> {
  const sb = await createClient();
  if (!sb) return [];
  const { data } = await sb
    .from("crm_deals")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  return (data as CrmDeal[]) ?? [];
}

export async function getContactNotes(contactId: string): Promise<CrmNote[]> {
  const sb = await createClient();
  if (!sb) return [];
  const { data } = await sb
    .from("crm_notes")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  return (data as CrmNote[]) ?? [];
}

export async function getContactFollowups(contactId: string): Promise<CrmFollowup[]> {
  const sb = await createClient();
  if (!sb) return [];
  const { data } = await sb
    .from("crm_followups")
    .select("*")
    .eq("contact_id", contactId)
    .order("due_on", { ascending: true });
  return (data as CrmFollowup[]) ?? [];
}

// ---- Deals -----------------------------------------------------------

export async function getDealsWithContacts(): Promise<DealWithContact[]> {
  const sb = await createClient();
  if (!sb) return [];
  const { data } = await sb
    .from("crm_deals")
    .select("*, contact:crm_contacts(*)")
    .order("updated_at", { ascending: false });
  return (data as unknown as DealWithContact[]) ?? [];
}

export async function getDeal(id: string): Promise<CrmDeal | null> {
  const sb = await createClient();
  if (!sb) return null;
  const { data } = await sb.from("crm_deals").select("*").eq("id", id).single();
  return (data as CrmDeal) ?? null;
}

// ---- Follow-ups: the morning "Today" queue ---------------------------

export type FollowupWithContext = CrmFollowup & {
  contact: CrmContact | null;
  deal: CrmDeal | null;
};

/**
 * Open follow-ups due on or before today (plus anything overdue), oldest
 * first — this is the morning queue. `horizonDays` optionally also pulls in
 * upcoming ones for the "coming up" view.
 */
export async function getDueFollowups(horizonDays = 0): Promise<FollowupWithContext[]> {
  const sb = await createClient();
  if (!sb) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + horizonDays);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const { data } = await sb
    .from("crm_followups")
    .select("*, contact:crm_contacts(*), deal:crm_deals(*)")
    .eq("done", false)
    .lte("due_on", cutoffKey)
    .order("due_on", { ascending: true });
  return (data as unknown as FollowupWithContext[]) ?? [];
}

/**
 * Contacts with no open follow-up and no note in the last `staleDays` days —
 * "you've gone quiet on these" nudges for the morning brief.
 */
export async function getStaleContacts(staleDays = 7, limit = 12): Promise<
  { contact: CrmContact; lastActivity: string | null }[]
> {
  const sb = await createClient();
  if (!sb) return [];

  const [{ data: contacts }, { data: notes }, { data: followups }] = await Promise.all([
    sb.from("crm_contacts").select("*"),
    sb.from("crm_notes").select("contact_id, created_at"),
    sb.from("crm_followups").select("contact_id, done"),
  ]);

  const lastNote = new Map<string, string>();
  for (const n of (notes as { contact_id: string; created_at: string }[]) ?? []) {
    const prev = lastNote.get(n.contact_id);
    if (!prev || n.created_at > prev) lastNote.set(n.contact_id, n.created_at);
  }
  const hasOpenFollowup = new Set<string>();
  for (const f of (followups as { contact_id: string; done: boolean }[]) ?? []) {
    if (!f.done) hasOpenFollowup.add(f.contact_id);
  }

  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  const rows: { contact: CrmContact; lastActivity: string | null }[] = [];
  for (const c of (contacts as CrmContact[]) ?? []) {
    if (hasOpenFollowup.has(c.id)) continue; // already scheduled — not stale
    const last = lastNote.get(c.id) ?? c.created_at;
    if (new Date(last).getTime() <= cutoff) {
      rows.push({ contact: c, lastActivity: lastNote.get(c.id) ?? null });
    }
  }
  rows.sort((a, b) => {
    const av = a.lastActivity ?? a.contact.created_at;
    const bv = b.lastActivity ?? b.contact.created_at;
    return av < bv ? -1 : 1;
  });
  return rows.slice(0, limit);
}

// ---- Targets ---------------------------------------------------------

export async function getTargets(): Promise<Map<string, number>> {
  const sb = await createClient();
  const map = new Map<string, number>();
  if (!sb) return map;
  const { data } = await sb.from("crm_targets").select("*");
  for (const t of (data as CrmTarget[]) ?? []) {
    map.set(t.month.slice(0, 10), t.target_amount);
  }
  return map;
}

// ---- Forecast --------------------------------------------------------

/**
 * Month-by-month disbursement forecast vs target. Fetches deals + targets,
 * then delegates the maths to the pure `buildForecast` in @/lib/crm so the
 * exact same code path is covered by the test suite.
 */
export async function getForecast(months = 6): Promise<ReturnType<typeof buildForecast>> {
  const [deals, targets] = await Promise.all([getDealsWithContacts(), getTargets()]);
  return buildForecast(deals, targets, months);
}

// ---- Headline counts for the CRM overview ----------------------------

export async function getPipelineSummary(): Promise<PipelineSummary> {
  const [deals, contacts, due] = await Promise.all([
    getDealsWithContacts(),
    getContacts(),
    getDueFollowups(0),
  ]);
  return summarizePipeline(deals, contacts.length, due.length);
}
