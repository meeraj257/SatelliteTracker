"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { subsolarPoint } from "@/lib/sunPosition";
import { latLonToVector3 } from "@/lib/geo";

export const EARTH_RADIUS = 5;

const DAY_MAP_URL = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const NIGHT_MAP_URL = "https://unpkg.com/three-globe/example/img/earth-night.jpg";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float intensity = dot(normalize(vNormal), normalize(sunDirection));
    float dayMix = smoothstep(-0.15, 0.15, intensity);

    vec3 dayColor = texture2D(dayTexture, vUv).rgb * (0.4 + 0.6 * clamp(intensity, 0.0, 1.0));
    vec3 nightColor = texture2D(nightTexture, vUv).rgb * 1.8;

    vec3 color = mix(nightColor, dayColor, dayMix);
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Static (non-rotating) globe: satellite ground-track lat/lon already accounts
 * for Earth's rotation via GMST, so the textured sphere must stay fixed for
 * satellite positions to land on the correct continents. */
export function Earth() {
  const [dayMap, nightMap] = useTexture([DAY_MAP_URL, NIGHT_MAP_URL]);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      dayTexture: { value: dayMap },
      nightTexture: { value: nightMap },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
    }),
    [dayMap, nightMap]
  );

  useFrame(() => {
    if (!materialRef.current) return;
    const { latitudeDeg, longitudeDeg } = subsolarPoint(new Date());
    latLonToVector3(latitudeDeg, longitudeDeg, 1, uniforms.sunDirection.value).normalize();
  });

  return (
    <mesh receiveShadow>
      <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float rim = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    gl_FragColor = vec4(0.3, 0.6, 1.0, clamp(rim, 0.0, 1.0)) ;
  }
`;

/** Thin Fresnel-glow shell around the globe, purely decorative. */
export function Atmosphere() {
  return (
    <mesh scale={1.06}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
