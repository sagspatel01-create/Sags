import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env, isAnthropicConfigured } from "@/lib/env";

/**
 * Server-only Anthropic client. Returns null when no API key is configured,
 * so callers degrade gracefully (the tailoring UI shows a "connect Anthropic"
 * state instead of throwing).
 */
export function getAnthropic(): Anthropic | null {
  if (!isAnthropicConfigured()) return null;
  return new Anthropic({ apiKey: env.anthropicApiKey });
}

export const GENERATION_MODEL = env.anthropicModel;

/**
 * Run a single copy-generation turn. Short outputs, tuned for a live call:
 * no forced thinking (fast, low-latency), modest max_tokens. Returns the
 * plain text, or null on failure.
 */
export async function generateText(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> {
  const client = getAnthropic();
  if (!client) return null;
  const response = await client.messages.create({
    model: GENERATION_MODEL,
    max_tokens: params.maxTokens ?? 900,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text || null;
}
