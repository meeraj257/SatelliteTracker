"use client";

import { useEffect, useState } from "react";
import type { ConstellationStat } from "@/app/api/stats/route";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function useStats(): ConstellationStat[] {
  const [stats, setStats] = useState<ConstellationStat[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        if (!cancelled && res.ok) setStats(data.stats);
      } catch {
        // continuous aggregate stats are a bonus panel; fail silently
      }
    }
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return stats;
}
