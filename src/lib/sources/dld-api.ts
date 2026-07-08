import "server-only";
import { normalizeRow, type DldRow } from "@/lib/sources/dld";

/**
 * Digital Dubai (DDA) iPaaS connector — the automated pull behind the weekly
 * DLD refresh. Implements the three-stage DDA workflow:
 *   1. Gateway Token API  — POST JSON {grant_type,client_id,client_secret},
 *      header x-DDA-SecurityApplicationIdentifier → OAuth2 Bearer token.
 *   2. Health-Check API    — GET, verifies the channel is authorised.
 *   3. Open Data API        — GET /openapi/1.0.0/<entity>/<dataset>, paginated.
 *
 * Runs server-side only (from the deployment, whose stable egress is the
 * IP registered/authorised with DDA). Returns normalised DLD rows; the caller
 * filters/aggregates with the shared logic in `dld.ts`. Honesty rule: only
 * real rows from the API are returned.
 */

function baseUrl(dpEnv: string): string {
  return dpEnv === "prod" ? "https://apis.data.dubai" : "https://stg-apis.data.dubai";
}

export interface DdaCreds {
  appId: string;
  clientId: string;
  clientSecret: string;
  env: string; // "prod" | "staging"
}

/** Stage 1 — obtain a time-bound Bearer token from the Gateway Token API. */
async function getToken(c: DdaCreds): Promise<{ token?: string; error?: string }> {
  const url = `${baseUrl(c.env)}/secure/ssis/dubaiai/gatewaytoken/1.0.0/getAccessToken`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "x-DDA-SecurityApplicationIdentifier": c.appId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: c.clientId,
        client_secret: c.clientSecret,
        scope: "authz",
      }),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "token fetch failed" };
  }
  const text = await res.text();
  if (!res.ok) return { error: `DDA token ${res.status}: ${text.slice(0, 200)}` };
  try {
    const j = JSON.parse(text) as { access_token?: string };
    return j.access_token ? { token: j.access_token } : { error: "no access_token in response" };
  } catch {
    return { error: `unparseable token response: ${text.slice(0, 120)}` };
  }
}

/** Stage 2 — verify the integration channel is live and authorised. */
export async function healthCheck(c: DdaCreds): Promise<{ ok: boolean; detail: string }> {
  const t = await getToken(c);
  if (!t.token) return { ok: false, detail: t.error ?? "auth failed" };
  const url = `${baseUrl(c.env)}/secure/ddads/healthcheck/1.0.0/health`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t.token}`, Accept: "application/json" } });
    const text = await res.text();
    return { ok: res.ok, detail: text.slice(0, 200) };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "health fetch failed" };
  }
}

function extractRows(payload: unknown): Record<string, string>[] {
  if (Array.isArray(payload)) return payload as Record<string, string>[];
  const p = payload as Record<string, unknown>;
  for (const k of ["results", "result", "data", "records", "value"]) {
    if (Array.isArray(p?.[k])) return p[k] as Record<string, string>[];
  }
  return [];
}

/**
 * Stage 3 — pull DLD transactions since `sinceISO` (YYYY-MM-DD), paginated.
 * Uses the Open Data API's page/pageSize + filter/order_by params. Respects
 * the 60 req/min rate limit with a small delay between pages.
 */
export async function fetchDldTransactions(
  c: DdaCreds,
  sinceISO: string,
  opts: { entity?: string; dataset?: string; maxPages?: number; pageSize?: number } = {},
): Promise<{ rows: DldRow[]; error?: string }> {
  const { entity = "dld", dataset = "dld_transactions", maxPages = 60, pageSize = 5000 } = opts;
  const t = await getToken(c);
  if (!t.token) return { rows: [], error: t.error ?? "Dubai Pulse auth failed — check credentials." };

  const dataBase = `${baseUrl(c.env)}/secure/ddads/openapi/1.0.0/${entity}/${dataset}`;
  const rows: DldRow[] = [];
  const headers = { Authorization: `Bearer ${t.token}`, Accept: "application/json" };

  for (let page = 1; page <= maxPages; page++) {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      filter: `instance_date>=${sinceISO}`,
      order_by: "instance_date",
      order_dir: "desc",
    });
    let res: Response;
    try {
      res = await fetch(`${dataBase}?${qs.toString()}`, { headers });
    } catch (e) {
      return { rows, error: e instanceof Error ? e.message : "data fetch failed" };
    }
    if (!res.ok) {
      if (page === 1) return { rows, error: `DDA data ${res.status}: ${(await res.text()).slice(0, 200)}` };
      break;
    }
    const batch = extractRows(await res.json());
    if (batch.length === 0) break;
    for (const r of batch) rows.push(normalizeRow(r));
    if (batch.length < pageSize) break;
    await new Promise((r) => setTimeout(r, 1100)); // stay under 60 req/min
  }
  return { rows };
}
