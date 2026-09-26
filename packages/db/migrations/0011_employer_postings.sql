ALTER TABLE postings ADD COLUMN published_at TEXT;
ALTER TABLE postings ADD COLUMN closed_at TEXT;

CREATE TABLE application_messages (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('applicant', 'employer')),
  author_subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX application_messages_application_created_idx
  ON application_messages (application_id, created_at, id);

UPDATE postings SET published_at = updated_at WHERE status = 'published';
UPDATE postings SET closed_at = updated_at WHERE status = 'closed';
