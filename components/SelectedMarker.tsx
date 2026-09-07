"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latLonToVector3 } from "@/lib/geo";
import { EARTH_RADIUS } from "./Earth";
import { KM_TO_UNITS } from "./Satellites";
import type { PropagatedPosition } from "@/lib/orbital";

interface SelectedMarkerProps {
  position: PropagatedPosition;
}

/** Pulsing ring around the currently-selected satellite so it stands out among thousands of dots. */
export function SelectedMarker({ position }: SelectedMarkerProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const radius = EARTH_RADIUS + position.altitudeKm * KM_TO_UNITS;
  const point = latLonToVector3(position.latitude, position.longitude, radius);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const pulse = 1 + 0.25 * Math.sin(clock.elapsedTime * 3);
    ringRef.current.scale.setScalar(pulse);
    ringRef.current.lookAt(0, 0, 0);
  });

  return (
    <mesh ref={ringRef} position={point}>
      <ringGeometry args={[0.16, 0.22, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}
