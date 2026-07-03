import type { SourceModule } from "./types";

/**
 * The source registry. Add a new source by adding a module here — nothing
 * else in the app hardcodes the source list (brief rule: sources are
 * swappable modules and the list keeps widening). Ingestion is NOT run in
 * Phase 1; `implemented: false` everywhere until real fetchers land.
 */

const dld: SourceModule = {
  key: "dld",
  label: "DLD / DXB Interact",
  category: "transactions",
  cadence: "weekly",
  implemented: false,
  notes:
    "Official transaction backbone — preferred for sale prices. Public/official data.",
};

const bayut: SourceModule = {
  key: "bayut",
  label: "Bayut",
  category: "listings",
  cadence: "weekly",
  implemented: false,
  notes:
    "Live listings + last-transaction data. Scraping (esp. logged-in) breaches ToS and risks bans — isolate as a swappable weekly module; a break must not take the tool down (brief §9).",
};

const propertyFinder: SourceModule = {
  key: "property_finder",
  label: "Property Finder",
  category: "listings",
  cadence: "weekly",
  implemented: false,
  notes: "Live listings. Same ToS/containment posture as Bayut (brief §9).",
};

const khda: SourceModule = {
  key: "khda",
  label: "KHDA",
  category: "schools",
  cadence: "manual",
  implemented: false,
  notes: "School ratings, curricula, fees.",
};

const googleMaps: SourceModule = {
  key: "google_maps",
  label: "Google Maps / Distance Matrix",
  category: "geo",
  cadence: "manual",
  implemented: false,
  notes: "Geo, commute times, POIs.",
};

const infrastructure: SourceModule = {
  key: "government_infrastructure",
  label: "Government / master-developer sources",
  category: "infrastructure",
  cadence: "manual",
  implemented: false,
  notes: "Infrastructure spend and master-plan catalysts.",
};

export const sourceRegistry: SourceModule[] = [
  dld,
  bayut,
  propertyFinder,
  khda,
  googleMaps,
  infrastructure,
];

export function getSource(key: string): SourceModule | undefined {
  return sourceRegistry.find((s) => s.key === key);
}
