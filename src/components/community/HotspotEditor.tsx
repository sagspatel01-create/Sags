"use client";

import { useRef, useState, useCallback, type PointerEvent } from "react";
import {
  createHotspot,
  updateHotspot,
  moveHotspot,
  deleteHotspot,
} from "@/app/actions/admin";

export interface EditorHotspot {
  id: string;
  label: string | null;
  category: string;
  x: number;
  y: number;
  target_type: string;
  target_sub_community_id: string | null;
  target_url: string | null;
}

interface SubRef {
  id: string;
  name: string;
}

// Amenity taxonomy (Modon-style layers) + the drill-down "navigation" type.
const CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: "navigation", label: "Navigation · drill-in", color: "#c9a45c" },
  { key: "school", label: "School", color: "#8a94b5" },
  { key: "park", label: "Park / green", color: "#7fa88a" },
  { key: "beach", label: "Beach / water", color: "#c9b98a" },
  { key: "retail", label: "Retail / F&B", color: "#c99a6a" },
  { key: "clubhouse", label: "Clubhouse", color: "#b58ab5" },
  { key: "mosque", label: "Mosque", color: "#7fa88a" },
  { key: "hospital", label: "Clinic / hospital", color: "#c98a8a" },
  { key: "walkway", label: "Walkway", color: "#8f8b80" },
  { key: "cycling", label: "Cycling track", color: "#8f8b80" },
  { key: "360", label: "360° view", color: "#c9a45c" },
];
const colorFor = (cat: string) =>
  CATEGORIES.find((c) => c.key === cat)?.color ?? "#8f8b80";

type Draft = { x: number; y: number };

/**
 * Hotspot editor — the authoring half of the interactive brochure. Click
 * anywhere on the plan to drop a marker, then set its type and drill-down
 * target in the inspector. Drag any marker to reposition (saved on drop).
 * Desktop-first: a wide canvas beside a fixed inspector rail.
 */
export function HotspotEditor({
  communitySlug,
  planAssetId,
  imageUrl,
  hotspots,
  subCommunities,
}: {
  communitySlug: string;
  planAssetId: string;
  imageUrl: string;
  hotspots: EditorHotspot[];
  subCommunities: SubRef[];
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

  const pctFromEvent = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }, []);

  function onCanvasClick(e: React.MouseEvent) {
    if (dragId.current) return;
    const p = pctFromEvent(e.clientX, e.clientY);
    setDraft(p);
    setSelectedId("__draft__");
  }

  function onMarkerDown(e: PointerEvent, id: string) {
    e.stopPropagation();
    dragId.current = id;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedId(id);
  }
  function onMarkerMove(e: PointerEvent) {
    if (!dragId.current) return;
    const p = pctFromEvent(e.clientX, e.clientY);
    setDragPos({ id: dragId.current, ...p });
  }
  async function onMarkerUp() {
    const id = dragId.current;
    dragId.current = null;
    if (id && dragPos && dragPos.id === id) {
      await moveHotspot(communitySlug, id, dragPos.x, dragPos.y);
    }
    setDragPos(null);
  }

  const selected =
    selectedId && selectedId !== "__draft__"
      ? hotspots.find((h) => h.id === selectedId) ?? null
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Canvas */}
      <div className="relative overflow-hidden rounded-xl border border-ink-500 bg-ink-850">
        <div
          ref={canvasRef}
          className="relative w-full cursor-crosshair select-none"
          onClick={onCanvasClick}
          onPointerMove={onMarkerMove}
          onPointerUp={onMarkerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Plan"
            className="block w-full max-w-none"
            draggable={false}
          />

          {hotspots.map((h) => {
            const live = dragPos && dragPos.id === h.id ? dragPos : h;
            return (
              <Marker
                key={h.id}
                x={live.x}
                y={live.y}
                color={colorFor(h.category)}
                label={h.label}
                active={selectedId === h.id}
                onPointerDown={(e) => onMarkerDown(e, h.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(h.id);
                  setDraft(null);
                }}
              />
            );
          })}

          {draft && (
            <Marker
              x={draft.x}
              y={draft.y}
              color="#c9a45c"
              label="New"
              active
              pulse
            />
          )}
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-ink-500 bg-ink-900/70 px-3 py-1.5 text-[0.625rem] text-paper-500 backdrop-blur">
          Click the plan to drop a marker · drag a marker to reposition
        </div>
      </div>

      {/* Inspector rail */}
      <div className="space-y-4">
        {selectedId === "__draft__" && draft ? (
          <HotspotForm
            key="draft"
            heading="New hotspot"
            communitySlug={communitySlug}
            planAssetId={planAssetId}
            x={draft.x}
            y={draft.y}
            subCommunities={subCommunities}
            onCancel={() => {
              setDraft(null);
              setSelectedId(null);
            }}
          />
        ) : selected ? (
          <HotspotForm
            key={selected.id}
            heading="Edit hotspot"
            communitySlug={communitySlug}
            planAssetId={planAssetId}
            hotspot={selected}
            x={selected.x}
            y={selected.y}
            subCommunities={subCommunities}
            onCancel={() => setSelectedId(null)}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-ink-500 bg-ink-800/40 p-6 text-sm text-paper-500">
            Select a marker to edit it, or click anywhere on the plan to add a
            new one.
          </div>
        )}

        {/* Placed markers list */}
        <div className="rounded-xl border border-ink-500 bg-ink-800/40 p-4">
          <p className="text-eyebrow">Placed markers · {hotspots.length}</p>
          {hotspots.length === 0 ? (
            <p className="mt-3 text-xs text-paper-700">None yet.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {hotspots.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => {
                      setSelectedId(h.id);
                      setDraft(null);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      selectedId === h.id
                        ? "bg-ink-700 text-paper-100"
                        : "text-paper-300 hover:bg-ink-700/60"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: colorFor(h.category) }}
                    />
                    <span className="truncate">
                      {h.label ?? <span className="text-paper-700">Unlabelled</span>}
                    </span>
                    <span className="ml-auto shrink-0 text-[0.625rem] uppercase tracking-wider text-paper-700">
                      {h.category === "navigation" ? "drill" : h.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Marker({
  x,
  y,
  color,
  label,
  active,
  pulse,
  onPointerDown,
  onClick,
}: {
  x: number;
  y: number;
  color: string;
  label: string | null;
  active?: boolean;
  pulse?: boolean;
  onPointerDown?: (e: PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className={`block h-3.5 w-3.5 rounded-full ring-2 ring-ink-900 transition-transform group-hover:scale-125 ${
          active ? "scale-125" : ""
        } ${pulse ? "animate-pulse" : ""}`}
        style={{ background: color, boxShadow: `0 0 12px 2px ${color}88` }}
      />
      {(label || active) && (
        <span
          className={`pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded bg-ink-900/90 px-2 py-0.5 text-[10px] text-paper-200 transition-opacity ${
            active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {label ?? "New"}
        </span>
      )}
    </span>
  );
}

function HotspotForm({
  heading,
  communitySlug,
  planAssetId,
  hotspot,
  x,
  y,
  subCommunities,
  onCancel,
}: {
  heading: string;
  communitySlug: string;
  planAssetId: string;
  hotspot?: EditorHotspot;
  x: number;
  y: number;
  subCommunities: SubRef[];
  onCancel: () => void;
}) {
  const [category, setCategory] = useState(hotspot?.category ?? "navigation");
  const isNav = category === "navigation";
  const action = hotspot
    ? updateHotspot.bind(null, communitySlug, hotspot.id)
    : createHotspot.bind(null, communitySlug);

  return (
    <div className="rounded-xl border border-ink-500 bg-ink-800/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-eyebrow">{heading}</p>
        <span className="font-mono text-[0.625rem] text-paper-700">
          {x.toFixed(1)}%, {y.toFixed(1)}%
        </span>
      </div>

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="plan_asset_id" value={planAssetId} />
        <input type="hidden" name="x" value={x} />
        <input type="hidden" name="y" value={y} />

        <label className="block">
          <span className="mb-1 block text-xs text-paper-500">Label</span>
          <input
            name="label"
            defaultValue={hotspot?.label ?? ""}
            placeholder="e.g. Sidra · 3–5BR villas"
            className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-paper-500">Type</span>
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {isNav ? (
          <label className="block">
            <span className="mb-1 block text-xs text-paper-500">
              Drills to sub-community
            </span>
            <select
              name="target_sub_community_id"
              defaultValue={hotspot?.target_sub_community_id ?? ""}
              className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500"
            >
              <option value="">— select —</option>
              {subCommunities.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs text-paper-500">
              Link (optional)
            </span>
            <input
              name="target_url"
              defaultValue={hotspot?.target_url ?? ""}
              placeholder="https://…"
              className="w-full rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-paper-100 outline-none focus:border-accent-500"
            />
          </label>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button type="submit" className="btn-primary text-xs">
            {hotspot ? "Save" : "Add hotspot"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-paper-500 hover:text-paper-200"
          >
            Cancel
          </button>
        </div>
      </form>

      {hotspot && (
        <form
          action={deleteHotspot.bind(null, communitySlug, hotspot.id)}
          className="mt-2 border-t border-ink-500/60 pt-2"
        >
          <button
            type="submit"
            className="text-xs text-red-400/80 hover:text-red-400"
          >
            Delete hotspot
          </button>
        </form>
      )}
    </div>
  );
}
