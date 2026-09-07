-- Satellite tracker schema for Tiger Cloud (TimescaleDB)

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Reference/dimension table: one row per tracked object, holds the latest TLE
-- so the client can propagate real-time positions with satellite.js.
CREATE TABLE IF NOT EXISTS satellites (
  norad_id       INTEGER PRIMARY KEY,
  object_name    TEXT NOT NULL,
  country        TEXT,
  launch_date    DATE,
  constellation  TEXT NOT NULL DEFAULT 'other',
  tle_line1      TEXT NOT NULL,
  tle_line2      TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS satellites_constellation_idx ON satellites (constellation);

-- Hypertable: a position snapshot row every 5 minutes per satellite.
CREATE TABLE IF NOT EXISTS satellite_positions (
  "timestamp"    TIMESTAMPTZ NOT NULL,
  norad_id       INTEGER NOT NULL,
  object_name    TEXT NOT NULL,
  country        TEXT,
  launch_date    DATE,
  constellation  TEXT NOT NULL,
  latitude       DOUBLE PRECISION NOT NULL,
  longitude      DOUBLE PRECISION NOT NULL,
  altitude_km    DOUBLE PRECISION NOT NULL,
  velocity       DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('satellite_positions', 'timestamp', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS satellite_positions_norad_time_idx
  ON satellite_positions (norad_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS satellite_positions_constellation_time_idx
  ON satellite_positions (constellation, "timestamp" DESC);

-- Compression: cold chunks older than 2 days get compressed.
ALTER TABLE satellite_positions SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'norad_id',
  timescaledb.compress_orderby = '"timestamp" DESC'
);

SELECT add_compression_policy('satellite_positions', INTERVAL '2 days', if_not_exists => TRUE);

-- Keep 90 days of raw snapshots; the continuous aggregate below retains history longer.
SELECT add_retention_policy('satellite_positions', INTERVAL '90 days', if_not_exists => TRUE);

-- Continuous aggregate: orbital statistics per constellation per hour.
CREATE MATERIALIZED VIEW IF NOT EXISTS constellation_hourly_stats
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', "timestamp") AS bucket,
  constellation,
  count(DISTINCT norad_id)           AS satellite_count,
  avg(altitude_km)                   AS avg_altitude_km,
  min(altitude_km)                   AS min_altitude_km,
  max(altitude_km)                   AS max_altitude_km,
  avg(velocity)                      AS avg_velocity_kms,
  stddev(altitude_km)                AS stddev_altitude_km
FROM satellite_positions
GROUP BY bucket, constellation
WITH NO DATA;

SELECT add_continuous_aggregate_policy('constellation_hourly_stats',
  start_offset      => INTERVAL '3 hours',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists     => TRUE
);
