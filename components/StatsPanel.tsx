"use client";

import { CONSTELLATION_COLORS, CONSTELLATION_LABELS } from "@/lib/constellations";
import type { ConstellationStat } from "@/app/api/stats/route";

interface StatsPanelProps {
  stats: ConstellationStat[];
}

// Surfaces the constellation_hourly_stats continuous aggregate — the latest
// hourly bucket per constellation, computed server-side by TimescaleDB.
export function StatsPanel({ stats }: StatsPanelProps) {
  if (stats.length === 0) return null;

  return (
    <div className="w-72 rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-white/50">Orbital stats · last hour</div>
      <div className="flex flex-col gap-2">
        {stats.map((s) => (
          <div key={s.constellation} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: CONSTELLATION_COLORS[s.constellation] }}
            />
            <span className="w-16 shrink-0 text-white/70">{CONSTELLATION_LABELS[s.constellation]}</span>
            <span className="whitespace-nowrap font-mono text-white/50">
              {s.avgAltitudeKm.toFixed(0)} km avg · {s.avgVelocityKms.toFixed(1)} km/s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
