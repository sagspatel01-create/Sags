const ITEMS: { label: string; hex: string }[] = [
  { label: "Ready", hex: "#7fa88a" },
  { label: "Offplan", hex: "#c9a45c" },
  { label: "Mixed", hex: "#8a94b5" },
];

/** Small status-colour key, bottom-left. */
export function MapLegend() {
  return (
    <div className="absolute bottom-6 left-6 z-10 flex items-center gap-4 rounded-full border border-ink-500 bg-ink-900/70 px-4 py-2 backdrop-blur">
      {ITEMS.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[0.6875rem] text-paper-300">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: i.hex }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
