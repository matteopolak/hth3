PRAGMA foreign_keys = ON;

-- A location is mappable only when reviewed public access and services are
-- backed by an official source. Null hours/accessibility mean unknown.
CREATE TABLE service_location_metadata (
  record_id TEXT PRIMARY KEY REFERENCES source_records(id) ON DELETE CASCADE,
  service_category TEXT NOT NULL CHECK (service_category IN
    ('government', 'library', 'community', 'transit', 'other')),
  address TEXT,
  public_access_summary TEXT,
  services_summary TEXT,
  hours_summary TEXT,
  accessibility_summary TEXT,
  details_verified_at TEXT,
  details_source_url TEXT CHECK (
    details_source_url IS NULL OR details_source_url LIKE 'https://%')
);

CREATE INDEX service_location_metadata_category
  ON service_location_metadata(service_category);
