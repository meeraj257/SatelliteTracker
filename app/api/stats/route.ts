import { getPool } from "@/lib/db";
import type { Constellation } from "@/lib/constellations";

export interface ConstellationStat {
  constellation: Constellation;
  bucket: string;
  satelliteCount: number;
  avgAltitudeKm: number;
  minAltitudeKm: number;
  maxAltitudeKm: number;
  avgVelocityKms: number;
}

// Latest hourly bucket per constellation from the constellation_hourly_stats
// continuous aggregate.
export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      constellation: Constellation;
      bucket: string;
      satellite_count: string;
      avg_altitude_km: number;
      min_altitude_km: number;
      max_altitude_km: number;
      avg_velocity_kms: number;
    }>(
      `SELECT DISTINCT ON (constellation)
         constellation, bucket, satellite_count, avg_altitude_km, min_altitude_km, max_altitude_km, avg_velocity_kms
       FROM constellation_hourly_stats
       ORDER BY constellation, bucket DESC`
    );

    const stats: ConstellationStat[] = rows.map((r) => ({
      constellation: r.constellation,
      bucket: r.bucket,
      satelliteCount: Number(r.satellite_count),
      avgAltitudeKm: r.avg_altitude_km,
      minAltitudeKm: r.min_altitude_km,
      maxAltitudeKm: r.max_altitude_km,
      avgVelocityKms: r.avg_velocity_kms,
    }));

    return Response.json(
      { stats },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=900" } }
    );
  } catch (err) {
    console.error("GET /api/stats failed:", err);
    return Response.json(
      { stats: [], error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
