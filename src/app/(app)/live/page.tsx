import { isSupabaseConfigured } from "@/lib/env";
import { getCommunities } from "@/lib/data/communities";
import { LiveMarket } from "@/components/market/LiveMarket";
import { NotConfigured } from "@/components/community/NotConfigured";

export const dynamic = "force-dynamic";

export default async function LiveMarketPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const communities = await getCommunities();
  const areas = communities
    .map((c) => ({ name: c.name, slug: c.slug }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">Live market</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        Listings &amp; transactions
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        A review board over the live sources. Pick an area and jump straight
        into current Bayut &amp; Property Finder listings — for sale and to rent
        — plus recorded transactions and rental contracts from DXB Interact and
        the DLD. When a figure checks out, bring it into the engine with Absorb.
      </p>

      {areas.length === 0 ? (
        <p className="mt-8 text-sm text-paper-700">
          No areas yet — add communities first.
        </p>
      ) : (
        <LiveMarket areas={areas} />
      )}
    </div>
  );
}
