import { getPool } from "@/lib/db";
import type { SatelliteRecord } from "@/lib/types";
import type { Constellation } from "@/lib/constellations";

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      norad_id: number;
      object_name: string;
      country: string | null;
      launch_date: string | null;
      constellation: Constellation;
      tle_line1: string;
      tle_line2: string;
    }>(
      `SELECT norad_id, object_name, country, launch_date, constellation, tle_line1, tle_line2
       FROM satellites
       ORDER BY norad_id`
    );

    const satellites: SatelliteRecord[] = rows.map((r) => ({
      noradId: r.norad_id,
      objectName: r.object_name,
      country: r.country,
      launchDate: r.launch_date,
      constellation: r.constellation,
      tleLine1: r.tle_line1,
      tleLine2: r.tle_line2,
    }));

    return Response.json(
      { satellites },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch (err) {
    console.error("GET /api/satellites failed:", err);
    return Response.json(
      { satellites: [], error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
