"use client";

import { useMemo, useState } from "react";
import { marketLinks, type MarketFilter, type MarketLink } from "@/lib/market/links";

interface AreaRef {
  name: string;
  slug: string;
}

const SOURCE_COLOR: Record<MarketLink["source"], string> = {
  Bayut: "#7fa88a",
  "Property Finder": "#8a94b5",
  "DXB Interact": "#c9a45c",
  DLD: "#c99a6a",
};

/**
 * Live-market review board. Pick an area, set filters, and jump straight
 * into the live sale / rent / transaction sources for it. Links open on the
 * portal — nothing is scraped or stored.
 */
export function LiveMarket({ areas }: { areas: AreaRef[] }) {
  const [slug, setSlug] = useState(areas[0]?.slug ?? "");
  const [beds, setBeds] = useState<number | "">("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const area = areas.find((a) => a.slug === slug) ?? areas[0];

  const links = useMemo(() => {
    if (!area) return null;
    const f: MarketFilter = {
      beds: beds === "" ? null : Number(beds),
      priceMin: priceMin ? Number(priceMin) : null,
      priceMax: priceMax ? Number(priceMax) : null,
    };
    return marketLinks(area, f);
  }, [area, beds, priceMin, priceMax]);

  return (
    <div className="mt-8 space-y-6">
      {/* Controls */}
      <div className="elevate grid gap-4 rounded-xl border border-ink-500 bg-ink-800/50 p-5 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-eyebrow">Area</span>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-paper-100 outline-none focus:border-accent-500"
          >
            {areas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-eyebrow">Beds</span>
          <select
            value={beds}
            onChange={(e) => setBeds(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-paper-100 outline-none focus:border-accent-500"
          >
            <option value="">Any</option>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-eyebrow">Price min</span>
          <input
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="AED"
            className="tnum w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-paper-100 outline-none placeholder:text-paper-700 focus:border-accent-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-eyebrow">Price max</span>
          <input
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="AED"
            className="tnum w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-paper-100 outline-none placeholder:text-paper-700 focus:border-accent-500"
          />
        </label>
      </div>

      {links && (
        <div className="grid gap-6 lg:grid-cols-3">
          <LinkColumn title="For sale" note="Live listings" links={links.sale} />
          <LinkColumn title="For rent" note="Rental listings & yields" links={links.rent} />
          <LinkColumn title="Transactions & rentals" note="Official DLD data" links={links.data} />
        </div>
      )}

      <p className="text-xs text-paper-700">
        Links open the live source in a new tab — Bayut / Property Finder for
        listings, DXB Interact / DLD for recorded transactions and rental
        contracts. Nothing here is scraped or stored; it&apos;s a review board.
        Use <span className="text-paper-500">Absorb</span> to pull confirmed
        figures into the engine.
      </p>
    </div>
  );
}

function LinkColumn({
  title,
  note,
  links,
}: {
  title: string;
  note: string;
  links: MarketLink[];
}) {
  return (
    <div className="elevate rounded-xl border border-ink-500 bg-ink-800/40 p-5">
      <p className="font-display text-lg text-paper-100">{title}</p>
      <p className="mt-0.5 text-xs text-paper-500">{note}</p>
      <div className="mt-4 space-y-2">
        {links.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-3 rounded-lg border border-ink-500 bg-ink-900/50 px-4 py-3 transition-colors hover:bg-ink-700"
          >
            <span className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: SOURCE_COLOR[l.source] }}
              />
              <span className="text-sm text-paper-200 group-hover:text-paper-100">
                {l.label}
              </span>
            </span>
            <span className="flex items-center gap-2 text-xs text-paper-500">
              {l.source}
              <span className="text-paper-700 transition-transform group-hover:translate-x-0.5">↗</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
