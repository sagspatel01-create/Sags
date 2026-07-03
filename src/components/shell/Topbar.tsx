import Link from "next/link";
import {
  isSupabaseConfigured,
  isMapsConfigured,
  isAnthropicConfigured,
} from "@/lib/env";
import { getActiveProfile } from "@/lib/client-profile.server";
import { BUYER_LABEL } from "@/lib/client-profile";
import { aed } from "@/lib/format";

function Pill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-500 px-2.5 py-1 text-[0.625rem] tracking-wide text-paper-500">
      <span
        className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-status-ready" : "bg-paper-700"}`}
      />
      {label}
    </span>
  );
}

/** Top bar — active client + integration status + sign out. */
export async function Topbar() {
  const supa = isSupabaseConfigured();
  const active = await getActiveProfile();
  return (
    <header className="flex items-center justify-between border-b border-ink-500 bg-ink-900/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {active ? (
          <Link
            href="/client"
            className="flex items-center gap-2 rounded-full border border-accent-600/60 bg-accent-500/10 px-3 py-1.5 text-xs transition-colors hover:bg-accent-500/20"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            <span className="text-paper-100">{active.session_label}</span>
            <span className="text-paper-500">
              {[
                active.budget ? aed(active.budget) : null,
                active.buyer_type ? BUYER_LABEL[active.buyer_type] : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </Link>
        ) : (
          <Link href="/client" className="text-eyebrow hover:text-paper-300">
            No active client · start session →
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Pill label="Supabase" ok={supa} />
        <Pill label="Maps" ok={isMapsConfigured()} />
        <Pill label="Anthropic" ok={isAnthropicConfigured()} />
        {supa && (
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="ml-2 rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-paper-300 transition-colors hover:bg-ink-700 hover:text-paper-100"
            >
              Sign out
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
