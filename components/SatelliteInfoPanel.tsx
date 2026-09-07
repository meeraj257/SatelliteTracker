"use client";

import { useMemo } from "react";
import { orbitalParametersFromTle, type PropagatedPosition } from "@/lib/orbital";
import { CONSTELLATION_COLORS, CONSTELLATION_LABELS } from "@/lib/constellations";
import type { SatelliteRecord } from "@/lib/types";

interface SatelliteInfoPanelProps {
  satellite: SatelliteRecord;
  position: PropagatedPosition;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-white/40">{label}</span>
      <span className="font-mono text-sm text-white/90">{value}</span>
    </div>
  );
}

export function SatelliteInfoPanel({ satellite, position, onClose }: SatelliteInfoPanelProps) {
  const orbital = useMemo(
    () => orbitalParametersFromTle(satellite.tleLine1, satellite.tleLine2),
    [satellite]
  );

  return (
    <div className="w-72 rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: CONSTELLATION_COLORS[satellite.constellation],
                boxShadow: `0 0 6px ${CONSTELLATION_COLORS[satellite.constellation]}`,
              }}
            />
            <span className="text-[11px] uppercase tracking-wide text-white/50">
              {CONSTELLATION_LABELS[satellite.constellation]}
            </span>
          </div>
          <h2 className="mt-1 text-sm font-semibold leading-tight text-white">{satellite.objectName}</h2>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-white/10 pt-3">
        <Stat label="NORAD ID" value={String(satellite.noradId)} />
        <Stat label="Country" value={satellite.country ?? "—"} />
        <Stat label="Launch date" value={satellite.launchDate ?? "Unknown"} />
        <Stat label="Altitude" value={`${position.altitudeKm.toFixed(0)} km`} />
        <Stat label="Velocity" value={`${position.velocityKmS.toFixed(2)} km/s`} />
        <Stat label="Lat / Lon" value={`${position.latitude.toFixed(1)}°, ${position.longitude.toFixed(1)}°`} />
        <Stat label="Period" value={`${orbital.periodMinutes.toFixed(1)} min`} />
        <Stat label="Inclination" value={`${orbital.inclinationDeg.toFixed(1)}°`} />
        <Stat label="Apogee" value={`${orbital.apogeeKm.toFixed(0)} km`} />
        <Stat label="Perigee" value={`${orbital.perigeeKm.toFixed(0)} km`} />
        <Stat label="Eccentricity" value={orbital.eccentricity.toFixed(4)} />
        <Stat label="Rev/day" value={orbital.meanMotionRevPerDay.toFixed(2)} />
      </div>
    </div>
  );
}
