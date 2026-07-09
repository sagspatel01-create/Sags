import { isSupabaseConfigured } from "@/lib/env";
import { AskEngine } from "@/components/ask/AskEngine";
import { NotConfigured } from "@/components/community/NotConfigured";

export const dynamic = "force-dynamic";

export default function AskPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">Ask the engine</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        The Dubai villa &amp; townhouse notebook
      </h1>
      <p className="mt-4 text-paper-300">
        Ask anything about the communities, sub-communities, unit types, and
        transaction records held in the engine. Every answer is grounded in our
        own curated data first — and when a fact isn&apos;t held yet, the engine
        can pull it live from the web <span className="text-paper-100">with a
        citation</span>. Transaction prices always stay DLD-sourced; nothing is
        invented.
      </p>

      <div className="mt-8">
        <AskEngine />
      </div>
    </div>
  );
}
