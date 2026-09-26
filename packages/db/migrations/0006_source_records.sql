PRAGMA foreign_keys = ON;

CREATE TABLE source_records (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source_registry(id),
  origin TEXT NOT NULL CHECK (origin IN ('official_external', 'participating_org', 'sample')),
  external_id TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT NOT NULL,
  publisher TEXT NOT NULL,
  jurisdiction_level TEXT NOT NULL CHECK (jurisdiction_level IN ('federal', 'provincial', 'municipal', 'regional', 'community')),
  jurisdiction_code TEXT NOT NULL,
  jurisdiction_name TEXT NOT NULL,
  municipality_code TEXT,
  municipality_name TEXT,
  licence_name TEXT,
  licence_url TEXT,
  terms_url TEXT,
  terms_status TEXT NOT NULL CHECK (terms_status IN ('unreviewed', 'permitted', 'restricted', 'prohibited')),
  language TEXT NOT NULL CHECK (language IN ('en', 'fr', 'und')),
  fetched_at TEXT,
  verified_at TEXT,
  expires_at TEXT,
  payload_hash TEXT CHECK (payload_hash IS NULL OR (length(payload_hash) = 64 AND payload_hash NOT GLOB '*[^0-9a-f]*')),
  evidence_url TEXT,
  freshness_state TEXT NOT NULL CHECK (freshness_state IN ('unknown', 'current', 'stale', 'expired', 'error')),
  last_error_code TEXT,
  sample_label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((municipality_code IS NULL) = (municipality_name IS NULL)),
  CHECK ((origin = 'sample' AND sample_label IS NOT NULL) OR (origin <> 'sample' AND sample_label IS NULL)),
  CHECK (origin = 'sample' OR source_url GLOB 'https://*'),
  CHECK (expires_at IS NULL OR verified_at IS NOT NULL),
  CHECK (freshness_state <> 'current' OR verified_at IS NOT NULL),
  CHECK ((freshness_state = 'error') = (last_error_code IS NOT NULL)),
  UNIQUE (source_id, external_id)
);

CREATE INDEX source_records_public_freshness_idx
  ON source_records (terms_status, freshness_state, jurisdiction_code, language);
CREATE INDEX source_records_source_external_idx
  ON source_records (source_id, external_id);

CREATE TRIGGER source_records_origin_matches_source_insert
BEFORE INSERT ON source_records
WHEN (SELECT origin FROM source_registry WHERE id = NEW.source_id) <> NEW.origin
BEGIN
  SELECT RAISE(ABORT, 'source record origin must match its registry source');
END;

CREATE TRIGGER source_records_origin_matches_source_update
BEFORE UPDATE OF source_id, origin ON source_records
WHEN (SELECT origin FROM source_registry WHERE id = NEW.source_id) <> NEW.origin
BEGIN
  SELECT RAISE(ABORT, 'source record origin must match its registry source');
END;

-- Fictional demonstration only. It is explicitly unrelated to the actual City
-- of Toronto and has no official application or service claim.
INSERT INTO source_records (
  id, source_id, origin, title, summary, source_url, publisher,
  jurisdiction_level, jurisdiction_code, jurisdiction_name,
  municipality_code, municipality_name, terms_status, language,
  freshness_state, sample_label, created_at, updated_at
) VALUES (
  'sample-toronto-community-resource', 'fictional-toronto-sample', 'sample',
  'Sample: Neighbourhood resource information session',
  'Fictional demonstration record. This is not an actual event or City of Toronto service.',
  'sample://fictional/toronto-demo',
  'CivicResolve demo (fictional; unaffiliated with the City of Toronto)',
  'municipal', 'CA-ON-TOR', 'Toronto, Ontario', 'CA-ON-TOR', 'Toronto',
  'unreviewed', 'en', 'unknown', 'Fictional sample only',
  '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'
);
