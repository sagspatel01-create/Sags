"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { darkEditorialStyle } from "@/lib/map/style";
import {
  type CommunityPin,
  DUBAI_CENTER,
  DUBAI_ZOOM,
} from "@/lib/map/types";
import { CommunityPanel } from "./CommunityPanel";
import { MapLegend } from "./MapLegend";

const STATUS_HEX: Record<CommunityPin["status"], string> = {
  ready: "#7fa88a",
  offplan: "#c9a45c",
  mixed: "#8a94b5",
};

export function MapView({ pins }: { pins: CommunityPin[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerEls = useRef<Map<string, HTMLElement>>(new Map());
  const [selected, setSelected] = useState<CommunityPin | null>(null);
  const selectedId = selected?.id ?? null;

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const markers = markerEls.current;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: darkEditorialStyle(),
      center: DUBAI_CENTER,
      zoom: DUBAI_ZOOM,
      attributionControl: { compact: true },
      dragRotate: false,
      maxZoom: 17,
      minZoom: 8,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;

    for (const pin of pins) {
      const el = document.createElement("div");
      el.className = "map-pin";
      el.innerHTML = `
        <div class="map-pin-dot" style="background:${STATUS_HEX[pin.status]};color:${STATUS_HEX[pin.status]}"></div>
        <div class="map-pin-label">${escapeHtml(pin.name)}</div>
      `;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(pin);
        map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 12), speed: 0.8 });
      });
      markers.set(pin.id, el);
      new maplibregl.Marker({ element: el, anchor: "top" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
    }

    // Click empty map → deselect.
    map.on("click", () => setSelected(null));

    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [pins]);

  // Reflect selection on marker elements.
  useEffect(() => {
    markerEls.current.forEach((el, id) => {
      el.dataset.selected = id === selectedId ? "true" : "false";
    });
  }, [selectedId]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Editorial title overlay */}
      <div className="pointer-events-none absolute left-6 top-6 z-10">
        <p className="text-eyebrow">The map</p>
        <h1 className="mt-1 font-display text-2xl text-paper-100">
          Dubai villa &amp; townhouse communities
        </h1>
      </div>

      <MapLegend />

      {pins.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="pointer-events-auto max-w-sm rounded-xl border border-ink-500 bg-ink-800/80 p-6 text-center backdrop-blur">
            <p className="text-eyebrow">No communities loaded</p>
            <p className="mt-2 text-sm text-paper-300">
              Connect Supabase and run the migrations + seed to plot the
              catalogue. The bespoke basemap is live; markers appear once data
              is present.
            </p>
          </div>
        </div>
      )}

      {selected && (
        <CommunityPanel pin={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
