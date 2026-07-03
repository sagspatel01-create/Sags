/**
 * Source-module contract.
 *
 * Every external data source (DLD, Bayut, Property Finder, KHDA, Google
 * Maps, government/infrastructure feeds) is an isolated, swappable module
 * implementing this interface. One source breaking must never take the
 * app down — the registry treats each independently.
 *
 * Phase 1 does NOT run ingestion. These modules describe *what exists*
 * and provide a stable seam to plug real fetchers into later. Phase 1
 * data is entered/edited manually via the admin surface.
 *
 * Hard rule: never fabricate data. A module with no live fetcher yet
 * simply reports `implemented: false`; empty fields stay visibly empty.
 */

export type SourceCategory =
  | "transactions"
  | "listings"
  | "schools"
  | "geo"
  | "infrastructure";

export type SourceCadence = "daily" | "weekly" | "manual";

export interface SourceModule {
  /** Stable key, matches data_sources.key in the DB. */
  key: string;
  label: string;
  category: SourceCategory;
  cadence: SourceCadence;
  /** True once a real, ToS-respecting fetcher is wired in (Phase 2+). */
  implemented: boolean;
  /** Honest note on reliability / legal posture (see brief §9). */
  notes?: string;
  /**
   * Placeholder for the future ingestion entrypoint. Intentionally not
   * called in Phase 1. Kept optional so unimplemented modules omit it.
   */
  run?: () => Promise<SourceRunResult>;
}

export interface SourceRunResult {
  ok: boolean;
  fetched: number;
  message?: string;
}
