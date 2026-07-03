import {
  isSupabaseConfigured,
  isMapsConfigured,
  isAnthropicConfigured,
} from "@/lib/env";

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

/** Top bar — phase label + integration status + sign out. */
export function Topbar() {
  const supa = isSupabaseConfigured();
  return (
    <header className="flex items-center justify-between border-b border-ink-500 bg-ink-900/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="text-eyebrow">Phase 1 · Breadth &amp; comparison shell</span>
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
