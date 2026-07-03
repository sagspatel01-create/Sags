import type { ClientProfileSnapshot } from "@/lib/client-profile";
import {
  BUYER_LABEL,
  FINANCING_LABEL,
  PRIORITIES,
} from "@/lib/client-profile";
import { aed } from "@/lib/format";

/**
 * Prompt templates for the client-tailored copy layer (Milestone 5).
 *
 * These are intentionally in code and easy to edit — the owner tunes voice
 * and framing here. Layer 2 rewrites the base copy to speak directly to the
 * client entered for the session. Grounded in the data + base copy; never
 * invents facts, prices, or amenities.
 */

export type TailorKind = "who_its_for" | "description";

export interface TailorEntity {
  name: string;
  kind_label: string; // "community" | "sub-community"
  developer: string | null;
  status: string;
  tier: string | null;
  master_plan_features: string[];
  base_who_its_for: string | null;
  base_description: string | null;
}

// The owner's brand voice — confident, precise, editorial, quietly exclusive.
const BRAND_VOICE = `You write for a single luxury real-estate advisor who is the definitive
name for Dubai villa and townhouse communities. Voice: confident, precise,
editorial, and quietly exclusive — never salesy, never hyperbolic, no emoji,
no exclamation marks. Short, assured sentences. British spelling. You speak
to a discerning private client, not a mass audience.`;

const GROUNDING = `Strict rules:
- Use ONLY the facts provided. Never invent prices, figures, amenities,
  school names, or claims. If a fact isn't given, don't imply it.
- Do not mention the client's budget figure back to them.
- No headings, no bullet points, no preamble like "Here is" — return only the
  finished prose.`;

function clientBlock(p: ClientProfileSnapshot): string {
  const priorities = PRIORITIES.filter((pr) => (p.priorities[pr.key] ?? 0) >= 4)
    .map((pr) => pr.label)
    .join(", ");
  return [
    `Buyer type: ${p.buyer_type ? BUYER_LABEL[p.buyer_type] : "unspecified"}`,
    `Budget band: ${p.budget ? `around ${aed(p.budget)} (do not state this number back)` : "unspecified"}`,
    `Financing: ${p.financing_approach ? FINANCING_LABEL[p.financing_approach] : "unspecified"}`,
    p.goals ? `In their words: ${p.goals}` : null,
    priorities ? `They most care about: ${priorities}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function entityBlock(e: TailorEntity): string {
  return [
    `Name: ${e.name} (${e.kind_label})`,
    `Developer: ${e.developer ?? "unspecified"}`,
    `Status: ${e.status}`,
    e.tier ? `Positioning: ${e.tier}` : null,
    e.master_plan_features.length
      ? `Known features: ${e.master_plan_features.join("; ")}`
      : null,
    e.base_who_its_for ? `Base buyer profile: ${e.base_who_its_for}` : null,
    e.base_description ? `Base description: ${e.base_description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTailorPrompt(
  kind: TailorKind,
  entity: TailorEntity,
  profile: ClientProfileSnapshot,
): { system: string; prompt: string } {
  const system = `${BRAND_VOICE}\n\n${GROUNDING}`;

  const task =
    kind === "who_its_for"
      ? `Rewrite the "who it's for" characterisation of this community so it
reads as if written for THIS specific client — the wording, emphasis and
framing should reflect what they care about, so they feel it describes them.
2–4 sentences. Speak about the community and the kind of person it suits,
addressing the client's priorities without listing them mechanically.`
      : `Rewrite the descriptive narrative of this community so the emphasis
speaks to THIS specific client — foreground what matters to them, keep it
grounded in the known facts. 3–5 sentences of assured, editorial prose.`;

  const prompt = `${task}

--- COMMUNITY ---
${entityBlock(entity)}

--- CLIENT ON THE CALL ---
${clientBlock(profile)}

Return only the rewritten ${kind === "who_its_for" ? "who-it's-for" : "description"} prose.`;

  return { system, prompt };
}
