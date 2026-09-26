PRAGMA foreign_keys = ON;

-- Publisher metadata only. A row never represents an Envoy submission.
CREATE TABLE consultations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('consultation', 'directory')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  publisher TEXT NOT NULL,
  jurisdiction_level TEXT NOT NULL CHECK (jurisdiction_level IN ('federal', 'provincial')),
  jurisdiction_code TEXT NOT NULL CHECK (jurisdiction_code IN ('CA', 'CA-BC', 'CA-ON')),
  jurisdiction_name TEXT NOT NULL,
  official_url TEXT NOT NULL CHECK (official_url GLOB 'https://*'),
  evidence_url TEXT NOT NULL CHECK (evidence_url GLOB 'https://*'),
  deadline_date TEXT CHECK (deadline_date IS NULL OR deadline_date GLOB '????-??-??'),
  verified_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  source_state TEXT NOT NULL CHECK (source_state IN ('current', 'stale', 'error')),
  last_error TEXT,
  updated_at TEXT NOT NULL,
  CHECK (kind = 'directory' OR deadline_date IS NOT NULL),
  CHECK ((source_state = 'error') = (last_error IS NOT NULL))
);

CREATE INDEX consultations_jurisdiction_deadline_idx
  ON consultations (jurisdiction_code, deadline_date);

-- Verified against each official page on 2026-09-26. After 2026-10-03 the API
-- downgrades source state to stale until an editor reviews it again.
INSERT INTO consultations (
  id, kind, title, summary, publisher, jurisdiction_level, jurisdiction_code,
  jurisdiction_name, official_url, evidence_url, deadline_date, verified_at,
  expires_at, source_state, last_error, updated_at
) VALUES
  (
    'canada-water-security-strategy', 'consultation',
    'National Water Security Strategy public engagement',
    'Share views on priorities for Canada’s first National Water Security Strategy on the Canada Water Agency site.',
    'Canada Water Agency', 'federal', 'CA', 'Canada',
    'https://www.canada.ca/en/canada-water-agency/national-water-security-strategy/public-engagement-towards-nwss.html',
    'https://www.canada.ca/en/canada-water-agency/national-water-security-strategy/public-engagement-towards-nwss.html',
    '2026-10-25', '2026-09-26T20:20:00.000Z', '2026-10-03T20:20:00.000Z',
    'current', NULL, '2026-09-26T20:20:00.000Z'
  ),
  (
    'bc-cypress-development-plan', 'consultation',
    'Cypress Mountain Ski Resort Development Plan',
    'BC Parks is seeking views on a proposed development plan for Cypress Provincial Park.',
    'Government of British Columbia', 'provincial', 'CA-BC', 'British Columbia',
    'https://engage.gov.bc.ca/govtogetherbc/engagement/cypress-mountain-ski-resort-development-plan/',
    'https://engage.gov.bc.ca/govtogetherbc/engagement/cypress-mountain-ski-resort-development-plan/',
    '2026-11-16', '2026-09-26T20:20:00.000Z', '2026-10-03T20:20:00.000Z',
    'current', NULL, '2026-09-26T20:20:00.000Z'
  ),
  (
    'bc-wildfire-app-survey', 'consultation',
    'BC Wildfire Service app experience survey',
    'BC Wildfire Service app users can share feedback on the official provincial survey page.',
    'Government of British Columbia', 'provincial', 'CA-BC', 'British Columbia',
    'https://engage.gov.bc.ca/govtogetherbc/engagement/bc-wildfire-service-app/',
    'https://engage.gov.bc.ca/govtogetherbc/engagement/bc-wildfire-service-app/',
    '2026-10-16', '2026-09-26T20:20:00.000Z', '2026-10-03T20:20:00.000Z',
    'current', NULL, '2026-09-26T20:20:00.000Z'
  ),
  (
    'on-gerrard-carlaw-transit-order', 'consultation',
    'Gerrard–Carlaw South transit-oriented community proposal',
    'Ontario is seeking comments on a proposed Minister’s Zoning Order in Toronto through its Environmental Registry.',
    'Government of Ontario', 'provincial', 'CA-ON', 'Ontario',
    'https://ero.ontario.ca/notice/026-0936',
    'https://ero.ontario.ca/notice/026-0936',
    '2026-10-11', '2026-09-26T20:20:00.000Z', '2026-10-03T20:20:00.000Z',
    'current', NULL, '2026-09-26T20:20:00.000Z'
  ),
  (
    'federal-consultations-directory', 'directory',
    'Consulting with Canadians',
    'Browse current federal consultations and confirm each opportunity on its publishing department’s page.',
    'Government of Canada', 'federal', 'CA', 'Canada',
    'https://www.canada.ca/en/government/system/consultations/consultingcanadians.html',
    'https://www.canada.ca/en/government/system/consultations/consultingcanadians.html',
    NULL, '2026-09-26T20:20:00.000Z', '2026-10-03T20:20:00.000Z',
    'current', NULL, '2026-09-26T20:20:00.000Z'
  ),
  (
    'bc-engagement-directory', 'directory',
    'govTogetherBC engagement opportunities',
    'Browse provincial engagement opportunities and check each project for current participation details.',
    'Government of British Columbia', 'provincial', 'CA-BC', 'British Columbia',
    'https://engage.gov.bc.ca/govtogetherbc/engagement/',
    'https://engage.gov.bc.ca/govtogetherbc/engagement/',
    NULL, '2026-09-26T20:20:00.000Z', '2026-10-03T20:20:00.000Z',
    'current', NULL, '2026-09-26T20:20:00.000Z'
  ),
  (
    'ontario-environmental-registry', 'directory',
    'Environmental Registry of Ontario',
    'Find Ontario proposal notices and check each official notice for its comment period.',
    'Government of Ontario', 'provincial', 'CA-ON', 'Ontario',
    'https://ero.ontario.ca/search',
    'https://ero.ontario.ca/search',
    NULL, '2026-09-26T20:20:00.000Z', '2026-10-03T20:20:00.000Z',
    'current', NULL, '2026-09-26T20:20:00.000Z'
  );
