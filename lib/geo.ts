import { Vector3 } from "three";

const DEG2RAD = Math.PI / 180;

/**
 * Converts geodetic lat/lon (degrees) to a Cartesian point on a sphere of the
 * given radius, using the convention three-globe / globe.gl uses for
 * equirectangular Earth textures mapped onto a THREE.SphereGeometry. Every
 * component that places something on or above the globe (Earth surface,
 * satellites, sun direction) must use this same convention or they'll
 * disagree about where a given lat/lon actually is.
 */
export function latLonToVector3(latDeg: number, lonDeg: number, radius: number, out = new Vector3()): Vector3 {
  const phi = (90 - latDeg) * DEG2RAD;
  const theta = (90 - lonDeg) * DEG2RAD;
  out.set(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
  return out;
}
