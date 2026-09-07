"use client";

import { Suspense, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Earth, Atmosphere } from "./Earth";
import { Satellites } from "./Satellites";
import { SelectedMarker } from "./SelectedMarker";
import type { SatelliteRecord } from "@/lib/types";
import type { PropagatedPosition } from "@/lib/orbital";

interface GlobeSceneProps {
  satellites: SatelliteRecord[];
  selectedNoradId: number | null;
  selectedPosition: PropagatedPosition | null;
  onSelect: (satellite: SatelliteRecord, position: PropagatedPosition) => void;
  onSelectedPositionUpdate: (position: PropagatedPosition) => void;
}

export function GlobeScene({
  satellites,
  selectedNoradId,
  selectedPosition,
  onSelect,
  onSelectedPositionUpdate,
}: GlobeSceneProps) {
  const [ready, setReady] = useState(false);

  const handleCreated = useCallback((state: { raycaster: { params: { Points?: { threshold: number } } } }) => {
    if (state.raycaster.params.Points) {
      state.raycaster.params.Points.threshold = 0.15;
    }
    setReady(true);
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 4, 16], fov: 45, near: 0.1, far: 300 }}
      onCreated={handleCreated}
      style={{ background: "#000308" }}
    >
      <ambientLight intensity={0.15} />
      <directionalLight position={[40, 10, 20]} intensity={1.1} />
      <Stars radius={200} depth={80} count={4000} factor={2} saturation={0} fade speed={0.4} />
      <Suspense fallback={null}>
        <Earth />
        <Atmosphere />
      </Suspense>
      {ready && (
        <Satellites
          satellites={satellites}
          selectedNoradId={selectedNoradId}
          onSelect={onSelect}
          onSelectedPositionUpdate={onSelectedPositionUpdate}
        />
      )}
      {selectedPosition && <SelectedMarker position={selectedPosition} />}
      <OrbitControls
        enablePan={false}
        minDistance={6.5}
        maxDistance={120}
        rotateSpeed={0.4}
        zoomSpeed={0.6}
      />
    </Canvas>
  );
}
