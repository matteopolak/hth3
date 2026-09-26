PRAGMA foreign_keys = ON;

CREATE TABLE discovery_record_areas (
  record_id TEXT PRIMARY KEY REFERENCES source_records(id) ON DELETE CASCADE,
  area TEXT NOT NULL CHECK (area IN ('jobs', 'support', 'funding', 'nearby', 'participation'))
);

CREATE TABLE discovery_saved_items (
  owner_subject TEXT NOT NULL,
  record_id TEXT NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  checklist_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(checklist_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_subject, record_id)
);

CREATE INDEX discovery_saved_items_owner_updated_idx
  ON discovery_saved_items (owner_subject, updated_at DESC);

-- The source is an official search entry point, not an individual open consultation.
-- Link metadata and a short original description were reviewed on 2026-09-26.
INSERT INTO source_registry (
  id, origin, name, publisher, source_url, jurisdiction_level,
  jurisdiction_code, jurisdiction_name, terms_url, terms_status,
  collection_mode, fetched_at, verified_at, expires_at,
  freshness_state, created_at, updated_at
) VALUES (
  'federal-consultations-finder', 'official_external',
  'Consulting with Canadians', 'Government of Canada',
  'https://www.canada.ca/en/government/system/consultations/consultingcanadians.html',
  'federal', 'CA', 'Canada',
  'https://www.canada.ca/en/transparency/terms.html', 'permitted',
  'official_link', '2026-09-26T00:00:00.000Z',
  '2026-09-26T00:00:00.000Z', '2026-10-10T00:00:00.000Z',
  'current', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'
);

INSERT INTO source_records (
  id, source_id, origin, external_id, title, summary, source_url,
  publisher, jurisdiction_level, jurisdiction_code, jurisdiction_name,
  terms_url, terms_status, language, fetched_at, verified_at,
  expires_at, evidence_url, freshness_state, created_at, updated_at
) VALUES (
  'official-federal-consultations-finder', 'federal-consultations-finder',
  'official_external',
  'https://www.canada.ca/en/government/system/consultations/consultingcanadians.html',
  'Consulting with Canadians',
  'Search Government of Canada consultations and continue to the official participation page.',
  'https://www.canada.ca/en/government/system/consultations/consultingcanadians.html',
  'Government of Canada', 'federal', 'CA', 'Canada',
  'https://www.canada.ca/en/transparency/terms.html', 'permitted',
  'en', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z',
  '2026-10-10T00:00:00.000Z',
  'https://www.canada.ca/en/government/system/consultations/consultingcanadians.html',
  'current', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'
);

INSERT INTO discovery_record_areas (record_id, area) VALUES
  ('official-federal-consultations-finder', 'participation'),
  ('sample-toronto-community-resource', 'participation');

UPDATE source_registry
SET publisher = 'Envoy sample (fictional; unaffiliated with the City of Toronto)'
WHERE id = 'fictional-toronto-sample';

UPDATE source_records
SET publisher = 'Envoy sample (fictional; unaffiliated with the City of Toronto)'
WHERE id = 'sample-toronto-community-resource';
