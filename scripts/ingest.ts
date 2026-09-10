/**
 * Long-running worker with two independent cron jobs:
 *  - every 5 minutes: propagates every tracked satellite's TLE to the
 *    current instant and writes a snapshot row into the
 *    `satellite_positions` hypertable.
 *  - once a day: refreshes the `satellites` catalog from CelesTrak (new
 *    launches, updated TLEs) via fetch-tle.ts's fetchAndUpsertSatellites.
 *    Only runs on the daily cron tick, not at worker startup — CelesTrak
 *    rate-limits repeated catalog fetches, so a worker that gets restarted
 *    often (e.g. during development) shouldn't hit it every time it boots.
 *
 * Usage: npx tsx scripts/ingest.ts        (runs forever, both jobs on cron)
 *        npx tsx scripts/ingest.ts --once (single position snapshot only, useful for testing)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import cron from "node-cron";
import { getPool } from "../lib/db";
import { propagateTle } from "../lib/orbital";
import { fetchAndUpsertSatellites } from "./fetch-tle";

const BATCH_SIZE = 500;

async function runSnapshot() {
  const pool = getPool();
  const start = Date.now();
  const { rows: satellites } = await pool.query<{
    norad_id: number;
    object_name: string;
    country: string | null;
    launch_date: string | null;
    constellation: string;
    tle_line1: string;
    tle_line2: string;
  }>(`SELECT norad_id, object_name, country, launch_date, constellation, tle_line1, tle_line2 FROM satellites`);

  console.log(`[${new Date().toISOString()}] Snapshotting ${satellites.length} satellites...`);

  const now = new Date();
  type Row = [Date, number, string, string | null, string | null, string, number, number, number, number];
  const values: Row[] = [];
  let failed = 0;

  for (const sat of satellites) {
    const pos = propagateTle(sat.tle_line1, sat.tle_line2, now);
    if (!pos) {
      failed++;
      continue;
    }
    values.push([
      now,
      sat.norad_id,
      sat.object_name,
      sat.country,
      sat.launch_date,
      sat.constellation,
      pos.latitude,
      pos.longitude,
      pos.altitudeKm,
      pos.velocityKmS,
    ]);
  }

  const COLS = 10;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      const placeholders = batch
        .map((_, r) => `(${Array.from({ length: COLS }, (_, c) => `$${r * COLS + c + 1}`).join(",")})`)
        .join(",");
      await client.query(
        `INSERT INTO satellite_positions
          ("timestamp", norad_id, object_name, country, launch_date, constellation, latitude, longitude, altitude_km, velocity)
         VALUES ${placeholders}`,
        batch.flat()
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  console.log(
    `Snapshot done: ${values.length} written, ${failed} propagation failures, ${Date.now() - start}ms`
  );
}

async function main() {
  const once = process.argv.includes("--once");
  if (once) {
    await runSnapshot();
    await getPool().end();
    return;
  }

  console.log("Starting satellite snapshot worker (every 5 minutes) + daily CelesTrak catalog refresh (03:00 UTC)...");
  await runSnapshot().catch((err) => console.error("Initial snapshot failed:", err));
  cron.schedule("*/5 * * * *", () => {
    runSnapshot().catch((err) => console.error("Snapshot failed:", err));
  });
  cron.schedule("0 3 * * *", () => {
    console.log(`[${new Date().toISOString()}] Running daily CelesTrak catalog refresh...`);
    fetchAndUpsertSatellites({ closePool: false }).catch((err) =>
      console.error("Daily catalog refresh failed:", err)
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
