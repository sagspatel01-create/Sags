"use client";

import { useRef, useState, type WheelEvent, type PointerEvent } from "react";
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

// Amenity category → dot colour. 'navigation' uses the bronze accent.
const CATEGORY_COLOR: Record<string, string> = {
  navigation: "#c9a45c",
  school: "#8a94b5",
  park: "#7fa88a",
  beach: "#c9b98a",
  retail: "#c99a6a",
  clubhouse: "#b58ab5",
  mosque: "#7fa88a",
  hospital: "#c98a8a",
  walkway: "#8f8b80",
  cycling: "#8f8b80",
  "360": "#c9a45c",
};

function colorFor(cat: string): string {
  return CATEGORY_COLOR[cat] ?? "#8f8b80";
}

/**
 * Interactive master-plan viewer — a zoom/pan brochure image with clickable
 * hotspots. Navigation hotspots drill down (district/phase/plot → floor
 * plan); amenity hotspots (Modon-style) mark schools, parks, beaches, etc.
 * When no image is present it shows an elegant, clearly-empty state with an
 * optional uploader passed as children.
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
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const hasImage = Boolean(asset?.url);

  function clampScale(s: number) {
    return Math.min(6, Math.max(1, s));
  }

  function onWheel(e: WheelEvent) {
    if (!hasImage) return;
    e.preventDefault();
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const next = clampScale(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
    const ratio = next / scale;
    // Zoom around the cursor.
    setTx(cx - ratio * (cx - tx));
    setTy(cy - ratio * (cy - ty));
    setScale(next);
  }

  function onPointerDown(e: PointerEvent) {
    if (!hasImage) return;
    dragging.current = { x: e.clientX - tx, y: e.clientY - ty };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging.current) return;
    setTx(e.clientX - dragging.current.x);
    setTy(e.clientY - dragging.current.y);
  }
  function onPointerUp() {
    dragging.current = null;
  }

  function reset() {
    setScale(1);
    setTx(0);
    setTy(0);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-ink-500 bg-ink-850">
      <div
        ref={frameRef}
        className={`relative h-[520px] w-full touch-none select-none ${
          hasImage ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {hasImage ? (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset!.url!}
              alt={asset!.title ?? "Master plan"}
              className="block w-full max-w-none"
              draggable={false}
            />
            {hotspots.map((h) => (
              <Hotspot key={h.id} h={h} />
            ))}
          </div>
        ) : (
          <EmptyState kind={asset?.kind ?? "master_plan"} action={emptyAction} />
        )}
      </div>

      {hasImage && (
        <div className="absolute right-4 top-4 flex flex-col gap-1">
          <ZoomButton label="+" onClick={() => setScale((s) => clampScale(s * 1.2))} />
          <ZoomButton label="−" onClick={() => setScale((s) => clampScale(s / 1.2))} />
          <ZoomButton label="⤢" onClick={reset} />
        </div>
      )}

      {hasImage && hotspots.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-ink-500 bg-ink-900/70 px-3 py-1.5 text-[0.625rem] text-paper-500 backdrop-blur">
          Scroll to zoom · drag to pan · click a marker to drill in
        </div>
      )}
    </div>
  );
}

function Hotspot({ h }: { h: HotspotView }) {
  const color = colorFor(h.category);
  const dot = (
    <span
      className="group relative flex items-center justify-center"
      style={{ transform: "translate(-50%, -50%)" }}
    >
      <span
        className="block h-3 w-3 rounded-full ring-2 ring-ink-900"
        style={{ background: color, boxShadow: `0 0 10px 1px ${color}88` }}
      />
      {h.label && (
        <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded bg-ink-900/90 px-2 py-0.5 text-[10px] text-paper-200 opacity-0 transition-opacity group-hover:opacity-100">
          {h.label}
        </span>
      )}
    </span>
  );

  const style = { position: "absolute" as const, left: `${h.x}%`, top: `${h.y}%` };

  return h.href ? (
    <Link href={h.href} style={style} className="z-10">
      {dot}
    </Link>
  ) : (
    <span style={style} className="z-10">
      {dot}
    </span>
  );
}

function ZoomButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-8 w-8 rounded-md border border-ink-500 bg-ink-800/90 text-paper-300 backdrop-blur transition-colors hover:bg-ink-700 hover:text-paper-100"
    >
      {label}
    </button>
  );
}

function EmptyState({
  kind,
  action,
}: {
  kind: string;
  action?: React.ReactNode;
}) {
  const label = kind.replace("_", " ");
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ink-500 text-paper-700">
        ◲
      </div>
      <p className="text-eyebrow">No {label} yet</p>
      <p className="max-w-sm text-sm text-paper-500">
        Upload the developer&apos;s {label} to make it interactive — add
        hotspots for districts, phases and amenities that drill down to floor
        plans.
      </p>
      {action}
    </div>
  );
}
