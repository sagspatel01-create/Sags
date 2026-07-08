import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getCommunities, getSubCommunitiesLite } from "@/lib/data/communities";
import { DldImport } from "@/components/admin/DldImport";
import { NotConfigured } from "@/components/community/NotConfigured";

export const dynamic = "force-dynamic";

export default async function TransactionsImportPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const [communities, subs] = await Promise.all([
    getCommunities(),
    getSubCommunitiesLite(),
  ]);
  const lite = communities.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <div className="flex items-center gap-2 text-sm text-paper-500">
        <Link href="/admin" className="hover:text-paper-200">Admin</Link>
        <span>/</span>
        <span className="text-paper-300">Transactions (DLD)</span>
      </div>

      <p className="mt-6 text-eyebrow">Official market data</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        DLD transactions
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        The real, sourced pricing layer. Upload a DLD / Dubai Pulse transactions
        export (or a DXB Interact CSV for a specific area) and the engine
        computes real average price/sqft, median and transaction counts per
        community for the last 6 months. For hands-off updates, connect the
        Dubai Pulse API and it refreshes weekly.
      </p>

      <DldImport communities={lite} subs={subs} />

      <div className="mt-10 rounded-xl border border-ink-500 bg-ink-800/40 p-5 text-sm text-paper-500">
        <p className="text-eyebrow">Automate weekly (Digital Dubai / DDA API)</p>
        <p className="mt-2">
          Connected via the DDA iPaaS Open Data API. Set three variables in the
          deployment:{" "}
          <code className="text-paper-300">DUBAIPULSE_API_KEY</code> (client_id),{" "}
          <code className="text-paper-300">DUBAIPULSE_API_SECRET</code> (client_secret) and{" "}
          <code className="text-paper-300">DUBAIPULSE_APP_ID</code>{" "}
          (x-DDA-SecurityApplicationIdentifier), plus{" "}
          <code className="text-paper-300">DUBAIPULSE_ENV=prod</code>. The weekly
          job authenticates, health-checks the channel, then pulls the last 6
          months of villa &amp; townhouse sales and refreshes every community —
          no upload needed. Requires the <code className="text-paper-300">dld_transactions</code>{" "}
          grant to be active for <b>production</b> and the deployment&apos;s egress
          IP authorised with DDA. Manual CSV upload stays available for gap-fill.
        </p>
      </div>
    </div>
  );
}
