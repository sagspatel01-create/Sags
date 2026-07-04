import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getActiveProfile } from "@/lib/client-profile.server";
import { getCommunities } from "@/lib/data/communities";
import { getCommunityPricing } from "@/lib/data/pricing";
import { clearProfile } from "./actions";
import { IntakeForm } from "@/components/client/IntakeForm";
import { PropertySearch } from "@/components/search/PropertySearch";
import { Card, Eyebrow } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  PRIORITIES,
  BUYER_LABEL,
  FINANCING_LABEL,
  tiersForBudget,
} from "@/lib/client-profile";
import { TIER_LABEL, aed } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const active = await getActiveProfile();
  const configured = isSupabaseConfigured();
  const communities = configured ? await getCommunities() : [];

  const inReachTiers = active ? tiersForBudget(active.budget) : [];
  const pricing = configured ? await getCommunityPricing() : new Map();
  const budget = active?.budget ?? null;
  const matches = communities
    .filter(
      (c) => c.positioning_tier && inReachTiers.includes(c.positioning_tier),
    )
    .map((c) => {
      const p = pricing.get(c.id);
      const inBudget = Boolean(p && budget && p.from <= budget);
      return { c, p, inBudget };
    })
    // Concrete in-budget matches first, then priced, then the rest.
    .sort((a, b) => {
      if (a.inBudget !== b.inBudget) return a.inBudget ? -1 : 1;
      if (Boolean(a.p) !== Boolean(b.p)) return a.p ? -1 : 1;
      return a.c.name.localeCompare(b.c.name);
    });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <p className="text-eyebrow">Session start</p>
      <h1 className="mt-2 font-display text-4xl text-paper-100 md:text-5xl">
        Client profile
      </h1>
      <p className="mt-4 max-w-2xl text-paper-300">
        Enter the client at the start of the call, then find the exact homes
        that fit their brief — searched across every priced villa and townhouse
        in the engine, the way you&apos;d search Bayut or Property Finder.
      </p>

      {/* Requirement-based property search */}
      <div className="mt-8">
        <p className="text-eyebrow">Find matching homes</p>
        <h2 className="mt-1 font-display text-2xl text-paper-100">
          Search the client&apos;s brief
        </h2>
        <div className="mt-4">
          <PropertySearch defaultBudget={active?.budget ?? null} />
        </div>
      </div>

      {active && (
        <div className="mt-8 space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Eyebrow>Active session</Eyebrow>
                <h2 className="mt-1 font-display text-2xl text-paper-100">
                  {active.session_label}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {active.budget && (
                    <span className="rounded-full border border-ink-500 px-3 py-1 font-mono text-paper-100">
                      {aed(active.budget)}
                    </span>
                  )}
                  {active.buyer_type && (
                    <span className="rounded-full border border-ink-500 px-3 py-1 text-paper-300">
                      {BUYER_LABEL[active.buyer_type]}
                    </span>
                  )}
                  {active.financing_approach && (
                    <span className="rounded-full border border-ink-500 px-3 py-1 text-paper-300">
                      {FINANCING_LABEL[active.financing_approach]}
                    </span>
                  )}
                </div>
              </div>
              <form action={clearProfile}>
                <button className="rounded-lg border border-ink-500 px-4 py-2 text-sm text-paper-300 transition-colors hover:bg-ink-700 hover:text-paper-100">
                  Clear session
                </button>
              </form>
            </div>

            {active.goals && (
              <p className="mt-5 max-w-2xl border-l-2 border-accent-600 pl-4 text-sm italic leading-relaxed text-paper-300">
                {active.goals}
              </p>
            )}

            {/* Priority weighting bars */}
            <div className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {PRIORITIES.map((p) => (
                <div key={p.key} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-xs text-paper-500">
                    {p.label}
                  </span>
                  <span className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-4 rounded-full ${
                          i < active.priorities[p.key]
                            ? "bg-accent-500"
                            : "bg-ink-600"
                        }`}
                      />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Achievable shortlist */}
          <Card className="p-6">
            <Eyebrow>Working backwards from budget</Eyebrow>
            <h3 className="mt-1 font-display text-xl text-paper-100">
              Achievable communities
            </h3>
            <p className="mt-1 text-sm text-paper-500">
              Fit by positioning tier
              {active.budget ? ` for ${aed(active.budget)}` : ""} — communities
              with real entry pricing show “from” and rank first; the rest are
              tier-band guides, not price guarantees.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {inReachTiers.length === 0 ? (
                <span className="text-sm text-paper-700">
                  Enter a budget to see the achievable tier bands.
                </span>
              ) : (
                inReachTiers.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-accent-600/60 bg-accent-500/10 px-3 py-1 text-xs text-accent-400"
                  >
                    {TIER_LABEL[t]}
                  </span>
                ))
              )}
            </div>

            {!configured ? (
              <p className="mt-5 text-sm text-paper-700">
                Connect Supabase to list the matching communities live.
              </p>
            ) : matches.length === 0 ? (
              <p className="mt-5 text-sm text-paper-700">
                No seeded communities fall in these tiers yet.
              </p>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matches.slice(0, 12).map(({ c, p, inBudget }) => (
                  <Link
                    key={c.id}
                    href={`/communities/${c.slug}`}
                    className={`group rounded-xl border bg-ink-800/50 p-4 transition-colors hover:bg-ink-700 ${
                      inBudget
                        ? "border-accent-500/50"
                        : "border-ink-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-base leading-tight text-paper-100 group-hover:text-white">
                        {c.name}
                      </p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="mt-2 text-xs text-paper-500">
                      {c.developer?.name ?? "—"} ·{" "}
                      {c.positioning_tier ? TIER_LABEL[c.positioning_tier] : "—"}
                    </p>
                    {p ? (
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-600 pt-2.5">
                        <span className="tnum text-sm text-paper-100">
                          from {aed(p.from)}
                          {p.beds.length > 0 && (
                            <span className="text-paper-500">
                              {" "}· {p.beds[0]}
                              {p.beds.length > 1 ? `–${p.beds[p.beds.length - 1]}` : ""}BR
                            </span>
                          )}
                        </span>
                        {inBudget && (
                          <span className="shrink-0 rounded-full border border-accent-500/50 bg-accent-500/10 px-2 py-0.5 text-[0.5625rem] uppercase tracking-wider text-accent-400">
                            In budget
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 border-t border-ink-600 pt-2.5 text-xs text-paper-700">
                        Pricing on request
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Intake form */}
      <div className="mt-10">
        <div className="mb-6 flex items-baseline justify-between border-b border-ink-500 pb-3">
          <h2 className="font-display text-xl text-paper-100">
            {active ? "Start a new session" : "New session"}
          </h2>
        </div>
        <IntakeForm />
      </div>
    </div>
  );
}
