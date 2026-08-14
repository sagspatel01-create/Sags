import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { importContactsCsv } from "@/app/actions/crm";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
      <Link href="/crm/contacts" className="text-sm text-accent-400 hover:text-accent-500">← Contacts</Link>
      <h1 className="mt-4 font-display text-4xl text-paper-100 md:text-5xl">Import leads</h1>
      <p className="mt-3 max-w-2xl text-paper-300">
        Paste CSV exported from Meta Lead Ads (or anywhere). The first row must be a
        header. Recognised columns: <code>name</code>, <code>phone</code>, <code>email</code>,
        {" "}<code>source</code>, <code>campaign</code>, <code>notes</code> — order doesn&apos;t matter,
        extras are ignored. A Meta/Facebook source is tagged automatically so ad ROI stays measurable.
      </p>

      {!configured && (
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-300">Preview mode — connect Supabase to import.</p>
        </Card>
      )}

      {sp.err && (
        <Card className="mt-6 border-accent-600/40 p-4">
          <p className="text-sm text-paper-100">
            {sp.err === "empty" ? "That looked empty — include a header row and at least one lead." : "No valid rows found — check the header names."}
          </p>
        </Card>
      )}

      <Card className="mt-6 p-5">
        <form action={importContactsCsv} className="grid gap-3">
          <label className="block">
            <span className="text-eyebrow">CSV</span>
            <textarea
              name="csv"
              rows={12}
              required
              className="input mt-1 font-mono text-xs"
              placeholder={"name,phone,email,source,campaign\nAisha Khan,+971501234567,aisha@email.com,Meta,Equity release Aug\nJohn Smith,+971559876543,,Meta,Handover villas"}
            />
          </label>
          <div><button className="btn-primary">Import</button></div>
        </form>
      </Card>

      <p className="mt-4 text-xs text-paper-700">
        Later, this becomes automatic: a Meta Lead Ads webhook can drop new leads straight
        into Contacts with no copy-paste. The data model is already built for it.
      </p>
    </div>
  );
}
