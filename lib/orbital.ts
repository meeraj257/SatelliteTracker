import * as satellite from "satellite.js";

const EARTH_RADIUS_KM = 6378.137;
const EARTH_MU_KM3_S2 = 398600.4418; // standard gravitational parameter

export interface PropagatedPosition {
  latitude: number; // degrees
  longitude: number; // degrees
  altitudeKm: number;
  velocityKmS: number;
}

export interface OrbitalParameters {
  periodMinutes: number;
  inclinationDeg: number;
  eccentricity: number;
  apogeeKm: number;
  perigeeKm: number;
  meanMotionRevPerDay: number;
}

/** Propagate a TLE to geodetic lat/lon/alt + speed at a given instant. */
export function propagateTle(
  tleLine1: string,
  tleLine2: string,
  date: Date
): PropagatedPosition | null {
  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  const pv = satellite.propagate(satrec, date);
  if (!pv || typeof pv.position === "boolean" || typeof pv.velocity === "boolean") {
    return null;
  }

  const gmst = satellite.gstime(date);
  const geo = satellite.eciToGeodetic(pv.position, gmst);
  const { velocity } = pv;
  const speedKmS = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);

  return {
    latitude: satellite.degreesLat(geo.latitude),
    longitude: satellite.degreesLong(geo.longitude),
    altitudeKm: geo.height,
    velocityKmS: speedKmS,
  };
}

/** Derive classic orbital parameters directly from the mean elements in a TLE. */
export function orbitalParametersFromTle(tleLine1: string, tleLine2: string): OrbitalParameters {
  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  const noRadPerMin = satrec.no; // mean motion, rad/min
  const periodMinutes = (2 * Math.PI) / noRadPerMin;
  const noRadPerSec = noRadPerMin / 60;
  const semiMajorAxisKm = Math.cbrt(EARTH_MU_KM3_S2 / noRadPerSec ** 2);
  const eccentricity = satrec.ecco;

  return {
    periodMinutes,
    inclinationDeg: satellite.radiansToDegrees(satrec.inclo),
    eccentricity,
    apogeeKm: semiMajorAxisKm * (1 + eccentricity) - EARTH_RADIUS_KM,
    perigeeKm: semiMajorAxisKm * (1 - eccentricity) - EARTH_RADIUS_KM,
    meanMotionRevPerDay: (1440 / periodMinutes),
  };
}
