import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, GENERATION_MODEL } from "@/lib/anthropic";

// The normalized proposal a document extracts to. Everything optional —
// unknown fields stay null so nothing is invented (the honesty rule).
export interface IngestUnit {
  name?: string | null;
  sub_community?: string | null;
  unit_type?: "villa" | "townhouse" | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  bua_sqft?: number | null;
  plot_sqft?: number | null;
  price?: number | null;
  has_garden?: boolean | null;
  has_pool?: boolean | null;
  service_charge_per_sqft?: number | null;
}

export interface IngestProposal {
  community: {
    name?: string | null;
    developer?: string | null;
    status?: "ready" | "offplan" | "mixed" | null;
    positioning_tier?:
      | "ultra_prime" | "prime" | "premium" | "mid" | "accessible" | null;
    age_or_handover?: string | null;
    villa_count?: number | null;
    townhouse_count?: number | null;
    total_units?: number | null;
    description_long?: string | null;
    who_its_for_base?: string | null;
    character_tags?: string[] | null;
  };
  sub_communities: { name: string; status?: string | null; description_long?: string | null }[];
  units: IngestUnit[];
  payment_plan?: {
    plan_type?: string | null;
    construction_pct?: number | null;
    handover_pct?: number | null;
  } | null;
  source_note?: string | null;
}

const num = { type: "number" as const };
const str = { type: "string" as const };
const booln = { type: "boolean" as const };

// Tool schema forces Claude to return structured output (no JSON-in-prose
// parsing). Descriptions steer it to extract, not infer.
const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "save_extraction",
  description:
    "Save the real-estate facts found in the document. Extract ONLY what is " +
    "explicitly stated. Use null / omit anything not clearly in the document — " +
    "never guess prices, sizes, dates or counts.",
  input_schema: {
    type: "object",
    properties: {
      community: {
        type: "object",
        properties: {
          name: str,
          developer: str,
          status: { type: "string", enum: ["ready", "offplan", "mixed"] },
          positioning_tier: {
            type: "string",
            enum: ["ultra_prime", "prime", "premium", "mid", "accessible"],
          },
          age_or_handover: { ...str, description: "e.g. 'Offplan · handover Q3 2028'" },
          villa_count: num,
          townhouse_count: num,
          total_units: num,
          description_long: str,
          who_its_for_base: str,
          character_tags: {
            type: "array",
            items: str,
            description:
              "broad tags e.g. gated-family, waterfront, golf, new-launch, investment",
          },
        },
      },
      sub_communities: {
        type: "array",
        items: {
          type: "object",
          properties: { name: str, status: str, description_long: str },
          required: ["name"],
        },
      },
      units: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: str,
            sub_community: str,
            unit_type: { type: "string", enum: ["villa", "townhouse"] },
            bedrooms: num,
            bathrooms: num,
            bua_sqft: num,
            plot_sqft: num,
            price: { ...num, description: "AED, numeric only" },
            has_garden: booln,
            has_pool: booln,
            service_charge_per_sqft: num,
          },
        },
      },
      payment_plan: {
        type: "object",
        properties: {
          plan_type: { ...str, description: "e.g. '80/20', '40/60'" },
          construction_pct: num,
          handover_pct: num,
        },
      },
      source_note: {
        ...str,
        description: "One line naming the document/source, for provenance.",
      },
    },
    required: ["community", "sub_communities", "units"],
  },
};

const SYSTEM =
  "You are a meticulous Dubai real-estate data analyst. You read a developer " +
  "brochure, price list, DXB Interact export, or market report and extract " +
  "structured facts. Rules: (1) extract only what is explicitly present; " +
  "(2) never invent or estimate — leave unknowns null; (3) prices in AED as " +
  "plain numbers; (4) map bedroom/bathroom/plot/BUA per unit type where the " +
  "document lists them.";

export type IngestMedia =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; base64: string; mediaType: string }
  | { kind: "text"; text: string };

/** Extract a structured proposal from an uploaded document via Claude. */
export async function extractFromDocument(
  media: IngestMedia,
  hint?: string,
): Promise<{ proposal: IngestProposal | null; error?: string }> {
  const client = getAnthropic();
  if (!client) return { proposal: null, error: "Anthropic is not configured." };

  const instruction =
    "Extract the real-estate facts from this document into save_extraction." +
    (hint ? ` Context from the operator: ${hint}` : "");

  const content: Anthropic.ContentBlockParam[] = [];
  if (media.kind === "pdf") {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: media.base64 },
    });
  } else if (media.kind === "image") {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: media.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: media.base64,
      },
    });
  } else {
    content.push({ type: "text", text: `DOCUMENT:\n${media.text}` });
  }
  content.push({ type: "text", text: instruction });

  try {
    const response = await client.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "save_extraction" },
      messages: [{ role: "user", content }],
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) return { proposal: null, error: "No structured output returned." };
    const p = toolUse.input as IngestProposal;
    return {
      proposal: {
        community: p.community ?? {},
        sub_communities: Array.isArray(p.sub_communities) ? p.sub_communities : [],
        units: Array.isArray(p.units) ? p.units : [],
        payment_plan: p.payment_plan ?? null,
        source_note: p.source_note ?? null,
      },
    };
  } catch (e) {
    return { proposal: null, error: e instanceof Error ? e.message : "Extraction failed." };
  }
}
