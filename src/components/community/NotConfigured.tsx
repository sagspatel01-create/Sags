import { Card, Eyebrow } from "@/components/ui/Card";

/** Shown on data-backed pages when Supabase is not yet configured. */
export function NotConfigured() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <Card className="p-8 text-center">
        <Eyebrow>Preview mode</Eyebrow>
        <p className="mt-3 text-paper-300">
          This page reads live data from Supabase. Add your project keys to{" "}
          <code className="rounded bg-ink-700 px-1.5 py-0.5 text-sm text-paper-100">
            .env.local
          </code>
          , run the migrations + seed, then reload to see the catalogue.
        </p>
      </Card>
    </div>
  );
}
