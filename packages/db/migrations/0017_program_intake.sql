PRAGMA foreign_keys = ON;

CREATE TABLE sponsor_programs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL CHECK (kind IN ('grant', 'benefit')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  questions_json TEXT NOT NULL CHECK (json_valid(questions_json)),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'closed')),
  sample INTEGER NOT NULL CHECK (sample IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  closed_at TEXT
);

CREATE INDEX sponsor_programs_org_status_idx ON sponsor_programs (organization_id, status);

CREATE TABLE program_applications (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES sponsor_programs(id),
  applicant_subject TEXT NOT NULL,
  answers_json TEXT NOT NULL CHECK (json_valid(answers_json)),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'under_review', 'information_requested', 'approved', 'declined')),
  sample INTEGER NOT NULL CHECK (sample IN (0, 1)),
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (program_id, applicant_subject)
);

CREATE INDEX program_applications_program_status_idx ON program_applications (program_id, status, submitted_at);
CREATE INDEX program_applications_owner_idx ON program_applications (applicant_subject, submitted_at);

CREATE TABLE program_application_messages (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES program_applications(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('applicant', 'sponsor')),
  author_subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX program_application_messages_created_idx ON program_application_messages (application_id, created_at, id);

INSERT INTO sponsor_programs (
  id, organization_id, kind, title, summary, questions_json, status,
  sample, created_at, updated_at, published_at
) VALUES (
  'sample-program-community-support', 'org_43G1B1RhPwac7EjS', 'benefit',
  'Community support intake',
  'A practice intake in Envoy. No government program or benefit is offered through this record.',
  '[{"id":"support_needed","label":"What support are you looking for?","type":"long_text","required":true},{"id":"contact_preference","label":"Preferred way to follow up","type":"select","required":true,"options":["Email","Phone","In-app messages"]}]',
  'published', 1, '2026-09-26T00:00:00.000Z',
  '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z'
);
