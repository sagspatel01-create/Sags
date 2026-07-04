import "server-only";
import { normalizeRow, type DldRow } from "@/lib/sources/dld";

/**
 * Dubai Pulse (DLD) API connector — the automated pull behind the weekly
 * refresh. Requires a free registered API key/secret for the
 * `dld_transactions` dataset. Runs server-side only (from the deployment,
 * which can reach dubaipulse.gov.ae). Returns normalized DLD rows; the
 * caller filters/aggregates with the shared logic in `dld.ts`.
 */

const OAUTH = "https://api.dubaipulse.gov.ae/oauth/client_credential/accesstoken?grant_type=client_credentials";
const DATA = "https://api.dubaipulse.gov.ae/open/dld/dld_transactions-open-api";

async function token(key: string, secret: string): Promise<string | null> {
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=${encodeURIComponent(key)}&client_secret=${encodeURIComponent(secret)}`,
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

function extractRows(payload: unknown): Record<string, string>[] {
  if (Array.isArray(payload)) return payload as Record<string, string>[];
  const p = payload as Record<string, unknown>;
  for (const k of ["result", "results", "data", "records", "value"]) {
    if (Array.isArray(p?.[k])) return p[k] as Record<string, string>[];
  }
  return [];
}

/** Pull DLD transactions updated since `sinceISO` (YYYY-MM-DD), paginated. */
export async function fetchDldTransactions(
  key: string,
  secret: string,
  sinceISO: string,
  maxPages = 40,
): Promise<{ rows: DldRow[]; error?: string }> {
  const tok = await token(key, secret);
  if (!tok) return { rows: [], error: "Dubai Pulse auth failed — check API key/secret." };

  const rows: DldRow[] = [];
  const pageSize = 5000;
  for (let page = 0; page < maxPages; page++) {
    const url = `${DATA}?%24top=${pageSize}&%24skip=${page * pageSize}&%24filter=${encodeURIComponent(`instance_date ge ${sinceISO}`)}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } });
    } catch (e) {
      return { rows, error: e instanceof Error ? e.message : "fetch failed" };
    }
    if (!res.ok) {
      // Some tenants ignore OData params; a 400 on page 0 means fall back to
      // an unfiltered pull (caller still filters by date).
      if (page === 0 && (res.status === 400 || res.status === 404)) {
        const alt = await fetch(`${DATA}?limit=${pageSize}`, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } });
        if (alt.ok) {
          for (const r of extractRows(await alt.json())) rows.push(normalizeRow(r));
        }
      }
      break;
    }
    const batch = extractRows(await res.json());
    if (batch.length === 0) break;
    for (const r of batch) rows.push(normalizeRow(r));
    if (batch.length < pageSize) break;
  }
  return { rows };
}
