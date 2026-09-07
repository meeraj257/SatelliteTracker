"use client";

import { useEffect, useState } from "react";
import type { SatelliteRecord } from "@/lib/types";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // TLEs are refreshed daily server-side; poll occasionally to pick up new/removed objects

export interface UseSatellitesResult {
  satellites: SatelliteRecord[];
  loading: boolean;
  error: string | null;
}

export function useSatellites(): UseSatellitesResult {
  const [satellites, setSatellites] = useState<SatelliteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/satellites");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? `Request failed: ${res.status}`);
        } else {
          setSatellites(data.satellites);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to fetch satellites");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { satellites, loading, error };
}
