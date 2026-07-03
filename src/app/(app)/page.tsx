import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";

const BUILD_ORDER = [
  { n: 1, title: "Custom-styled map", note: "All communities pinned, dark/editorial, click → detail panel." },
  { n: 2, title: "Community & sub-community pages", note: "Unit specs in the 5 categorized groups; phase price-journey." },
  { n: 3, title: "Client profile intake", note: "Session start; stored profile drives tailoring." },
  { n: 4, title: "Comparison engine", note: "2–4 communities side by side across all 14 category groups." },
  { n: 5, title: "Client-tailored copy", note: "Who-it's-for regenerates via Anthropic for the entered client." },
  { n: 6, title: "Filter framework", note: "Config-driven; new filters without re-architecting." },
  { n: 7, title: "Compare-view generation", note: "Anthropic writes a client-ready comparison." },
];

async function getCounts() {
  const supabase = await createClient();
  if (!supabase) return null;
  const [dev, com, sub] = await Promise.all([
    supabase.from("developers").select("*", { count: "exact", head: true }),
    supabase.from("communities").select("*", { count: "exact", head: true }),
    supabase.from("sub_communities").select("*", { count: "exact", head: true }),
  ]);
  return {
    developers: dev.count ?? 0,
    communities: com.count ?? 0,
    subCommunities: sub.count ?? 0,
  };
}

export default async function OverviewPage() {
  const configured = isSupabaseConfigured();
  const counts = configured ? await getCounts() : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <Eyebrow>The catalogue</Eyebrow>
      <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.1] text-paper-100 md:text-5xl">
        Working backwards from a client&apos;s budget to the right Dubai
        villa &amp; townhouse community.
      </h1>
      <p className="mt-5 max-w-2xl text-paper-300">
        A private, single-admin intelligence engine — an e-commerce store for
        communities. Breadth first, then airtight comparable depth, built to
        look immaculate on camera.
      </p>

      {/* Catalogue counts */}
      <div className="mt-10 grid grid-cols-3 gap-4">
        {[
          { label: "Developers", value: counts?.developers },
          { label: "Communities", value: counts?.communities },
          { label: "Sub-communities", value: counts?.subCommunities },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-eyebrow">{s.label}</p>
            <div className="mt-2 font-mono text-3xl text-paper-100">
              {s.value === undefined ? <Empty label="—" /> : s.value}
            </div>
          </Card>
        ))}
      </div>

      {!configured && <SetupNotice />}

      {/* Build order */}
      <div className="mt-14">
        <Eyebrow>Phase 1 build order</Eyebrow>
        <div className="mt-4 divide-y divide-ink-500 overflow-hidden rounded-xl border border-ink-500">
          {BUILD_ORDER.map((m) => (
            <div
              key={m.n}
              className="flex items-start gap-4 bg-ink-800/40 px-5 py-4"
            >
              <span className="mt-0.5 font-mono text-sm text-paper-700">
                {String(m.n).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <p className="text-paper-100">{m.title}</p>
                <p className="mt-0.5 text-sm text-paper-500">{m.note}</p>
              </div>
              <span className="mt-0.5 rounded-full border border-ink-500 px-2.5 py-1 text-[0.625rem] uppercase tracking-wider text-paper-700">
                Planned
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-paper-500">
          Foundation in place: project scaffold, database schema, and breadth
          seed. Milestones are built in order, each confirmed before the next.
        </p>
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <Card className="mt-8 p-6">
      <Eyebrow>Preview mode</Eyebrow>
      <p className="mt-2 text-paper-300">
        Running without Supabase credentials, so the catalogue is empty and
        auth is not enforced. To go live, set the environment variables in{" "}
        <code className="rounded bg-ink-700 px-1.5 py-0.5 text-sm text-paper-100">
          .env.local
        </code>{" "}
        (see <code className="text-sm">.env.local.example</code>), run the SQL
        in{" "}
        <code className="rounded bg-ink-700 px-1.5 py-0.5 text-sm text-paper-100">
          supabase/migrations
        </code>{" "}
        and <code className="text-sm">supabase/seed.sql</code>, then create the
        single admin user in Supabase Auth.
      </p>
    </Card>
  );
}
