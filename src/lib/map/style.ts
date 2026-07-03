import type { StyleSpecification } from "maplibre-gl";

/**
 * Bespoke dark / editorial map style.
 *
 * Not a default basemap: this is a hand-tuned MapLibre style over the
 * OpenFreeMap planet vector tiles (OpenMapTiles schema) — free, no API key,
 * no billing. Colours are drawn from the app's ink/paper/bronze palette so
 * the map reads as part of the same coffee-table-book system. Deliberately
 * minimal: near-black land, a whisper of water and parkland, a restrained
 * road hierarchy, and elegant place labels only.
 *
 * The map provider is intentionally swappable (see components/map): this can
 * be replaced with a Google Maps vector Map ID later without touching the
 * markers/panel logic.
 */

const TILES = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

// Palette (kept in sync with globals.css).
const INK_900 = "#0a0a0b";
const WATER = "#0c121b";
const PARK = "#0f130f";
const BUILDING = "#131317";
const ROAD_MINOR = "#1b1b21";
const ROAD_MED = "#26262d";
const ROAD_MAJOR = "#34343d";
const BOUNDARY = "#2c2c34";
const LABEL = "#cfcabd";
const LABEL_STRONG = "#f4f1ea";
const LABEL_FAINT = "#8f8b80";

export function darkEditorialStyle(): StyleSpecification {
  return {
    version: 8,
    name: "Editorial Dark",
    glyphs: GLYPHS,
    sources: {
      openmaptiles: {
        type: "vector",
        url: TILES,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": INK_900 },
      },
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: { "fill-color": WATER },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "wood"],
        paint: { "fill-color": PARK, "fill-opacity": 0.5 },
      },
      {
        id: "park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        paint: { "fill-color": PARK, "fill-opacity": 0.6 },
      },
      {
        id: "building",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-color": BUILDING,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 16, 0.7],
        },
      },
      {
        id: "boundary-admin",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 4],
        paint: {
          "line-color": BOUNDARY,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 12, 1],
          "line-dasharray": [2, 2],
        },
      },
      // Road hierarchy — faint minor, brighter arterials.
      {
        id: "road-minor",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["minor", "service", "track"]],
        ],
        minzoom: 12,
        paint: {
          "line-color": ROAD_MINOR,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.3, 18, 3],
        },
      },
      {
        id: "road-secondary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["secondary", "tertiary"]],
        ],
        paint: {
          "line-color": ROAD_MED,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 18, 4],
        },
      },
      {
        id: "road-major",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["motorway", "trunk", "primary"]],
        ],
        paint: {
          "line-color": ROAD_MAJOR,
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 18, 6],
        },
      },
      // Labels — elegant, sparse.
      {
        id: "water-name",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "water_name",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Italic"],
          "text-size": 12,
          "text-letter-spacing": 0.1,
          "text-max-width": 6,
        },
        paint: {
          "text-color": LABEL_FAINT,
          "text-halo-color": INK_900,
          "text-halo-width": 1,
        },
      },
      {
        id: "place-suburb",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["suburb", "neighbourhood", "quarter"]],
        ],
        minzoom: 11,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-letter-spacing": 0.14,
          "text-transform": "uppercase",
          "text-max-width": 8,
        },
        paint: {
          "text-color": LABEL_FAINT,
          "text-halo-color": INK_900,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "place-city",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["city", "town", "village"]],
        ],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Medium"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 12, 12, 17],
          "text-letter-spacing": 0.08,
          "text-max-width": 8,
        },
        paint: {
          "text-color": LABEL,
          "text-halo-color": INK_900,
          "text-halo-width": 1.4,
        },
      },
      {
        id: "place-country",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["==", ["get", "class"], "country"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Medium"],
          "text-size": 14,
          "text-letter-spacing": 0.2,
          "text-transform": "uppercase",
        },
        paint: {
          "text-color": LABEL_STRONG,
          "text-halo-color": INK_900,
          "text-halo-width": 1.4,
        },
      },
    ],
  };
}
