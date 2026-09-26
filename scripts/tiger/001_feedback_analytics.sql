-- Apply with: tiger db query SERVICE_ID --file scripts/tiger/001_feedback_analytics.sql
-- D1 remains the source of truth. Only privacy-safe feedback event metadata enters Tiger.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS feedback_events (
  occurred_at TIMESTAMPTZ NOT NULL,
  event_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'unclassified',
  intent TEXT NOT NULL DEFAULT 'unclassified',
  municipality_csd_uid TEXT,
  status TEXT,
  sample BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (occurred_at, event_id)
);

SELECT create_hypertable('feedback_events', by_range('occurred_at'), if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS feedback_events_org_time_idx
  ON feedback_events (organization_id, occurred_at DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS feedback_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 day', occurred_at) AS day,
  organization_id,
  event_type,
  category,
  intent,
  municipality_csd_uid,
  sample,
  count(*) AS event_count
FROM feedback_events
GROUP BY day, organization_id, event_type, category, intent,
  municipality_csd_uid, sample
WITH NO DATA;

CREATE INDEX IF NOT EXISTS feedback_daily_org_day_idx
  ON feedback_daily (organization_id, day DESC);

ALTER MATERIALIZED VIEW feedback_daily
  SET (timescaledb.materialized_only = false);

SELECT add_continuous_aggregate_policy(
  'feedback_daily',
  start_offset => INTERVAL '91 days',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);
