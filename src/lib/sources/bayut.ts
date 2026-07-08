/**
 * Bayut (RapidAPI "UAE Real Estate") DLD transactions source — an alternative
 * to the DDA/Dubai Pulse pull that is globally callable (no UAE-only egress
 * restriction) with a simple static API key. Surfaces DLD-registered sales
 * with the full Bayut location hierarchy (L3 master community, L4 cluster),
 * price, price/sqm, BUA, beds and ready/offplan.
 *
 * It maps each Bayut hit into the shared `DldRow` shape so the exact same
 * aggregate()/buildCommunityTxns() pipeline and community matching are reused
 * — zero divergence from the DDA path. Pure module (no server-only) so both
 * the app and the standalone backfill script can use it.
 *
 * Note: the API bundles villas + townhouses under one category (3) and gives
 * no sub-type, so unit_type here is BUA-approximated (see UNIT split below);
 * the DDA/DLD feed carries the exact property_sub_type when it comes online.
 */
import type { DldRow } from "@/lib/sources/dld";

const HOST = "uae-real-estate3.p.rapidapi.com";
const VILLA_TH_CATEGORY = "3";
// BUA (sqm) at/under which a category-3 home is treated as a townhouse rather
// than a villa. ~230 sqm ≈ 2,475 sqft — a reasonable split for Dubai stock.
const TH_BUA_SQM = 230;

interface BayutHit {
  date_transaction_nk?: string;
  transaction_amount?: string;
  transaction_per_sqm_amount?: string;
  builtup_area_sqm?: string;
  plot_area_sqm?: string;
  beds?: string;
  bayut_location_l3_name_en?: string;
  bayut_location_l4_name_en?: string;
  bayut_leaf_location_name_en?: string;
  transaction_category_l1_name?: string;
  property_completion_status_sk?: string;
}

/** Map one Bayut transaction hit into the shared normalized DldRow shape. */
export function mapHit(h: BayutHit): DldRow {
  const bua = Number(h.builtup_area_sqm) || null;
  const isTh = bua != null && bua <= TH_BUA_SQM;
  const sub = isTh ? "Townhouse" : "Villa";
  const offplan = (h.property_completion_status_sk ?? "").toLowerCase().includes("off");
  return {
    date: (h.date_transaction_nk ?? "").slice(0, 10),
    transGroup: h.transaction_category_l1_name || "Sales",
    regType: offplan ? "Off-Plan Properties" : "Existing Properties",
    propertyType: sub,
    propertySubType: sub,
    area: h.bayut_location_l3_name_en ?? "",
    masterProject: h.bayut_location_l3_name_en ?? "",
    project: h.bayut_location_l4_name_en || h.bayut_leaf_location_name_en || "",
    rooms: h.beds ? `${h.beds} B/R` : "",
    areaSqm: bua,
    price: Number(h.transaction_amount) || null,
    pricePerSqm: Number(h.transaction_per_sqm_amount) || null,
  };
}

export interface BayutPullResult {
  rows: DldRow[];
  pages: number;
  requests: number;
  error?: string;
}

/**
 * Pull villa/townhouse DLD sales from the Bayut API, newest first, mapping to
 * DldRow. Stops at `maxPages` (request-budget guard — the free tier allows
 * ~900 req/month) or when the page is empty. `timePeriod` is the API's server
 * window (e.g. "6m", "12m").
 */
export async function fetchBayutSales(
  apiKey: string,
  opts: { timePeriod?: string; maxPages?: number; onPage?: (p: number, n: number) => void } = {},
): Promise<BayutPullResult> {
  const { timePeriod = "6m", maxPages = 700, onPage } = opts;
  const headers = { "x-rapidapi-key": apiKey, "x-rapidapi-host": HOST };
  const rows: DldRow[] = [];
  let requests = 0;
  let page = 1;
  for (; page <= maxPages; page++) {
    const url = `https://${HOST}/transactions?purpose=for-sale&time_period=${timePeriod}&category_ids=${VILLA_TH_CATEGORY}&page=${page}`;
    let res: Response;
    // Retry on rate-limit (429) / transient 5xx with exponential backoff so a
    // deep pull isn't cut short by the free tier's per-second throttle.
    let attempt = 0;
    for (;;) {
      try {
        res = await fetch(url, { headers });
      } catch (e) {
        if (attempt++ < 4) { await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); continue; }
        return { rows, pages: page - 1, requests, error: e instanceof Error ? e.message : "fetch failed" };
      }
      requests++;
      if ((res.status === 429 || res.status >= 500) && attempt++ < 5) {
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
        continue;
      }
      break;
    }
    if (!res.ok) {
      if (page === 1) return { rows, pages: 0, requests, error: `Bayut API ${res.status}: ${(await res.text()).slice(0, 160)}` };
      break;
    }
    const body = (await res.json()) as { data?: { hits?: BayutHit[]; nbPages?: number } };
    const hits = body.data?.hits ?? [];
    if (hits.length === 0) break;
    for (const h of hits) rows.push(mapHit(h));
    onPage?.(page, rows.length);
    if (body.data?.nbPages != null && page >= body.data.nbPages) break;
    await new Promise((r) => setTimeout(r, 250)); // gentle pacing
  }
  return { rows, pages: page - 1, requests };
}
