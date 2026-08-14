import type { ForecastMonth } from "@/lib/data/crm";
import { monthShort } from "@/lib/crm";
import { aed } from "@/lib/format";

/**
 * Month-by-month disbursement vs target. Each column stacks committed
 * (disbursed) money under probability-weighted open pipeline; a gold tick
 * marks that month's target. Pure SVG so it renders on the server and needs
 * no chart library.
 */
export function ForecastBars({ rows }: { rows: ForecastMonth[] }) {
  if (rows.length === 0) return null;

  const W = 720;
  const H = 300;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(
    ...rows.map((r) => Math.max(r.target, r.committed + r.weighted)),
    1,
  );
  const y = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const n = rows.length;
  const slot = plotW / n;
  const barW = Math.min(64, slot * 0.5);

  // Gridlines at 25/50/75/100% of max.
  const grids = [0.25, 0.5, 0.75, 1].map((f) => f * maxVal);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[560px]"
        role="img"
        aria-label="Disbursement forecast by month versus target"
      >
        {/* gridlines */}
        {grids.map((g, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(g)}
              y2={y(g)}
              stroke="var(--ink-600)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text x={padL} y={y(g) - 4} fontSize={10} fill="var(--paper-700)">
              {aed(g)}
            </text>
          </g>
        ))}

        {rows.map((r, i) => {
          const cx = padL + slot * i + slot / 2;
          const x = cx - barW / 2;
          const committedH = plotH - (y(r.committed) - padT);
          const weightedH = plotH - (y(r.weighted) - padT);
          const yCommitted = y(r.committed);
          const yWeighted = y(r.committed + r.weighted);
          const hit = r.committed + r.weighted >= r.target;
          return (
            <g key={r.month}>
              {/* weighted (on top) */}
              {r.weighted > 0 && (
                <rect
                  x={x}
                  y={yWeighted}
                  width={barW}
                  height={Math.max(0, weightedH)}
                  fill="var(--accent-400)"
                  opacity={0.4}
                  rx={2}
                />
              )}
              {/* committed (bottom, solid) */}
              {r.committed > 0 && (
                <rect
                  x={x}
                  y={yCommitted}
                  width={barW}
                  height={Math.max(0, committedH)}
                  fill="var(--accent-400)"
                  rx={2}
                />
              )}
              {/* target tick */}
              <line
                x1={x - 5}
                x2={x + barW + 5}
                y1={y(r.target)}
                y2={y(r.target)}
                stroke={hit ? "var(--accent-400)" : "var(--paper-500)"}
                strokeWidth={2}
              />
              {/* month label */}
              <text
                x={cx}
                y={H - padB + 18}
                fontSize={11}
                textAnchor="middle"
                fill="var(--paper-300)"
              >
                {monthShort(r.month)}
              </text>
              {/* total label */}
              <text
                x={cx}
                y={H - padB + 33}
                fontSize={10}
                textAnchor="middle"
                fill={hit ? "var(--accent-400)" : "var(--paper-700)"}
              >
                {aed(r.committed + r.weighted)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-paper-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--accent-400)" }} />
          Disbursed (committed)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--accent-400)", opacity: 0.4 }} />
          Weighted pipeline (open × probability)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: "var(--paper-500)" }} />
          Monthly target
        </span>
      </div>
    </div>
  );
}
