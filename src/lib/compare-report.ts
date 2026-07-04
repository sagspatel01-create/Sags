import type { CompareModel } from "@/lib/compare-model";
import type { ClientProfileSnapshot, PriorityKey } from "@/lib/client-profile";
import {
  BUYER_LABEL,
  FINANCING_LABEL,
  PRIORITIES,
} from "@/lib/client-profile";
import { aed } from "@/lib/format";

/**
 * Prompt template for the client-ready comparison brief (Milestone 7).
 * Editable in code — the owner tunes voice, structure and emphasis here.
 * The model is fed the exact comparison data (14 groups) plus the client
 * profile; it must stay grounded and mark anything not yet available.
 */

const BRAND_VOICE = `You are the analyst desk for a single luxury real-estate advisor who is
the definitive name for Dubai villa and townhouse communities. Voice:
confident, precise, editorial, quietly exclusive — a buy-side brief, not a
brochure. No hype, no emoji, no exclamation marks. British spelling.`;

const GROUNDING = `Rules:
- Use ONLY the data provided below. A dash (—) means the figure is not yet
  available; say so plainly rather than inventing it. Never fabricate prices,
  yields, or claims.
- Do not print the client's exact budget figure; you may reference "your
  budget" and whether a community sits within reach.
- Write for the client to read or hear on a call — address them directly.`;

const FORMAT = `Return GitHub-flavoured Markdown in exactly this structure:

## The recommendation
One or two sentences naming the community that leads for this client, and the
strongest alternative, with the single reason each.

## The shortlist
For each community, a bold name followed by 2–3 sentences assessing it *for
this client specifically* — foreground what they care about, note where it is
within or beyond budget.

## What decides it
A short paragraph tying the choice to the client's stated priorities and goals.

## Recommended next step
One or two sentences — the concrete next move (a viewing, an underwrite, a
payment-plan modelling), framed around their timeline.

Keep the whole brief tight and assured — around 250–350 words.`;

function clientBlock(p: ClientProfileSnapshot | null): string {
  if (!p) return "No client profile is active — write a neutral, professional comparison for a discerning private buyer.";
  const priorities = (Object.entries(p.priorities) as [PriorityKey, number][])
    .filter(([, w]) => w >= 4)
    .map(([k]) => PRIORITIES.find((pr) => pr.key === k)?.label ?? k)
    .join(", ");
  return [
    `Session: ${p.session_label}`,
    `Buyer type: ${p.buyer_type ? BUYER_LABEL[p.buyer_type] : "unspecified"}`,
    `Budget band: ${p.budget ? `around ${aed(p.budget)} — do NOT state this number back` : "unspecified"}`,
    `Financing: ${p.financing_approach ? FINANCING_LABEL[p.financing_approach] : "unspecified"}`,
    p.goals ? `In their words: ${p.goals}` : null,
    priorities ? `They most care about: ${priorities}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function serializeModel(model: CompareModel): string {
  const cols = model.columns.map((c, i) => `${String.fromCharCode(65 + i)}=${c.name}`).join(", ");
  const header = model.columns
    .map((c, i) => {
      const letter = String.fromCharCode(65 + i);
      const fit =
        c.budgetFit === "in"
          ? "within budget"
          : c.budgetFit === "above"
            ? "above budget"
            : c.budgetFit === "below"
              ? "below budget"
              : "budget n/a";
      return `${letter}. ${c.name} — ${c.developerName ?? "developer n/a"}, ${c.status}, ${c.tierLabel ?? "tier n/a"}, ${fit}`;
    })
    .join("\n");

  const groups = model.groups
    .map((g) => {
      const rows = g.rows
        .map((r) => {
          const cells = r.cells
            .map((cell, i) => {
              const letter = String.fromCharCode(65 + i);
              const v =
                cell === null || cell === undefined || cell === "" ? "—" : String(cell);
              return `${letter}: ${v}`;
            })
            .join(" | ");
          const label = r.label ? `${r.label}: ` : "";
          return `  - ${label}${cells}`;
        })
        .join("\n");
      const flag = g.highlighted ? " [client priority]" : "";
      return `[${g.title}]${flag}\n${rows}`;
    })
    .join("\n");

  return `Columns: ${cols}\n\n${header}\n\nComparison data (— = not yet available):\n${groups}`;
}

export function buildComparisonReportPrompt(
  model: CompareModel,
  profile: ClientProfileSnapshot | null,
): { system: string; prompt: string } {
  const system = `${BRAND_VOICE}\n\n${GROUNDING}\n\n${FORMAT}`;
  const prompt = `Write the comparison brief.

--- CLIENT ON THE CALL ---
${clientBlock(profile)}

--- COMPARISON DATA ---
${serializeModel(model)}`;
  return { system, prompt };
}
