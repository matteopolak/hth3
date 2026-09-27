PRAGMA foreign_keys = ON;

-- Dates and opening status belong to individual sourced records, never directories.
-- The direct posting URL, publisher, stable external ID, verification and evidence
-- remain on source_records.
CREATE TABLE source_record_listings (
  record_id TEXT PRIMARY KEY REFERENCES source_records(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('job', 'support', 'funding')),
  posted_date TEXT CHECK (posted_date IS NULL OR posted_date GLOB '????-??-??'),
  closing_date TEXT CHECK (closing_date IS NULL OR closing_date GLOB '????-??-??'),
  location_text TEXT,
  application_status TEXT NOT NULL
    CHECK (application_status IN ('open', 'closed', 'unknown')),
  CHECK (posted_date IS NULL OR closing_date IS NULL OR posted_date <= closing_date)
);

CREATE INDEX source_record_listings_category_status_idx
  ON source_record_listings (category, application_status, closing_date);
