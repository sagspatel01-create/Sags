/**
 * CRM logic test — feeds 10 diverse mortgage leads through the REAL
 * production aggregation (buildForecast / summarizePipeline / dealCommission
 * from src/lib/crm.ts) and asserts every headline number the UI shows.
 *
 * Run: npx tsx scripts/test-crm.ts
 *
 * The date is pinned to 2026-08-14 so the month buckets are deterministic.
 * Only `import type` crosses into the app's type module, so this runs under
 * tsx with no path-alias resolution needed.
 */
import {
  buildForecast,
  summarizePipeline,
  dealCommission,
  dealDisbursement,
  monthLabel,
  STAGE_LABEL,
  productLabel,
} from "../src/lib/crm.ts";
import type { CrmProduct, CrmStage } from "../src/lib/db/types.ts";

const NOW = new Date("2026-08-14T09:00:00");
const M = (yyyyMm: string) => `${yyyyMm}-01`;

type Lead = {
  name: string;
  product: CrmProduct;
  product_other: string | null;
  stage: CrmStage;
  probability: number;
  loan_amount: number | null;
  property_value: number | null;
  commission_pct: number | null;
  commission_amount: number | null;
  close_month: string | null;
};

// ---- The 10 leads (every product, stage, and timing path) ------------
const leads: Lead[] = [
  { name: "Aisha Khan",        product: "new_purchase",     product_other: null,        stage: "submitted",      probability: 60, loan_amount: 2_000_000, property_value: 2_500_000, commission_pct: 1.0,  commission_amount: null,   close_month: M("2026-09") },
  { name: "Rajiv Menon",       product: "handover_offplan", product_other: null,        stage: "qualified",      probability: 25, loan_amount: 3_000_000, property_value: 4_200_000, commission_pct: 0.75, commission_amount: null,   close_month: M("2026-11") }, // work now, closes in 3 months
  { name: "Sophie Laurent",    product: "equity_release",   product_other: null,        stage: "approved",       probability: 85, loan_amount: 1_500_000, property_value: 3_000_000, commission_pct: null, commission_amount: 15_000, close_month: M("2026-10") },
  { name: "Omar Al Fahim",     product: "buyout_transfer",  product_other: null,        stage: "disbursed",      probability: 100, loan_amount: 2_500_000, property_value: 3_100_000, commission_pct: 0.5,  commission_amount: null,   close_month: M("2026-08") }, // disbursed THIS month
  { name: "Wei Chen",          product: "other",            product_other: "Islamic finance", stage: "contacted", probability: 10, loan_amount: 800_000,   property_value: 1_100_000, commission_pct: 1.0,  commission_amount: null,   close_month: M("2026-09") },
  { name: "Priya Sharma",      product: "new_purchase",     product_other: null,        stage: "docs_collected", probability: 40, loan_amount: null,      property_value: 4_000_000, commission_pct: 0.75, commission_amount: null,   close_month: M("2026-10") }, // no loan_amount → uses property_value
  { name: "James O'Brien",     product: "handover_offplan", product_other: null,        stage: "new_lead",       probability: 5,  loan_amount: 5_000_000, property_value: 6_500_000, commission_pct: 0.6,  commission_amount: null,   close_month: null }, // undated
  { name: "Fatima Noor",       product: "equity_release",   product_other: null,        stage: "lost",           probability: 0,  loan_amount: 1_000_000, property_value: 1_800_000, commission_pct: 0.7,  commission_amount: null,   close_month: M("2026-09") }, // lost → excluded
  { name: "David Cohen",       product: "new_purchase",     product_other: null,        stage: "disbursed",      probability: 100, loan_amount: 3_500_000, property_value: 4_400_000, commission_pct: 0.8,  commission_amount: null,   close_month: M("2026-09") }, // committed Sep
  { name: "Layla Haddad",      product: "buyout_transfer",  product_other: null,        stage: "approved",       probability: 85, loan_amount: 2_200_000, property_value: 2_900_000, commission_pct: 0.7,  commission_amount: null,   close_month: M("2026-08") }, // open, this month
];

const targets = new Map<string, number>([[M("2026-09"), 12_000_000]]); // Sep raised to 12M

// ---- Assertion plumbing ----------------------------------------------
let passed = 0;
let failed = 0;
function eq(label: string, got: number, want: number) {
  const ok = Math.abs(got - want) < 0.01;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${got.toLocaleString()}${ok ? "" : `  (expected ${want.toLocaleString()})`}`);
  ok ? passed++ : failed++;
}

console.log("\n=== 10 leads entered ===");
for (const l of leads) {
  console.log(
    `  ${l.name.padEnd(16)} ${productLabel(l.product, l.product_other).padEnd(28)} ${STAGE_LABEL[l.stage].padEnd(15)} ` +
    `loan ${(dealDisbursement(l)).toLocaleString().padStart(10)}  comm ${dealCommission(l).toLocaleString().padStart(8)}  ` +
    `${l.close_month ? monthLabel(l.close_month) : "— undated"}`,
  );
}

// ---- Forecast (real production code) ---------------------------------
const fc = buildForecast(leads, targets, 6, NOW);
console.log("\n=== Forecast by disbursement month (buildForecast) ===");
for (const r of fc.rows) {
  const projected = r.committed + r.weighted;
  const hit = projected >= r.target ? "on target" : `gap ${(projected - r.target).toLocaleString()}`;
  console.log(`  ${monthLabel(r.month).padEnd(15)} committed ${r.committed.toLocaleString().padStart(10)}  weighted ${Math.round(r.weighted).toLocaleString().padStart(10)}  target ${r.target.toLocaleString().padStart(11)}  (${hit})`);
}
console.log(`  Undated: ${fc.undated.count} deal(s), gross ${fc.undated.gross.toLocaleString()}, weighted ${Math.round(fc.undated.weighted).toLocaleString()}`);

const aug = fc.rows[0], sep = fc.rows[1], oct = fc.rows[2], nov = fc.rows[3];

console.log("\n=== Assertions ===");
console.log("August 2026 (disbursed this month + open buyout):");
eq("Aug committed", aug.committed, 2_500_000);
eq("Aug weighted", aug.weighted, 1_870_000);
eq("Aug dealCount", aug.dealCount, 2);
eq("Aug commission", Math.round(aug.commission), 25_590);
eq("Aug target (default)", aug.target, 10_000_000);

console.log("September 2026 (target override 12M):");
eq("Sep committed", sep.committed, 3_500_000);
eq("Sep weighted", sep.weighted, 1_280_000);
eq("Sep dealCount", sep.dealCount, 3);
eq("Sep target (override)", sep.target, 12_000_000);

console.log("October 2026:");
eq("Oct weighted", oct.weighted, 2_875_000);
eq("Oct dealCount", oct.dealCount, 2);

console.log("November 2026 (the deferred handover — work now, closes in 3 months):");
eq("Nov weighted", nov.weighted, 750_000);
eq("Nov dealCount", nov.dealCount, 1);

console.log("Undated + totals:");
eq("Undated count", fc.undated.count, 1);
eq("Undated gross", fc.undated.gross, 5_000_000);
eq("Total open pipeline", fc.totalPipeline, 18_500_000);
eq("Total weighted pipeline", Math.round(fc.totalWeighted), 7_025_000);

// ---- Pipeline summary (real production code) -------------------------
const sum = summarizePipeline(leads, /*totalContacts*/ 10, /*dueToday*/ 3, NOW);
console.log("\n=== Pipeline summary (summarizePipeline) ===");
console.log(`  ${JSON.stringify(sum, null, 0)}`);
eq("openDeals", sum.openDeals, 7);
eq("openValue", sum.openValue, 18_500_000);
eq("weightedValue", Math.round(sum.weightedValue), 7_025_000);
eq("disbursedThisMonth (Aug only)", sum.disbursedThisMonth, 2_500_000);

// ---- Commission derivation edge cases --------------------------------
console.log("\n=== Commission derivation ===");
eq("explicit amount wins (Sophie)", dealCommission(leads[2]), 15_000);
eq("derived from % × loan (Aisha 1% of 2M)", dealCommission(leads[0]), 20_000);
eq("derived uses property_value when no loan (Priya 0.75% of 4M)", dealCommission(leads[5]), 30_000);

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
