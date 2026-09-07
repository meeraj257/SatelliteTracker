/**
 * Pulls current TLEs from CelesTrak for the tracked groups plus the SATCAT
 * catalog (for country + launch date), and upserts everything into the
 * `satellites` reference table. Run this periodically (e.g. daily) to keep
 * TLEs fresh — orbital elements decay in accuracy after a few days.
 *
 * Usage: npx tsx scripts/fetch-tle.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../lib/db";
import { CELESTRAK_GROUPS, celestrakGpUrl, CELESTRAK_SATCAT_URL, Constellation } from "../lib/constellations";

interface CelestrakGpEntry {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  TLE_LINE1: string;
  TLE_LINE2: string;
}

/** Parses CelesTrak's FORMAT=3le output: groups of [name, line1, line2]. */
function parse3le(text: string): CelestrakGpEntry[] {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim().length > 0);
  const entries: CelestrakGpEntry[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const nameLine = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (!line1.startsWith("1 ") || !line2.startsWith("2 ")) continue;
    const noradId = Number(line1.slice(2, 7).trim());
    if (!Number.isFinite(noradId)) continue;
    entries.push({
      OBJECT_NAME: nameLine.replace(/^0 /, "").trim(),
      NORAD_CAT_ID: noradId,
      TLE_LINE1: line1,
      TLE_LINE2: line2,
    });
  }
  return entries;
}

interface SatcatEntry {
  country: string | null;
  launchDate: string | null;
}

interface SatelliteRow {
  noradId: number;
  objectName: string;
  constellation: Constellation;
  tleLine1: string;
  tleLine2: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

async function fetchSatcat(): Promise<Map<number, SatcatEntry>> {
  const res = await fetch(CELESTRAK_SATCAT_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`SATCAT fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n").filter(Boolean);
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const noradIdx = header.indexOf("NORAD_CAT_ID");
  const ownerIdx = header.indexOf("OWNER");
  const launchIdx = header.indexOf("LAUNCH_DATE");

  const map = new Map<number, SatcatEntry>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const noradId = Number(cols[noradIdx]);
    if (!Number.isFinite(noradId)) continue;
    map.set(noradId, {
      country: cols[ownerIdx]?.trim() || null,
      launchDate: cols[launchIdx]?.trim() || null,
    });
  }
  return map;
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; satellite-tracker/1.0; +https://github.com)",
};

// CelesTrak throttles each GROUP value to ~one download per 2 hours per
// client (a repeat within the window gets a 403 "data has not updated since
// your last successful download"). We cache each group's response to disk so
// a rerun shortly after a partial failure (e.g. a DB error mid-run) can reuse
// what was already fetched instead of tripping the throttle a second time.
const CACHE_DIR = path.join(process.cwd(), ".cache", "celestrak");

async function readCache(group: string): Promise<CelestrakGpEntry[] | null> {
  try {
    const raw = await readFile(path.join(CACHE_DIR, `${group}.json`), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(group: string, entries: CelestrakGpEntry[]): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `${group}.json`), JSON.stringify(entries));
}

async function fetchGroupLive(group: string, attempt = 1): Promise<CelestrakGpEntry[]> {
  const res = await fetch(celestrakGpUrl(group), { headers: FETCH_HEADERS });
  if (!res.ok) {
    if ((res.status === 403 || res.status === 429) && attempt < 3) {
      const delayMs = attempt * 5000;
      console.log(`  ${res.status} on "${group}", retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/3)...`);
      await new Promise((r) => setTimeout(r, delayMs));
      return fetchGroupLive(group, attempt + 1);
    }
    throw new Error(`CelesTrak group ${group} fetch failed: ${res.status}`);
  }
  return parse3le(await res.text());
}

/** Fetches a group, falling back to the on-disk cache (then an empty skip)
 * if CelesTrak's per-group throttle is currently blocking it. */
async function fetchGroup(group: string): Promise<CelestrakGpEntry[]> {
  try {
    const entries = await fetchGroupLive(group);
    await writeCache(group, entries);
    return entries;
  } catch (err) {
    const cached = await readCache(group);
    if (cached) {
      console.log(`  live fetch failed (${(err as Error).message}), using cached copy (${cached.length} objects)`);
      return cached;
    }
    console.warn(`  skipping "${group}": ${(err as Error).message} (no cache available)`);
    return [];
  }
}

async function main() {
  console.log("Fetching SATCAT (country / launch date)...");
  const satcat = await fetchSatcat();
  console.log(`SATCAT: ${satcat.size} entries`);

  const byNoradId = new Map<number, SatelliteRow>();

  for (const { group, constellation } of CELESTRAK_GROUPS) {
    console.log(`Fetching group "${group}"...`);
    const entries = await fetchGroup(group);
    let added = 0;
    for (const e of entries) {
      if (byNoradId.has(e.NORAD_CAT_ID)) continue; // more specific group already claimed it
      const effectiveConstellation =
        group === "active" && e.OBJECT_NAME.startsWith("STARLINK") ? "starlink" : constellation;
      byNoradId.set(e.NORAD_CAT_ID, {
        noradId: e.NORAD_CAT_ID,
        objectName: e.OBJECT_NAME,
        constellation: effectiveConstellation,
        tleLine1: e.TLE_LINE1,
        tleLine2: e.TLE_LINE2,
      });
      added++;
    }
    console.log(`  ${entries.length} objects, ${added} new`);
    // be polite to CelesTrak's servers between group requests
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`Total unique tracked objects: ${byNoradId.size}`);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let written = 0;
    for (const row of byNoradId.values()) {
      const cat = satcat.get(row.noradId);
      await client.query(
        `INSERT INTO satellites (norad_id, object_name, country, launch_date, constellation, tle_line1, tle_line2, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (norad_id) DO UPDATE SET
           object_name = EXCLUDED.object_name,
           country = EXCLUDED.country,
           launch_date = EXCLUDED.launch_date,
           constellation = EXCLUDED.constellation,
           tle_line1 = EXCLUDED.tle_line1,
           tle_line2 = EXCLUDED.tle_line2,
           updated_at = now()`,
        [
          row.noradId,
          row.objectName,
          cat?.country ?? null,
          cat?.launchDate ? cat.launchDate.slice(0, 10) : null,
          row.constellation,
          row.tleLine1,
          row.tleLine2,
        ]
      );
      written++;
      if (written % 1000 === 0) console.log(`  upserted ${written}/${byNoradId.size}`);
    }
    await client.query("COMMIT");
    console.log(`Done. Upserted ${written} satellites.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
