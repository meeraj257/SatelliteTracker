# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # start Next.js (Turbopack) dev server on :3000
npm run build         # production build
npm run start         # run the production build
npx tsc --noEmit       # typecheck (no dedicated lint/test setup in this repo)

npm run fetch-tle      # refresh satellites table from CelesTrak (TLEs + SATCAT)
npm run fetch-tle -- --skip-satcat   # same, but skip the SATCAT (country/launch_date) fetch
npm run ingest         # one-shot or continuous position-snapshot worker
npx tsx scripts/ingest.ts --once      # write a single snapshot and exit
```

There's no test suite in this repo currently.

## Environment

Requires `DATABASE_URL` in `.env.local` (see `.env.local.example`) pointing at a Tiger Cloud / TimescaleDB service. The scripts under `scripts/` load `.env.local` explicitly via `dotenv` (Next.js itself loads it automatically). The connection string must include `sslmode=require&uselibpqcompat=true` — without `uselibpqcompat=true`, recent `pg` versions upgrade `sslmode=require` to full certificate verification and the connection fails against Tiger Cloud's cert.

The database itself (schema, hypertable, policies) is managed through the Tiger MCP tools (`mcp__tiger__*`), not a migration runner — `sql/schema.sql` is the source of truth but must be applied by hand via `mcp__tiger__db_execute_query` (or psql) against the target service.

## Architecture

**Data pipeline:** CelesTrak (TLEs via `GROUP=...&FORMAT=3le`, plus the SATCAT CSV for country/launch date) → `fetchAndUpsertSatellites` (`scripts/fetch-tle.ts`) upserts into the `satellites` reference table → `scripts/ingest.ts` is the one long-running worker with two cron jobs: every 5 minutes it propagates every tracked satellite's TLE to "now" with `satellite.js` and inserts one row per satellite into the `satellite_positions` hypertable, and once a day (03:00 UTC) it calls `fetchAndUpsertSatellites` to pick up newly launched satellites and refresh TLEs — the daily job only fires on the cron tick, not at worker startup, so restarting the worker (e.g. during development) can't accidentally spam CelesTrak's catalog endpoint. `fetch-tle.ts` is also a standalone CLI (`npm run fetch-tle`) for an on-demand refresh. A `constellation_hourly_stats` continuous aggregate rolls positions up per constellation per hour → `app/api/satellites` and `app/api/stats` serve both tables as JSON → the frontend fetches once and re-propagates positions client-side for smooth real-time motion (see below).

**Orbital math (`lib/orbital.ts`) is isomorphic** — the exact same `propagateTle`/`orbitalParametersFromTle` functions run server-side in `scripts/ingest.ts` (writing hypertable snapshots) and client-side in `components/Satellites.tsx` (animating the globe from cached TLEs, recomputed every ~2s rather than every frame for performance). Don't duplicate this logic; import from `lib/orbital.ts` on both sides.

**Coordinate convention (`lib/geo.ts`):** `latLonToVector3` is the *single* lat/lon→3D mapping used by `Earth.tsx` (texture UVs), `Satellites.tsx` (satellite placement), `SelectedMarker.tsx`, and the sun-direction uniform. All four must agree or satellites will render over the wrong continents. The Earth mesh is deliberately **non-rotating** — a satellite's propagated lat/lon already encodes Earth's rotation (via GMST inside SGP4), so the globe texture must stay fixed for ground tracks to land correctly.

**Constellation taxonomy (`lib/constellations.ts`)** is the single source of truth for: the `Constellation` union type, display colors/labels, and the list of CelesTrak GP groups to fetch (`CELESTRAK_GROUPS`, each mapped to a constellation bucket). Groups are fetched smallest/most-specific first so they claim their `norad_id`s before the broad catch-alls (`starlink`, `active`) run and everything unclaimed falls into `other`. Starlink satellites reached via the `active` catch-all are additionally reclassified by `OBJECT_NAME` prefix (`STARLINK...`) in `scripts/fetch-tle.ts`, since the dedicated `starlink` group is the one most likely to already be throttled.

**CelesTrak rate limits — two different mechanisms, handled differently:**
- Per-`GROUP` throttle: repeating the same `GROUP=` value within ~2 hours returns 403. `fetchGroup` in `scripts/fetch-tle.ts` caches each successful response to `.cache/celestrak/<group>.json` and falls back to that cache (or skips the group, rather than crashing) on a 403.
- SATCAT (country/launch date) IP-level throttle: stricter — CelesTrak explicitly **resets its own 2-hour countdown on every repeated hit while blocked**, including failed ones, so retrying makes it worse. `fetchSatcat` caches to `.cache/celestrak/satcat.json` and degrades to an empty map rather than retrying live. When you know SATCAT is currently blocked, rerun with `--skip-satcat` to backfill TLE groups without touching it at all. The upsert in `fetch-tle.ts` uses `COALESCE(EXCLUDED.country, satellites.country)` (same for `launch_date`) so a run with no SATCAT data can't null out values a previous run already set.

**`lib/db.ts`** overrides `pg`'s DATE (oid 1082) type parser to return the raw `"YYYY-MM-DD"` string instead of a JS `Date` — the default parser builds the date at local-timezone midnight, which round-trips through JSON as a shifted UTC instant.

**Frontend state** is owned entirely by `app/page.tsx` (client component): satellite list from `useSatellites`, timeline cutoff, hidden-constellation set, and the current selection all live there and are threaded down into `GlobeScene`/`Satellites`/`Legend`/`SatelliteInfoPanel`. A satellite with no known `launch_date` is treated as always-visible regardless of the timeline slider position (relevant right after a fresh CelesTrak pull, before SATCAT enrichment has caught up).
