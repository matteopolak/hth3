CREATE TABLE municipality_geographies (
  csd_uid TEXT PRIMARY KEY CHECK (length(csd_uid) = 7),
  name TEXT NOT NULL,
  province_code TEXT NOT NULL CHECK (length(province_code) = 2),
  province_name TEXT NOT NULL,
  geography_source TEXT NOT NULL,
  source_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE feedback_destinations (
  municipality_csd_uid TEXT NOT NULL REFERENCES municipality_geographies(csd_uid),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  routing_label TEXT NOT NULL,
  sample INTEGER NOT NULL CHECK (sample IN (0, 1)),
  PRIMARY KEY (municipality_csd_uid, organization_id)
);

CREATE TABLE feedback_abuse_counters (
  bucket_hash TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('create', 'reply', 'reopen')),
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (bucket_hash, scope)
);

CREATE INDEX feedback_abuse_counters_window_idx
  ON feedback_abuse_counters (window_started_at);

ALTER TABLE feedback_submissions
  ADD COLUMN municipality_csd_uid TEXT REFERENCES municipality_geographies(csd_uid);

ALTER TABLE feedback_submissions
  ADD COLUMN category TEXT NOT NULL DEFAULT 'other_or_unsure'
    CHECK (category IN (
      'roads_and_sidewalks',
      'public_transit',
      'parks_and_trees',
      'water_and_wastewater',
      'waste_collection',
      'housing_and_shelter',
      'other_or_unsure'
    ));

ALTER TABLE feedback_submissions
  ADD COLUMN constructive_follow_up TEXT;

CREATE INDEX feedback_submissions_municipality_category_created_idx
  ON feedback_submissions (municipality_csd_uid, category, created_at);

INSERT INTO municipality_geographies (
  csd_uid, name, province_code, province_name, geography_source,
  source_version, created_at
) VALUES (
  '3520005',
  'Toronto',
  '35',
  'Ontario',
  'https://www23.statcan.gc.ca/imdb/p3VD.pl?CLV=4&CPV=3520005&CST=01012021&CVD=1341558&Function=getVD&MLV=4&TVD=1346772&dbg=1',
  'Statistics Canada Standard Geographical Classification 2021',
  '2026-09-26T00:00:00.000Z'
);

INSERT INTO feedback_destinations (
  municipality_csd_uid, organization_id, routing_label, sample
) VALUES (
  '3520005',
  'org_43G1B1RhPwac7EjS',
  'General review (fictional Toronto sandbox)',
  1
);
