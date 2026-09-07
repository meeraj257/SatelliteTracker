const RAD2DEG = 180 / Math.PI;

export interface SubsolarPoint {
  latitudeDeg: number;
  longitudeDeg: number;
}

/**
 * Approximate subsolar point (the lat/lon directly beneath the sun) for a
 * given instant, via the NOAA solar position formulas. Accurate to a
 * fraction of a degree — plenty for driving a day/night terminator shader,
 * not intended for precision ephemeris work.
 */
export function subsolarPoint(date: Date): SubsolarPoint {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcHours - 12) / 24);

  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const longitudeDeg = -15 * (utcHours - 12) - eqTimeMin / 4;
  const normalizedLon = ((longitudeDeg + 180) % 360 + 360) % 360 - 180;

  return {
    latitudeDeg: declRad * RAD2DEG,
    longitudeDeg: normalizedLon,
  };
}
