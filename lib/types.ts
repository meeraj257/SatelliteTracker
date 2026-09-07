import type { Constellation } from "./constellations";

export interface SatelliteRecord {
  noradId: number;
  objectName: string;
  country: string | null;
  launchDate: string | null; // ISO date, e.g. "2019-05-24"
  constellation: Constellation;
  tleLine1: string;
  tleLine2: string;
}
