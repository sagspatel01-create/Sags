interface Catalyst {
  title: string;
  category: string;
  timeline: string;
  note: string;
}

const CAT: Record<string, { label: string; color: string; icon: string }> = {
  road: { label: "Road / highway", color: "#c99a6a", icon: "⛢" },
  transport: { label: "Transport / metro", color: "#8a94b5", icon: "◉" },
  school: { label: "Education", color: "#7fa88a", icon: "✦" },
  retail: { label: "Retail / lifestyle", color: "#c9a45c", icon: "❖" },
  government: { label: "Government", color: "#b58ab5", icon: "◈" },
  development: { label: "New development", color: "#c9b98a", icon: "▲" },
  infrastructure: { label: "Infrastructure", color: "#8f8b80", icon: "▣" },
};
const meta = (c: string) => CAT[c] ?? CAT.infrastructure;

/**
 * Area Intelligence — the USP layer. The roads, transport, schools, retail
 * and government / master-plan projects in and around a community that drive
 * value, each with a timeline and an impact note. This is the "why behind the
 * price" that listing portals don't show.
 */
export function CatalystsPanel({ catalysts }: { catalysts: Catalyst[] }) {
  if (!catalysts || catalysts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-500 bg-ink-800/40 p-5 text-sm text-paper-500">
        No growth catalysts recorded yet. Add roads, transport, schools and
        government projects in Admin (or draft them with Claude) to show what&apos;s
        driving this area&apos;s value.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {catalysts.map((c, i) => {
        const m = meta(c.category);
        return (
          <div key={i} className="elevate rounded-xl border border-ink-500 bg-ink-800/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-xs" style={{ background: `${m.color}22`, color: m.color }}>
                  {m.icon}
                </span>
                <span className="text-[0.625rem] uppercase tracking-wider text-paper-500">{m.label}</span>
              </span>
              {c.timeline && (
                <span className="rounded-full border border-ink-500 px-2 py-0.5 text-[0.625rem] text-paper-400">{c.timeline}</span>
              )}
            </div>
            <p className="mt-2 font-display text-base leading-tight text-paper-100">{c.title}</p>
            {c.note && <p className="mt-1.5 text-sm leading-relaxed text-paper-400">{c.note}</p>}
          </div>
        );
      })}
    </div>
  );
}
