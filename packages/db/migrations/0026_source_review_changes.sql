ALTER TABLE source_registry
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

ALTER TABLE source_registry
  ADD COLUMN curator_overrides_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE source_review_changes (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source_registry(id),
  base_source_version INTEGER NOT NULL CHECK (base_source_version > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  proposed_json TEXT NOT NULL CHECK (json_valid(proposed_json)),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 12 AND 1200),
  evidence_url TEXT NOT NULL CHECK (evidence_url GLOB 'https://*'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_reason TEXT,
  CHECK ((status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
      OR (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE INDEX source_review_changes_status_idx
  ON source_review_changes (status, created_at DESC);
CREATE INDEX source_review_changes_source_idx
  ON source_review_changes (source_id, created_at DESC);
