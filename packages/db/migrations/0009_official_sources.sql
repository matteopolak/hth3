PRAGMA foreign_keys = ON;

-- Kind distinguishes official handoff directories from actual vacancies or awards.
CREATE TABLE source_record_details (
  record_id TEXT PRIMARY KEY REFERENCES source_records(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('jobs_finder', 'benefits_finder', 'funding_finder', 'service_location')),
  latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

INSERT INTO source_registry (
  id, origin, name, publisher, source_url, jurisdiction_level,
  jurisdiction_code, jurisdiction_name, terms_url, terms_status,
  collection_mode, freshness_state, created_at, updated_at
) VALUES
  ('federal-grants-funding', 'official_external',
   'Grants and funding from the Government of Canada', 'Government of Canada',
   'https://www.canada.ca/en/government/grants-funding.html', 'federal', 'CA',
   'Canada', 'https://www.canada.ca/en/transparency/terms.html', 'unreviewed',
   'official_link', 'unknown', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('service-bc-office-locations', 'official_external', 'Service BC office locations',
   'Government of British Columbia',
   'https://catalogue.data.gov.bc.ca/dataset/service-bc-office-locations',
   'provincial', 'CA-BC', 'British Columbia',
   'https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc',
   'permitted', 'api', 'unknown', '2026-09-26T00:00:00.000Z',
   '2026-09-26T00:00:00.000Z');
