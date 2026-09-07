export type Constellation = "starlink" | "gps" | "weather" | "iss" | "other";

export const CONSTELLATION_COLORS: Record<Constellation, string> = {
  starlink: "#22e5ff", // cyan
  gps: "#ffd23f", // gold
  weather: "#3ddc84", // green
  iss: "#ff3b3b", // red
  other: "#9aa5b1", // neutral gray-blue for everything else
};

export const CONSTELLATION_LABELS: Record<Constellation, string> = {
  starlink: "Starlink",
  gps: "GPS",
  weather: "Weather",
  iss: "ISS",
  other: "Other",
};

// CelesTrak GP (general perturbations) group endpoints we ingest, mapped to
// our internal constellation buckets. Groups are pulled smallest/most
// specific first so they claim their norad_ids before the broad catch-alls
// (starlink, active) run. CelesTrak throttles each GROUP value to one
// download per ~2 hours per client and returns 403 with "data has not
// updated since your last successful download" on a repeat — scripts/fetch-tle.ts
// caches successful responses to disk and skips (rather than crashes on) a
// group that's still within its throttle window, so a rerun shortly after a
// partial failure doesn't lose already-fetched groups.
export const CELESTRAK_GROUPS: { group: string; constellation: Constellation }[] = [
  { group: "stations", constellation: "iss" },
  { group: "gps-ops", constellation: "gps" },
  { group: "weather", constellation: "weather" },
  { group: "oneweb", constellation: "other" },
  { group: "iridium-NEXT", constellation: "other" },
  { group: "planet", constellation: "other" },
  { group: "spire", constellation: "other" },
  { group: "globalstar", constellation: "other" },
  { group: "orbcomm", constellation: "other" },
  { group: "geo", constellation: "other" },
  { group: "intelsat", constellation: "other" },
  { group: "ses", constellation: "other" },
  { group: "galileo", constellation: "other" },
  { group: "beidou", constellation: "other" },
  { group: "sbas", constellation: "other" },
  { group: "cubesat", constellation: "other" },
  { group: "amateur", constellation: "other" },
  { group: "science", constellation: "other" },
  { group: "military", constellation: "other" },
  { group: "starlink", constellation: "starlink" },
  { group: "active", constellation: "other" },
];

// FORMAT=3le gives the raw TLE line pairs satellite.js needs (twoline2satrec);
// CelesTrak's FORMAT=json returns OMM fields instead, not TLE line strings.
export function celestrakGpUrl(group: string): string {
  return `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=3le`;
}

export const CELESTRAK_SATCAT_URL = "https://celestrak.org/pub/satcat.csv";
