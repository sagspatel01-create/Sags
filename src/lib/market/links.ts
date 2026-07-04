/**
 * Live-market deep links. We never scrape Bayut / Property Finder (no free
 * API, and scraping breaches their ToS). Instead we build direct links into
 * their live search for the selected area + filters — the results open on the
 * portal itself, nothing is stored. Transactions & rentals come from DXB
 * Interact / DLD (official DLD data). This is a compliant "review" aggregator.
 */

export type Purpose = "sale" | "rent";
export type PropType = "villas" | "townhouses";

export interface MarketFilter {
  beds?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

export interface MarketLink {
  source: "Bayut" | "Property Finder" | "DXB Interact" | "DLD";
  label: string;
  url: string;
}

function bayut(
  purpose: Purpose,
  type: PropType,
  slug: string,
  f: MarketFilter,
): string {
  const base = purpose === "sale" ? "for-sale" : "to-rent";
  const qs = new URLSearchParams();
  if (f.beds) qs.set("beds", String(f.beds));
  if (f.priceMin) qs.set("price_min", String(f.priceMin));
  if (f.priceMax) qs.set("price_max", String(f.priceMax));
  const q = qs.toString();
  return `https://www.bayut.com/${base}/${type}/dubai/${slug}/${q ? `?${q}` : ""}`;
}

function propertyFinder(
  purpose: Purpose,
  name: string,
  f: MarketFilter,
): string {
  // PF keyword search is the most slug-resilient entry point.
  const qs = new URLSearchParams();
  qs.set("c", purpose === "sale" ? "1" : "2"); // 1 = buy, 2 = rent
  qs.set("q", name);
  if (f.beds) qs.set("bdr", String(f.beds));
  if (f.priceMin) qs.set("pf", String(f.priceMin));
  if (f.priceMax) qs.set("pt", String(f.priceMax));
  return `https://www.propertyfinder.ae/en/search?${qs.toString()}`;
}

function dxbInteract(slug: string): string {
  return `https://dxbinteract.com/dubai/${slug}`;
}

/** Build the full set of live-market links for a community. */
export function marketLinks(
  community: { name: string; slug: string },
  f: MarketFilter,
): { sale: MarketLink[]; rent: MarketLink[]; data: MarketLink[] } {
  const { name, slug } = community;
  return {
    sale: [
      { source: "Bayut", label: "Villas for sale", url: bayut("sale", "villas", slug, f) },
      { source: "Bayut", label: "Townhouses for sale", url: bayut("sale", "townhouses", slug, f) },
      { source: "Property Finder", label: "For sale", url: propertyFinder("sale", name, f) },
    ],
    rent: [
      { source: "Bayut", label: "Villas to rent", url: bayut("rent", "villas", slug, f) },
      { source: "Bayut", label: "Townhouses to rent", url: bayut("rent", "townhouses", slug, f) },
      { source: "Property Finder", label: "To rent", url: propertyFinder("rent", name, f) },
    ],
    data: [
      { source: "DXB Interact", label: "Sales & rental transactions", url: dxbInteract(slug) },
      { source: "DLD", label: "Official DLD transactions", url: "https://dubailand.gov.ae/en/open-data/real-estate-data/" },
    ],
  };
}
