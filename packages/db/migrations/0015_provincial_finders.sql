PRAGMA foreign_keys = ON;

-- These are official search entry points, not individual open programs or jobs.
INSERT INTO source_registry (
  id, origin, name, publisher, source_url, jurisdiction_level,
  jurisdiction_code, jurisdiction_name, terms_url, terms_status,
  collection_mode, freshness_state, created_at, updated_at
) VALUES
  ('bc-benefits-connector', 'official_external', 'B.C. Benefits Connector',
   'Government of British Columbia', 'https://www2.gov.bc.ca/bcbenefitsconnector',
   'provincial', 'CA-BC', 'British Columbia',
   'https://www2.gov.bc.ca/gov/content/home/copyright', 'unreviewed',
   'official_link', 'unknown', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('bc-funding-finder', 'official_external', 'B.C. funding opportunities',
   'Government of British Columbia', 'https://www2.gov.bc.ca/gov/content/funding',
   'provincial', 'CA-BC', 'British Columbia',
   'https://www2.gov.bc.ca/gov/content/home/copyright', 'unreviewed',
   'official_link', 'unknown', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z');
