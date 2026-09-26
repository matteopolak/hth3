CREATE TABLE voice_sessions (
  token_hash TEXT PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'fr')),
  conversation_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'not_submitted', 'duplicate', 'submitted')),
  submission_id TEXT REFERENCES feedback_submissions(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX voice_sessions_created_idx ON voice_sessions (created_at);
