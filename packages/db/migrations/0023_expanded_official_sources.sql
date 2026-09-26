PRAGMA foreign_keys = ON;

-- Finder directories are source-backed handoffs, not verified physical pins.
INSERT INTO source_registry (
  id, origin, name, publisher, source_url, jurisdiction_level,
  jurisdiction_code, jurisdiction_name, terms_url, terms_status,
  collection_mode, freshness_state, created_at, updated_at
) VALUES
  ('federal-service-canada-offices', 'official_external', 'Find a Service Canada office',
   'Government of Canada', 'https://www.canada.ca/en/employment-social-development/corporate/contact.html',
   'federal', 'CA', 'Canada', 'https://www.canada.ca/en/transparency/terms.html',
   'unreviewed', 'official_link', 'unknown', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('ontario-benefits-finder', 'official_external', 'Find benefits and programs',
   'Government of Ontario', 'https://www.ontario.ca/page/find-benefits-and-programs',
   'provincial', 'CA-ON', 'Ontario', 'https://www.ontario.ca/page/terms-use',
   'unreviewed', 'official_link', 'unknown', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('ontario-funding-finder', 'official_external', 'Available funding opportunities from the Ontario Government',
   'Government of Ontario', 'https://www.ontario.ca/page/available-funding-opportunities-ontario-government',
   'provincial', 'CA-ON', 'Ontario', 'https://www.ontario.ca/page/terms-use',
   'unreviewed', 'official_link', 'unknown', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
  ('serviceontario-location-finder', 'official_external', 'ServiceOntario locations, hours and contact',
   'Government of Ontario', 'https://www.ontario.ca/locations/serviceontario/',
   'provincial', 'CA-ON', 'Ontario', 'https://www.ontario.ca/page/terms-use',
   'unreviewed', 'official_link', 'unknown', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z');

UPDATE source_registry
SET name = 'Careers: Ontario Public Service',
    source_url = 'https://www.ontario.ca/page/careers-ontario-public-service',
    terms_url = 'https://www.ontario.ca/page/terms-use',
    updated_at = '2026-09-26T00:00:00.000Z'
WHERE id = 'ontario-public-service-jobs';
