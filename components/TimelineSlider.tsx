"use client";

import { useEffect, useRef } from "react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS_PER_SECOND = 3;

export function formatDecimalYear(value: number): string {
  const year = Math.floor(value);
  const month = Math.min(11, Math.max(0, Math.round((value - year) * 12)));
  return `${MONTH_NAMES[month]} ${year}`;
}

interface TimelineSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  visibleCount: number;
  totalCount: number;
}

export function TimelineSlider({
  min,
  max,
  value,
  onChange,
  playing,
  onTogglePlay,
  visibleCount,
  totalCount,
}: TimelineSliderProps) {
  const valueRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!playing) {
      lastTsRef.current = null;
      return;
    }
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const next = valueRef.current + dt * YEARS_PER_SECOND;
      if (next >= max) {
        onChange(max);
        onTogglePlay();
        return;
      }
      onChange(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, max]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md">
      <button
        onClick={onTogglePlay}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between text-xs text-white/60">
          <span>Launched on or before</span>
          <span className="font-mono text-white/90">{formatDecimalYear(value)}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1 / 12}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
        <div className="flex justify-between text-[10px] text-white/40">
          <span>{min}</span>
          <span>
            {visibleCount.toLocaleString()} / {totalCount.toLocaleString()} satellites
          </span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}
