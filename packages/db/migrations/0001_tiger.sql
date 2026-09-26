-- Target: Tiger Cloud PostgreSQL with TimescaleDB enabled.
-- This migration has not been applied without a configured Tiger service.
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS case_events (
  event_id UUID NOT NULL,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  department TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (event_id, occurred_at)
);

SELECT create_hypertable('case_events', by_range('occurred_at'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS case_events_case_time ON case_events (case_id, occurred_at DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_case_activity
WITH (timescaledb.continuous) AS
SELECT time_bucket(INTERVAL '1 hour', occurred_at) AS bucket,
       department,
       event_type,
       COUNT(*) AS event_count
FROM case_events
GROUP BY bucket, department, event_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy('hourly_case_activity',
  start_offset => INTERVAL '30 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);
