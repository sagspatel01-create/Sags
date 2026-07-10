import { isSupabaseConfigured } from "@/lib/env";
import { AskEngine } from "@/components/ask/AskEngine";
import { NotConfigured } from "@/components/community/NotConfigured";
import { HowItWorks } from "@/components/ui/HowItWorks";

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
        A notebook over everything the engine holds — communities,
        sub-communities, unit types and transaction records. Ask, then keep
        asking: follow-ups stay grounded in the same community, and each answer
        surfaces the communities it drew on plus suggested next questions.
        Grounded in our curated data first, with a{" "}
        <span className="text-paper-100">cited</span> live-web fallback for gaps.
        Prices stay DLD-sourced; nothing is invented.
      </p>

      <HowItWorks
        title="How the notebook works"
        items={[
          {
            q: "Where do answers come from?",
            a: "First from the engine's own curated dossiers (communities, unit configs, DLD transaction records). If a fact isn't held — a school rating, a new metro line, a fresh off-plan launch — it may fetch it live from the web and shows the citation. It will say “not yet in the engine” rather than guess.",
          },
          {
            q: "What can't it do?",
            a: "It won't state a sale price, median or appreciation from the web — those come only from DLD-registered data. And it won't invent unit counts, sizes or names.",
          },
          {
            q: "Follow-ups & suggestions",
            a: "It remembers the conversation, so “what about the 4-bedroom?” stays anchored to the community you were discussing. After each answer it proposes a few next questions — click one to continue.",
          },
        ]}
      />

      <div className="mt-8">
        <AskEngine />
      </div>
    </div>
  );
}
