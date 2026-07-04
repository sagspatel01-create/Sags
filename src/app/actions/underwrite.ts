"use server";

import { generateText } from "@/lib/anthropic";
import { underwrite, type UnderwriteInput } from "@/lib/underwrite";
import { aed, pct } from "@/lib/format";

/**
 * Claude's investment verdict. It reads the deterministically-computed
 * underwriting numbers (it does not invent them) plus any community context,
 * and returns a buy-side read: strength, the key risks, and what to adjust.
 */
export async function investmentVerdict(
  input: UnderwriteInput,
  context: {
    community?: string | null;
    status?: string | null;
    tier?: string | null;
    developer?: string | null;
    notes?: string | null;
  },
): Promise<{ verdict: string | null; error?: string }> {
  const r = underwrite(input);

  const facts = [
    `Deal: ${context.community ?? "Unnamed"} (${input.dealType}${context.status ? ", " + context.status : ""})`,
    context.developer ? `Developer: ${context.developer}` : "",
    context.tier ? `Positioning: ${context.tier}` : "",
    `Purchase price: ${aed(input.price)}`,
    `Cash invested (equity in): ${aed(r.cashInvested)}`,
    input.dealType === "offplan"
      ? `Payment plan: ${input.constructionPct ?? 100}/${input.handoverPct ?? 0}, ~${input.constructionYears ?? 0}y to handover`
      : input.financing === "mortgage"
        ? `Financing: mortgage ${input.ltvPct ?? 75}% LTV @ ${input.mortgageRatePct ?? 4.5}% / ${input.mortgageTenorYears ?? 25}y`
        : "Financing: all cash",
    `Hold: ${input.holdingYears}y at ${pct(input.appreciationPct)} p.a. appreciation, ${pct(input.grossYieldPct)} gross yield`,
    `Annual net cash flow: ${aed(r.annualNetCashFlow)} over ${r.incomeYears} income year(s)`,
    `Projected exit value: ${aed(r.exitValue)}`,
    `Total profit: ${aed(r.totalProfit)}`,
    `Equity multiple: ${r.equityMultiple.toFixed(2)}x`,
    `ROI: ${pct(r.roiPct)} total, ${pct(r.annualizedRoiPct)} annualized`,
    r.cashOnCashPct != null ? `Cash-on-cash: ${pct(r.cashOnCashPct)}` : "",
    r.netYieldPct != null ? `Net yield: ${pct(r.netYieldPct)}` : "",
    context.notes ? `Operator notes: ${context.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system =
    "You are a disciplined Dubai real-estate investment underwriter writing " +
    "for a private buyer. You are given a deal's already-computed numbers — " +
    "use them, do not recalculate or invent figures. Give a clear buy-side " +
    "read. Be specific and honest: if returns are thin or assumptions " +
    "aggressive, say so. Structure: (1) a one-line VERDICT — Strong / " +
    "Consider / Pass, with the single biggest reason; (2) 'Why' — 2-3 " +
    "sentences on the return drivers; (3) 'Risks' — the 2 most material; " +
    "(4) 'Adjust' — one or two levers (price, payment plan, hold, yield) that " +
    "would materially change the outcome. Keep it under ~180 words. Plain, " +
    "confident prose. No preamble.";

  const verdict = await generateText({
    system,
    prompt: `Underwrite this deal:\n\n${facts}`,
    maxTokens: 700,
  });
  if (!verdict) return { verdict: null, error: "Anthropic is not configured or the call failed." };
  return { verdict };
}
