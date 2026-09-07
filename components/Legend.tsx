"use client";

import { CONSTELLATION_COLORS, CONSTELLATION_LABELS, type Constellation } from "@/lib/constellations";

interface LegendProps {
  counts: Record<Constellation, number>;
  hidden: Set<Constellation>;
  onToggle: (constellation: Constellation) => void;
}

const ORDER: Constellation[] = ["iss", "starlink", "gps", "weather", "other"];

export function Legend({ counts, hidden, onToggle }: LegendProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-black/50 px-3 py-3 backdrop-blur-md">
      {ORDER.map((c) => {
        const isHidden = hidden.has(c);
        return (
          <button
            key={c}
            onClick={() => onToggle(c)}
            className={`flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition ${
              isHidden ? "opacity-40" : "hover:bg-white/10"
            }`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CONSTELLATION_COLORS[c], boxShadow: `0 0 6px ${CONSTELLATION_COLORS[c]}` }}
            />
            <span className="flex-1 text-white/80">{CONSTELLATION_LABELS[c]}</span>
            <span className="font-mono text-white/40">{(counts[c] ?? 0).toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
