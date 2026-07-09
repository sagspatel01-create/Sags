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
    `NOI (net of vacancy + all OpEx): ${aed(r.noi)}/yr`,
    r.loanAmount > 0 ? `Annual debt service: ${aed(r.annualDebtService)} (interest ${aed(r.annualInterestY1)} / principal ${aed(r.annualPrincipalY1)})` : "",
    `Annual net cash flow: ${aed(r.annualNetCashFlow)} over ${r.incomeYears} income year(s)`,
    r.dscr != null ? `DSCR: ${r.dscr.toFixed(2)} (stress +2%: ${r.stressedDscr?.toFixed(2) ?? "—"})${r.dscr < 1.15 ? " — TIGHT, below 1.15" : ""}` : "",
    `Projected exit value: ${aed(r.exitValue)}; equity at exit (net of loan + sale): ${aed(r.exitEquity)}`,
    `Total profit: ${aed(r.totalProfit)}`,
    `IRR (cash-flow-timed, on capital invested): ${r.irrPct != null ? pct(r.irrPct) : "n/a"}`,
    `Equity multiple: ${r.equityMultiple.toFixed(2)}x; total ROI: ${pct(r.roiPct)}`,
    r.cashOnCashPct != null ? `Cash-on-cash (excl. principal): ${pct(r.cashOnCashPct)}` : "",
    r.roeYear1Pct != null ? `Return on equity (yr 1): ${pct(r.roeYear1Pct)}` : "",
    r.netYieldPct != null ? `Net yield: ${pct(r.netYieldPct)}` : "",
    context.notes ? `Operator notes: ${context.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system =
    "You are a top-tier Dubai real-estate investment underwriter writing a " +
    "persuasive but credible investor case for a private buyer. You are given " +
    "a deal's already-computed numbers (all returns are on ACTUAL CAPITAL " +
    "INVESTED) — use them exactly, never recalculate or invent figures. Make " +
    "the strongest HONEST case: lead with the upside, ground every claim in " +
    "the numbers and the operator's stated growth factors (construction, " +
    "handover/completion dates, government & infrastructure plans, developer " +
    "track record, absorption, supply). Credibility comes from naming the real " +
    "risks, not hiding them — that is what makes it trustworthy. Structure: " +
    "(1) VERDICT — Strong / Consider / Pass, one line, biggest reason; " +
    "(2) 'The case' — 2-3 sentences on the return drivers on invested capital, " +
    "citing the growth factors; (3) 'Key factors' — 2-4 crisp bullets from the " +
    "growth notes / fundamentals that support appreciation; (4) 'Risks' — the " +
    "2 most material, honestly; (5) 'Adjust' — one or two levers (price, " +
    "payment plan, hold, yield) that materially change the outcome. Under " +
    "~220 words. Confident, specific, investor-grade prose. No preamble.";

  const verdict = await generateText({
    system,
    prompt: `Underwrite this deal:\n\n${facts}`,
    maxTokens: 700,
  });
  if (!verdict) return { verdict: null, error: "Anthropic is not configured or the call failed." };
  return { verdict };
}
