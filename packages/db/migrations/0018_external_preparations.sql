PRAGMA foreign_keys = ON;

CREATE TABLE external_preparations (
  owner_subject TEXT NOT NULL,
  record_id TEXT NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL CHECK (json_valid(answers_json)),
  checklist_json TEXT NOT NULL CHECK (json_valid(checklist_json)),
  status TEXT NOT NULL DEFAULT 'prepared-for-external'
    CHECK (status = 'prepared-for-external'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_subject, record_id)
);

CREATE INDEX external_preparations_owner_updated_idx
  ON external_preparations(owner_subject, updated_at DESC);

CREATE TABLE external_preparation_answers (
  owner_subject TEXT NOT NULL,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  response TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_subject, id)
);

CREATE INDEX external_preparation_answers_owner_updated_idx
  ON external_preparation_answers(owner_subject, updated_at DESC);
