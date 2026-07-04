"use client";

import {
  useRef,
  useState,
  useMemo,
  type WheelEvent,
  type PointerEvent,
} from "react";
import Link from "next/link";

export interface HotspotView {
  id: string;
  label: string | null;
  category: string; // 'navigation' | amenity category
  x: number; // 0..100 (% of image)
  y: number; // 0..100
  href: string | null; // for navigation hotspots
}

export interface PlanAssetView {
  title: string | null;
  kind: string;
  url: string | null; // resolved (signed) image URL
  width: number | null;
  height: number | null;
}

// Amenity category → dot colour + label. 'navigation' uses the bronze accent.
const CATEGORY: Record<string, { color: string; label: string }> = {
  navigation: { color: "#c9a45c", label: "Districts" },
  school: { color: "#8a94b5", label: "Schools" },
  park: { color: "#7fa88a", label: "Parks" },
  beach: { color: "#c9b98a", label: "Beach / water" },
  retail: { color: "#c99a6a", label: "Retail" },
  clubhouse: { color: "#b58ab5", label: "Clubhouse" },
  mosque: { color: "#7fa88a", label: "Mosque" },
  hospital: { color: "#c98a8a", label: "Health" },
  walkway: { color: "#8f8b80", label: "Walkways" },
  cycling: { color: "#8f8b80", label: "Cycling" },
  "360": { color: "#c9a45c", label: "360° views" },
};
const meta = (cat: string) => CATEGORY[cat] ?? { color: "#8f8b80", label: cat };

/**
 * Modon-grade interactive master-plan viewer. A zoom/pan brochure image with
 * clickable hotspots, category layer toggles, a legend, a selection panel
 * that previews a district before you drill in, and fullscreen. Navigation
 * hotspots drill master plan → sub-community → floor plan; amenity hotspots
 * mark schools, parks, beaches, etc. Empty state shows an elegant uploader.
 */
export function MasterPlanViewer({
  asset,
  hotspots,
  emptyAction,
}: {
  asset: PlanAssetView | null;
  hotspots: HotspotView[];
  emptyAction?: React.ReactNode;
}) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [smooth, setSmooth] = useState(false);
  const [selected, setSelected] = useState<HotspotView | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const dragging = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const hasImage = Boolean(asset?.url);

  // Categories present, for the layer toggles + legend.
  const categories = useMemo(() => {
    const set = new Set(hotspots.map((h) => h.category));
    return [...set];
  }, [hotspots]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = hotspots.filter((h) => !hidden.has(h.category));

  function toggleCat(cat: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function clampScale(s: number) {
    return Math.min(6, Math.max(1, s));
  }
  function zoomTo(next: number, cx?: number, cy?: number) {
    const rect = frameRef.current?.getBoundingClientRect();
    const ox = cx ?? (rect ? rect.width / 2 : 0);
    const oy = cy ?? (rect ? rect.height / 2 : 0);
    const ratio = next / scale;
    setSmooth(true);
    setTx(ox - ratio * (ox - tx));
    setTy(oy - ratio * (oy - ty));
    setScale(next);
    window.setTimeout(() => setSmooth(false), 200);
  }

  function onWheel(e: WheelEvent) {
    if (!hasImage) return;
    e.preventDefault();
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomTo(clampScale(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)), e.clientX - rect.left, e.clientY - rect.top);
  }
  function onPointerDown(e: PointerEvent) {
    if (!hasImage) return;
    dragging.current = { x: e.clientX - tx, y: e.clientY - ty, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging.current) return;
    dragging.current.moved = true;
    setTx(e.clientX - dragging.current.x);
    setTy(e.clientY - dragging.current.y);
  }
  function onPointerUp() {
    dragging.current = null;
  }
  function reset() {
    setSmooth(true);
    setScale(1);
    setTx(0);
    setTy(0);
    window.setTimeout(() => setSmooth(false), 200);
  }

  const frameClass = fullscreen
    ? "fixed inset-0 z-50 bg-ink-900"
    : "relative overflow-hidden rounded-xl border border-ink-500 bg-ink-850";
  const frameHeight = fullscreen ? "h-screen" : "h-[560px]";

  return (
    <div className={frameClass}>
      <div
        ref={frameRef}
        className={`relative w-full touch-none select-none ${frameHeight} ${
          hasImage ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={() => {
          if (!dragging.current?.moved) setSelected(null);
        }}
      >
        {hasImage ? (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              transition: smooth ? "transform 0.2s ease-out" : "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset!.url!} alt={asset!.title ?? "Master plan"} className="block w-full max-w-none" draggable={false} />
            {visible.map((h) => (
              <Hotspot
                key={h.id}
                h={h}
                active={selected?.id === h.id}
                onSelect={(e) => {
                  e.stopPropagation();
                  if (!dragging.current?.moved) setSelected(h);
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState kind={asset?.kind ?? "master_plan"} action={emptyAction} />
        )}
      </div>

      {/* Layer toggles */}
      {hasImage && categories.length > 0 && (
        <div className="pointer-events-auto absolute left-4 top-4 flex max-w-[70%] flex-wrap gap-1.5">
          {categories.map((cat) => {
            const m = meta(cat);
            const on = !hidden.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCat(cat)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] backdrop-blur transition-colors ${
                  on ? "border-ink-500 bg-ink-900/70 text-paper-200" : "border-ink-600 bg-ink-900/40 text-paper-700"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: on ? m.color : "#4b4b52" }} />
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Controls */}
      {hasImage && (
        <div className="absolute right-4 top-4 flex flex-col gap-1">
          <Ctl label="+" onClick={() => zoomTo(clampScale(scale * 1.25))} />
          <Ctl label="−" onClick={() => zoomTo(clampScale(scale / 1.25))} />
          <Ctl label="⤢" onClick={reset} />
          <Ctl label={fullscreen ? "×" : "⤡"} onClick={() => setFullscreen((v) => !v)} />
        </div>
      )}

      {/* Selection panel */}
      {hasImage && selected && (
        <div className="absolute bottom-4 left-4 w-72 rounded-xl border border-ink-500 bg-ink-900/90 p-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta(selected.category).color }} />
            <span className="text-[0.625rem] uppercase tracking-wider text-paper-500">{meta(selected.category).label}</span>
          </div>
          <p className="mt-1.5 font-display text-lg text-paper-100">{selected.label ?? "Untitled"}</p>
          {selected.href ? (
            <Link href={selected.href} className="btn-primary mt-3 inline-block text-xs">
              Enter →
            </Link>
          ) : (
            <p className="mt-2 text-xs text-paper-500">Amenity marker.</p>
          )}
        </div>
      )}

      {/* Hint */}
      {hasImage && !selected && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-ink-500 bg-ink-900/70 px-3 py-1.5 text-[0.625rem] text-paper-500 backdrop-blur">
          Scroll to zoom · drag to pan · click a marker to preview
        </div>
      )}
    </div>
  );
}

function Hotspot({
  h,
  active,
  onSelect,
}: {
  h: HotspotView;
  active: boolean;
  onSelect: (e: React.MouseEvent) => void;
}) {
  const color = meta(h.category).color;
  return (
    <button
      onClick={onSelect}
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${h.x}%`, top: `${h.y}%` }}
    >
      <span
        className={`block h-3 w-3 rounded-full ring-2 ring-ink-900 transition-transform group-hover:scale-125 ${active ? "scale-150" : ""}`}
        style={{ background: color, boxShadow: `0 0 ${active ? 16 : 10}px ${active ? 3 : 1}px ${color}${active ? "aa" : "88"}` }}
      />
      {h.label && (
        <span
          className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded bg-ink-900/90 px-2 py-0.5 text-[10px] text-paper-200 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          {h.label}
        </span>
      )}
    </button>
  );
}

function Ctl({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-500 bg-ink-800/90 text-paper-300 backdrop-blur transition-colors hover:bg-ink-700 hover:text-paper-100"
    >
      {label}
    </button>
  );
}

function EmptyState({ kind, action }: { kind: string; action?: React.ReactNode }) {
  const label = kind.replace("_", " ");
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ink-500 text-paper-700">◲</div>
      <p className="text-eyebrow">No {label} yet</p>
      <p className="max-w-sm text-sm text-paper-500">
        Upload the developer&apos;s {label} to make it interactive — add hotspots
        for districts, phases and amenities that drill down to floor plans.
      </p>
      {action}
    </div>
  );
}
