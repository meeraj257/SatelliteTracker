"use client";

import { useEffect, useMemo, useState } from "react";
import { GlobeScene } from "@/components/GlobeScene";
import { TimelineSlider } from "@/components/TimelineSlider";
import { Legend } from "@/components/Legend";
import { SatelliteInfoPanel } from "@/components/SatelliteInfoPanel";
import { StatsPanel } from "@/components/StatsPanel";
import { useSatellites } from "@/hooks/useSatellites";
import { useStats } from "@/hooks/useStats";
import type { Constellation } from "@/lib/constellations";
import type { SatelliteRecord } from "@/lib/types";
import type { PropagatedPosition } from "@/lib/orbital";

const TIMELINE_MIN = 2000;
const TIMELINE_MAX = 2026;

function launchDecimalYear(launchDate: string | null): number | null {
  if (!launchDate) return null;
  const d = new Date(launchDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear() + d.getUTCMonth() / 12;
}

export default function Home() {
  const { satellites, loading, error } = useSatellites();
  const stats = useStats();

  const [sliderValue, setSliderValue] = useState(TIMELINE_MAX);
  const [playing, setPlaying] = useState(false);
  const [hidden, setHidden] = useState<Set<Constellation>>(new Set());
  const [statsOpen, setStatsOpen] = useState(false);
  const [selected, setSelected] = useState<{ satellite: SatelliteRecord; position: PropagatedPosition } | null>(
    null
  );

  const timeFiltered = useMemo(() => {
    return satellites.filter((sat) => {
      const year = launchDecimalYear(sat.launchDate);
      return year == null || year <= sliderValue;
    });
  }, [satellites, sliderValue]);

  const counts = useMemo(() => {
    const c: Record<Constellation, number> = { starlink: 0, gps: 0, weather: 0, iss: 0, other: 0 };
    for (const sat of timeFiltered) c[sat.constellation]++;
    return c;
  }, [timeFiltered]);

  const visible = useMemo(
    () => timeFiltered.filter((sat) => !hidden.has(sat.constellation)),
    [timeFiltered, hidden]
  );

  useEffect(() => {
    if (selected && !visible.some((s) => s.noradId === selected.satellite.noradId)) {
      setSelected(null);
    }
  }, [visible, selected]);

  const toggleConstellation = (c: Constellation) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <GlobeScene
        satellites={visible}
        selectedNoradId={selected?.satellite.noradId ?? null}
        selectedPosition={selected?.position ?? null}
        onSelect={(satellite, position) => setSelected({ satellite, position })}
        onSelectedPositionUpdate={(position) =>
          setSelected((prev) => (prev ? { satellite: prev.satellite, position } : prev))
        }
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 backdrop-blur-md">
            <h1 className="text-sm font-semibold tracking-wide text-white">Satellite Tracker</h1>
            <p className="text-[11px] text-white/40">Real-time orbital positions · CelesTrak + satellite.js</p>
          </div>

          <div className="flex items-start gap-3">
            {selected && (
              <div className="pointer-events-auto">
                <SatelliteInfoPanel
                  satellite={selected.satellite}
                  position={selected.position}
                  onClose={() => setSelected(null)}
                />
              </div>
            )}
            <div className="pointer-events-auto flex flex-col items-end gap-3">
              <button
                onClick={() => setStatsOpen((v) => !v)}
                className="rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md transition hover:bg-white/10"
              >
                {statsOpen ? "Hide stats" : "Stats"}
              </button>
              {statsOpen && <StatsPanel stats={stats} />}
              <Legend counts={counts} hidden={hidden} onToggle={toggleConstellation} />
            </div>
          </div>
        </div>

        <div className="pointer-events-auto mx-auto w-full max-w-2xl">
          {loading && (
            <div className="mb-3 rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-center text-xs text-white/60 backdrop-blur-md">
              Loading satellites…
            </div>
          )}
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-950/50 px-4 py-2 text-center text-xs text-red-200 backdrop-blur-md">
              Couldn&apos;t load satellite data: {error}
            </div>
          )}
          <TimelineSlider
            min={TIMELINE_MIN}
            max={TIMELINE_MAX}
            value={sliderValue}
            onChange={setSliderValue}
            playing={playing}
            onTogglePlay={() => setPlaying((v) => !v)}
            visibleCount={visible.length}
            totalCount={satellites.length}
          />
        </div>
      </div>
    </div>
  );
}
