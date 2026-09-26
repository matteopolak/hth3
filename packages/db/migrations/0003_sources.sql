PRAGMA foreign_keys = ON;

CREATE TABLE source_registry (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL CHECK (origin IN ('official_external', 'participating_org', 'sample')),
  name TEXT NOT NULL,
  publisher TEXT NOT NULL,
  source_url TEXT NOT NULL,
  jurisdiction_level TEXT NOT NULL CHECK (jurisdiction_level IN ('federal', 'provincial', 'municipal', 'regional', 'community')),
  jurisdiction_code TEXT NOT NULL,
  jurisdiction_name TEXT NOT NULL,
  municipality_code TEXT,
  municipality_name TEXT,
  licence_name TEXT,
  licence_url TEXT,
  terms_url TEXT,
  terms_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (terms_status IN ('unreviewed', 'permitted', 'restricted', 'prohibited')),
  collection_mode TEXT NOT NULL CHECK (collection_mode IN ('official_link', 'api', 'feed', 'dataset', 'manual', 'sample')),
  fetched_at TEXT,
  verified_at TEXT,
  expires_at TEXT,
  freshness_state TEXT NOT NULL DEFAULT 'unknown'
    CHECK (freshness_state IN ('unknown', 'current', 'stale', 'expired', 'error')),
  last_error TEXT,
  sample_label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((municipality_code IS NULL) = (municipality_name IS NULL)),
  CHECK ((origin = 'sample' AND sample_label IS NOT NULL AND collection_mode = 'sample')
      OR (origin <> 'sample' AND sample_label IS NULL AND collection_mode <> 'sample')),
  CHECK (origin = 'sample' OR source_url GLOB 'https://*'),
  CHECK (expires_at IS NULL OR verified_at IS NOT NULL),
  CHECK (freshness_state <> 'current' OR verified_at IS NOT NULL)
);

CREATE INDEX source_registry_origin_freshness_idx
  ON source_registry (origin, freshness_state, jurisdiction_code);
CREATE INDEX source_registry_jurisdiction_idx
  ON source_registry (jurisdiction_level, jurisdiction_code, municipality_code);

-- These are attributable official entry points only. No listings have been
-- imported, terms have not been reviewed, and none is presented as verified.
INSERT INTO source_registry (
  id, origin, name, publisher, source_url, jurisdiction_level,
  jurisdiction_code, jurisdiction_name, municipality_code, municipality_name,
  terms_status, collection_mode,
  freshness_state, sample_label, created_at, updated_at
) VALUES
  ('gc-jobs', 'official_external', 'Government of Canada jobs', 'Government of Canada',
   'https://www.canada.ca/en/services/jobs/opportunities/government.html',
   'federal', 'CA', 'Canada', NULL, NULL, 'unreviewed', 'official_link', 'unknown',
   NULL, '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('ontario-public-service-jobs', 'official_external', 'Ontario Public Service jobs', 'Government of Ontario',
   'https://www.gojobs.gov.on.ca/Jobs.aspx',
   'provincial', 'CA-ON', 'Ontario', NULL, NULL, 'unreviewed', 'official_link', 'unknown',
   NULL, '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('bc-public-service-jobs', 'official_external', 'BC Public Service jobs', 'Government of British Columbia',
   'https://www2.gov.bc.ca/gov/content/careers-myhr/job-seekers/current-job-postings',
   'provincial', 'CA-BC', 'British Columbia', NULL, NULL, 'unreviewed', 'official_link', 'unknown',
   NULL, '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('benefits-finder', 'official_external', 'Benefits Finder', 'Government of Canada',
   'https://www.canada.ca/en/services/benefits/finder.html',
   'federal', 'CA', 'Canada', NULL, NULL, 'unreviewed', 'official_link', 'unknown',
   NULL, '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('211-canada', 'official_external', '211 Canada', '211 Canada',
   'https://211.ca/data/',
   'community', 'CA', 'Canada', NULL, NULL, 'unreviewed', 'official_link', 'unknown',
   NULL, '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('fictional-toronto-sample', 'sample', 'Fictional Toronto demonstration source',
   'CivicResolve demo (fictional; unaffiliated with the City of Toronto)',
   'sample://fictional/toronto-demo', 'municipal', 'CA-ON-TOR', 'Toronto, Ontario', 'CA-ON-TOR', 'Toronto',
   'unreviewed', 'sample', 'unknown', 'Fictional sample only',
   '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z');
