"use server";

import { getAnthropic, GENERATION_MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { getCommunityBySlug, type CommunityDetail } from "@/lib/data/communities";

/**
 * "Ask the Engine" — the NotebookLM-style grounded search over the community
 * dossier. It does NOT free-associate from the model's training: it retrieves
 * the relevant community records from Supabase, serialises them into a grounded
 * context, and asks Claude to answer STRICTLY from that context (citing the
 * community, and saying "not yet in the engine" when a fact is absent). This is
 * what makes it a knowledge tool rather than a chatbot — every answer is
 * traceable to a row we actually hold.
 */

export interface AskSource {
  name: string;
  slug: string;
}

/** A live-web citation the answer drew on (surfaced distinctly from the engine's own pages). */
export interface WebSource {
  title: string;
  url: string;
}

/** A rich, clickable summary of a community the answer is grounded in. */
export interface CommunityCard {
  name: string;
  slug: string;
  status: string;
  developer: string | null;
  villaCount: number | null;
  townhouseCount: number | null;
  subCount: number | null;
  confidence: "high" | "medium" | "low" | "unverified" | null;
  medianPrice: number | null; // DLD 6-mo median, if held
  appreciationPct: number | null; // DLD recent trend, if held
}

export interface AskResult {
  answer: string | null;
  sources: AskSource[];
  webSources: WebSource[];
  cards: CommunityCard[];
  /** Slugs the answer was grounded in — passed back on the next turn so
   *  follow-ups ("what about the 4BR?") stay anchored to the same community. */
  groundedSlugs: string[];
  /** Suggested next questions, NotebookLM-style. */
  suggestedFollowups: string[];
  error?: string;
}

/** One prior turn, passed back so the model has conversational context. */
export interface AskTurn {
  role: "user" | "assistant";
  content: string;
}

/** Index row used only for retrieval (cheap, whole-catalogue). */
interface IndexCommunity {
  id: string;
  name: string;
  slug: string;
  status: string;
  developer: string | null;
}
interface IndexSub {
  name: string;
  communitySlug: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Score a community/sub-community name against the (normalised) question.
 * Full-name containment wins big; otherwise require every significant token of
 * the name to appear (so "Dubai Hills" matches, but a stray "Dubai" does not).
 */
function nameScore(name: string, q: string): number {
  const n = norm(name);
  if (!n) return 0;
  if (q.includes(n) && n.length >= 4) return n.length + 5;
  const toks = n.split(" ").filter((t) => t.length > 2);
  if (toks.length === 0) return 0;
  const hit = toks.filter((t) => q.includes(t)).length;
  return hit === toks.length ? n.length * 0.6 : 0;
}

/** Turn a full community dossier into a compact, grounded text block. */
function serialize(c: CommunityDetail): string {
  const L: string[] = [];
  L.push(`# ${c.name} — ${c.status}`);
  if (c.developer?.name) L.push(`Developer: ${c.developer.name}`);
  if (c.positioning_tier) L.push(`Positioning tier: ${c.positioning_tier}`);
  if (c.age_or_handover) L.push(`Age / handover: ${c.age_or_handover}`);
  const scale = [
    c.villa_count != null ? `${c.villa_count} villas` : null,
    c.townhouse_count != null ? `${c.townhouse_count} townhouses` : null,
    c.total_units != null ? `${c.total_units} total units` : null,
    c.sub_community_count != null ? `${c.sub_community_count} sub-communities` : null,
  ].filter(Boolean);
  if (scale.length) L.push(`Scale: ${scale.join(", ")}`);
  if (c.description_long) L.push(c.description_long);
  if (c.data_confidence) L.push(`Data confidence: ${c.data_confidence}${c.source_note ? ` — ${c.source_note}` : ""}`);

  for (const s of c.sub_communities ?? []) {
    const sc = [
      s.villa_count != null ? `${s.villa_count} villas` : null,
      s.townhouse_count != null ? `${s.townhouse_count} townhouses` : null,
      s.total_units != null ? `${s.total_units} units` : null,
    ].filter(Boolean);
    L.push(`\n## Sub-community: ${s.name} — ${s.status}${sc.length ? ` (${sc.join(", ")})` : ""}`);
    if (s.description_long) L.push(s.description_long);
    for (const p of s.phases ?? []) {
      const bits = [
        p.status ? `[${p.status}]` : null,
        p.launch_price_per_sqft ? `launch AED ${p.launch_price_per_sqft}/sqft` : null,
        p.current_price_per_sqft ? `current AED ${p.current_price_per_sqft}/sqft` : null,
        p.units_in_phase ? `${p.units_in_phase} units` : null,
        p.launch_date ? `launched ${p.launch_date}` : null,
      ].filter(Boolean);
      L.push(`  · Phase ${p.phase_name} ${bits.join(", ")}`);
    }
    for (const u of s.unit_archetypes ?? []) {
      const bits = [
        u.bedrooms != null ? `${u.bedrooms}BR` : null,
        u.bathrooms != null ? `${u.bathrooms}BA` : null,
        u.bua_sqft != null ? `${Number(u.bua_sqft)} sqft BUA` : null,
        u.plot_sqft != null ? `${Number(u.plot_sqft)} sqft plot` : null,
        u.price != null ? `AED ${Number(u.price)}` : null,
        u.has_garden ? "garden" : null,
        u.has_pool ? "pool" : null,
        u.view_orientation ? `${u.view_orientation} view` : null,
      ].filter(Boolean);
      L.push(`  · Unit type: ${u.name ?? u.unit_type} — ${u.unit_type}, ${bits.join(", ")}`);
    }
  }

  // Transaction-derived market intelligence (the real, sourced numbers).
  const snaps = c.market_snapshots ?? [];
  const dld = snaps.filter((m) => m.source === "dld");
  for (const m of dld) {
    L.push(
      `Transactions (${m.unit_type ?? "all"} · ${m.reg_type ?? "all"}): ${m.txn_count ?? "?"} sales, ` +
        `median AED ${m.median_price ?? "?"}${m.avg_price_per_sqft ? `, ${m.avg_price_per_sqft}/sqft` : ""}` +
        `${m.period_start ? ` [${m.period_start}..${m.period_end}]` : ""}`,
    );
  }
  const detail = snaps.find((m) => m.source === "dld-detail");
  if (detail) {
    L.push(
      `6-month trend: ${detail.txn_count ?? "?"} transactions, median AED ${detail.median_price ?? "?"}, ` +
        `appreciation ${detail.appreciation_pct ?? "?"}%.`,
    );
  }

  for (const cat of c.catalysts ?? []) {
    L.push(`Catalyst [${cat.category}/${cat.timeline}]: ${cat.title} — ${cat.note}`);
  }
  for (const f of c.faqs ?? []) {
    L.push(`FAQ — Q: ${f.q} A: ${f.a}`);
  }
  for (const ct of c.commute_times ?? []) {
    const dest = (ct as { destination?: string; minutes?: number }).destination;
    const mins = (ct as { destination?: string; minutes?: number }).minutes;
    if (dest) L.push(`Commute to ${dest}: ${mins ?? "?"} min`);
  }
  return L.join("\n");
}

/**
 * Answer a free-text question about Dubai villa/townhouse communities from the
 * engine's own data. Retrieves the community/communities the question is about,
 * grounds Claude on their full dossier, and returns the answer plus the sources
 * it drew from.
 */
export async function askEngine(
  question: string,
  opts: { history?: AskTurn[]; carrySlugs?: string[] } = {},
): Promise<AskResult> {
  const empty = { sources: [], webSources: [], cards: [], groundedSlugs: [], suggestedFollowups: [] };
  const q = question.trim();
  if (!q) return { answer: null, ...empty, error: "Ask a question first." };

  const client = getAnthropic();
  if (!client) return { answer: null, ...empty, error: "The answer engine (Anthropic) is not configured." };

  const supabase = await createClient();
  if (!supabase) return { answer: null, ...empty, error: "Database is not configured." };

  // Whole-catalogue retrieval index (cheap columns only).
  const [{ data: comms }, { data: subs }] = await Promise.all([
    supabase.from("communities").select("id,name,slug,status,developer:developers(name)"),
    supabase.from("sub_communities").select("name, community:communities(slug)"),
  ]);
  const index: IndexCommunity[] = ((comms as unknown as Array<{
    id: string; name: string; slug: string; status: string;
    developer: { name: string } | { name: string }[] | null;
  }>) ?? []).map((c) => {
    const dev = Array.isArray(c.developer) ? c.developer[0] : c.developer;
    return { id: c.id, name: c.name, slug: c.slug, status: c.status, developer: dev?.name ?? null };
  });
  const subIndex: IndexSub[] = ((subs as unknown as Array<{
    name: string; community: { slug: string } | { slug: string }[] | null;
  }>) ?? [])
    .map((s) => {
      const c = Array.isArray(s.community) ? s.community[0] : s.community;
      return c ? { name: s.name, communitySlug: c.slug } : null;
    })
    .filter((x): x is IndexSub => x !== null);

  const nq = norm(q);

  // Rank communities: direct name hits + developer hits + sub-community hits.
  const score = new Map<string, number>(); // slug -> score
  for (const c of index) {
    const s = nameScore(c.name, nq) + (c.developer && nameScore(c.developer, nq) > 0 ? 3 : 0);
    if (s > 0) score.set(c.slug, (score.get(c.slug) ?? 0) + s);
  }
  for (const s of subIndex) {
    const hit = nameScore(s.name, nq);
    if (hit > 0) score.set(s.communitySlug, (score.get(s.communitySlug) ?? 0) + hit + 2);
  }

  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
  // Load full dossiers for the top matches (cap so the context stays tight).
  // If this turn names no community (a follow-up like "what about the 4BR?"),
  // carry forward the communities the previous turn was grounded in.
  let targetSlugs = ranked.slice(0, 3);
  if (targetSlugs.length === 0 && opts.carrySlugs && opts.carrySlugs.length) {
    targetSlugs = opts.carrySlugs.slice(0, 3);
  }

  const sources: AskSource[] = [];
  const cards: CommunityCard[] = [];
  let context: string;
  if (targetSlugs.length > 0) {
    const dossiers = await Promise.all(targetSlugs.map((slug) => getCommunityBySlug(slug)));
    const blocks: string[] = [];
    for (const d of dossiers) {
      if (!d) continue;
      sources.push({ name: d.name, slug: d.slug });
      const detail = (d.market_snapshots ?? []).find((m) => m.source === "dld-detail");
      cards.push({
        name: d.name,
        slug: d.slug,
        status: d.status,
        developer: d.developer?.name ?? null,
        villaCount: d.villa_count ?? null,
        townhouseCount: d.townhouse_count ?? null,
        subCount: d.sub_community_count ?? (d.sub_communities?.length || null),
        confidence: d.data_confidence,
        medianPrice: detail?.median_price != null ? Number(detail.median_price) : null,
        appreciationPct: detail?.appreciation_pct != null ? Number(detail.appreciation_pct) : null,
      });
      blocks.push(serialize(d));
    }
    context = blocks.join("\n\n———\n\n");
  } else {
    // No specific community matched — give the model the catalogue index so it
    // can still answer "which communities does X developer have?" style asks.
    context =
      "No single community matched. Catalogue index (name — developer — status):\n" +
      index.map((c) => `- ${c.name} — ${c.developer ?? "n/a"} — ${c.status}`).join("\n");
  }

  const system =
    "You are the Dubai Villa & Townhouse Intelligence Engine — a grounded " +
    "knowledge base for Dubai villa and townhouse communities. \n\n" +
    "GROUNDING RULES (strict — this product must never hallucinate):\n" +
    "1. ANSWER FROM THE DATA FIRST. The DATA block below is the engine's own " +
    "curated records — prefer it for every fact it contains, and quote its " +
    "numbers exactly. When you cite a price, price-per-sqft, median or " +
    "transaction stat, make clear it is DLD-sourced.\n" +
    "2. LIVE WEB FOR GAPS ONLY. If — and only if — the DATA does not contain " +
    "something the user needs (e.g. a school rating, a new metro line, an " +
    "off-plan launch, a handover update), you MAY use the web_search tool to " +
    "find it. Every fact you take from the web MUST come with its citation. " +
    "Never state a web-derived fact without a citation.\n" +
    "3. NEVER INVENT. If a fact is neither in the DATA nor findable with a " +
    "citation, say plainly it is not yet in the engine — do not guess unit " +
    "counts, prices, sizes, or names.\n" +
    "4. PRICES ARE DLD-ONLY. Never take a sale price, price-per-sqft, median, " +
    "or appreciation figure from the web — those come only from the DATA " +
    "(DLD-registered). The web is for context, not transaction truth.\n\n" +
    "STYLE: Lead with the direct answer, then supporting detail. Name " +
    "sub-communities, unit types, bedroom counts and sizes specifically. " +
    "Crisp, expert, no filler.";

  // web_search_20260209 = server-side web tool with per-fact citations (Opus
  // 4.6+). The model reaches for it only when the DATA lacks something, per the
  // grounding rules above. We handle pause_turn (server tool loop) by resuming.
  const webTool = { type: "web_search_20260209", name: "web_search", max_uses: 4 };

  type Block = {
    type: string;
    text?: string;
    citations?: Array<{ type?: string; url?: string; title?: string }> | null;
  };

  // Grounded slugs + suggested follow-ups (NotebookLM-style) — heuristic, so
  // they're instant and never hallucinated.
  const groundedSlugs = sources.map((s) => s.slug);
  const suggestedFollowups = buildFollowups(cards);

  async function generate(withWeb: boolean): Promise<AskResult> {
    // Prior turns (capped) give the model conversational continuity so
    // follow-ups resolve ("it", "that community", "the 4-bedroom").
    const hist = (opts.history ?? []).slice(-6).map((t) => ({ role: t.role, content: t.content }));
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
      ...hist,
      { role: "user", content: `QUESTION:\n${q}\n\nDATA:\n${context}` },
    ];
    const webSources: WebSource[] = [];
    const seenUrls = new Set<string>();
    const textParts: string[] = [];

    // Server-tool turns can pause (pause_turn) mid-search; resume up to a cap.
    for (let hop = 0; hop < 5; hop++) {
      const res = await client!.messages.create({
        model: GENERATION_MODEL,
        max_tokens: 1400,
        system,
        messages: messages as never,
        ...(withWeb ? { tools: [webTool] as never } : {}),
      });
      if (res.stop_reason === "refusal") break;

      for (const b of res.content as unknown as Block[]) {
        if (b.type === "text" && b.text) {
          textParts.push(b.text);
          for (const c of b.citations ?? []) {
            if (c?.url && !seenUrls.has(c.url)) {
              seenUrls.add(c.url);
              webSources.push({ title: c.title || c.url, url: c.url });
            }
          }
        }
      }

      if (res.stop_reason === "pause_turn") {
        // Re-send with the assistant's partial turn so the server resumes.
        messages.push({ role: "assistant", content: res.content });
        continue;
      }
      break;
    }

    const answer = textParts.join("").trim() || null;
    return { answer, sources, webSources, cards, groundedSlugs, suggestedFollowups };
  }

  // Try with the live-web fallback; if that call fails (e.g. web tool not
  // enabled on the key), degrade to a pure platform-grounded answer.
  try {
    const r = await generate(true);
    if (r.answer) return r;
  } catch {
    /* fall through to platform-only */
  }
  try {
    const r = await generate(false);
    if (r.answer) return r;
  } catch {
    /* fall through to error */
  }
  return {
    answer: null, sources, webSources: [], cards,
    groundedSlugs: sources.map((s) => s.slug),
    suggestedFollowups: buildFollowups(cards),
    error: "The answer engine call failed.",
  };
}

/** Heuristic follow-up questions from the grounded communities — reliable and
 *  instant (no extra model call, nothing invented). */
function buildFollowups(cards: CommunityCard[]): string[] {
  if (cards.length >= 2) {
    const [a, b] = cards;
    return [
      `Compare ${a.name} and ${b.name} for a family under AED 10M`,
      `Which of these has the strongest 6-month price trend?`,
      `Underwrite a typical villa in ${a.name}`,
    ];
  }
  if (cards.length === 1) {
    const c = cards[0];
    return [
      `What unit types and sizes are in ${c.name}?`,
      `What's the 6-month transaction trend in ${c.name}?`,
      `Underwrite a typical ${c.name} villa at 75% LTV`,
    ];
  }
  return [
    "Which communities have the highest recent appreciation?",
    "Show me family villa communities under AED 5M",
    "Which developer has the most off-plan launches right now?",
  ];
}
