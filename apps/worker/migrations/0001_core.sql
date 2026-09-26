CREATE TABLE IF NOT EXISTS taxonomy_versions (
  version INTEGER PRIMARY KEY,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  version INTEGER NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  routing_team TEXT NOT NULL,
  public_explanation TEXT NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (version, id)
);
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  contact_email TEXT,
  status TEXT NOT NULL,
  category_id TEXT,
  department TEXT,
  confidence REAL,
  taxonomy_version INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  owner_subject TEXT,
  status_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cases_queue ON cases (status, created_at);
CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS case_events_case_time ON case_events (case_id, occurred_at);
CREATE TABLE IF NOT EXISTS taxonomy_drafts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  routing_team TEXT NOT NULL,
  public_explanation TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
