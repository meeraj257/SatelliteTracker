"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { propagateTle, type PropagatedPosition } from "@/lib/orbital";
import { latLonToVector3 } from "@/lib/geo";
import { CONSTELLATION_COLORS, type Constellation } from "@/lib/constellations";
import type { SatelliteRecord } from "@/lib/types";
import { EARTH_RADIUS } from "./Earth";

export const EARTH_RADIUS_KM = 6378.137;
export const KM_TO_UNITS = EARTH_RADIUS / EARTH_RADIUS_KM;

const RECOMPUTE_INTERVAL_SEC = 2;

const CONSTELLATION_RGB = Object.fromEntries(
  Object.entries(CONSTELLATION_COLORS).map(([k, hex]) => {
    const c = new THREE.Color(hex);
    return [k, [c.r, c.g, c.b]] as const;
  })
) as Record<Constellation, [number, number, number]>;

function makeGlowSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.75)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface SatellitesProps {
  satellites: SatelliteRecord[];
  selectedNoradId: number | null;
  onSelect: (satellite: SatelliteRecord, position: PropagatedPosition) => void;
  onSelectedPositionUpdate: (position: PropagatedPosition) => void;
}

export function Satellites({ satellites, selectedNoradId, onSelect, onSelectedPositionUpdate }: SatellitesProps) {
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const elapsedRef = useRef(0);
  const positionsCacheRef = useRef<Map<number, PropagatedPosition>>(new Map());
  const tmpVec = useRef(new THREE.Vector3());
  const spriteTexture = useMemo(() => makeGlowSprite(), []);

  const { positions, colors } = useMemo(() => {
    const n = satellites.length;
    return { positions: new Float32Array(n * 3), colors: new Float32Array(n * 3) };
  }, [satellites]);

  const recompute = () => {
    const now = new Date();
    const cache = positionsCacheRef.current;
    cache.clear();
    for (let i = 0; i < satellites.length; i++) {
      const sat = satellites[i];
      const pos = propagateTle(sat.tleLine1, sat.tleLine2, now);
      if (!pos) continue;
      cache.set(sat.noradId, pos);

      const radius = EARTH_RADIUS + pos.altitudeKm * KM_TO_UNITS;
      const v = latLonToVector3(pos.latitude, pos.longitude, radius, tmpVec.current);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;

      const [r, g, b] = CONSTELLATION_RGB[sat.constellation] ?? CONSTELLATION_RGB.other;
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    const geom = geometryRef.current;
    if (geom) {
      geom.attributes.position.needsUpdate = true;
      geom.attributes.color.needsUpdate = true;
      geom.computeBoundingSphere();
    }
    if (selectedNoradId != null) {
      const p = cache.get(selectedNoradId);
      if (p) onSelectedPositionUpdate(p);
    }
  };

  useEffect(() => {
    recompute();
    elapsedRef.current = 0;
    // recompute must re-run whenever the satellite list (filter) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellites]);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    if (elapsedRef.current >= RECOMPUTE_INTERVAL_SEC) {
      elapsedRef.current = 0;
      recompute();
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const index = event.index;
    if (index == null) return;
    const sat = satellites[index];
    if (!sat) return;
    const pos = positionsCacheRef.current.get(sat.noradId);
    if (pos) onSelect(sat, pos);
  };

  if (satellites.length === 0) return null;

  return (
    <points onClick={handleClick}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        map={spriteTexture}
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
