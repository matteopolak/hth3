PRAGMA foreign_keys = ON;

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  auth0_org_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  jurisdiction_name TEXT NOT NULL,
  jurisdiction_region TEXT NOT NULL,
  sample INTEGER NOT NULL DEFAULT 1 CHECK (sample IN (0, 1)),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  created_at TEXT NOT NULL
);

CREATE TABLE organization_memberships (
  user_subject TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL CHECK (role IN ('applicant', 'civic_staff', 'hiring_reviewer', 'organization_admin', 'curator')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_subject, organization_id, role)
);

CREATE INDEX organization_memberships_org_role_idx
  ON organization_memberships (organization_id, role, user_subject);

CREATE TABLE postings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_name TEXT NOT NULL,
  sample INTEGER NOT NULL CHECK (sample IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX postings_org_status_idx ON postings (organization_id, status);

CREATE TABLE feedback_submissions (
  id TEXT PRIMARY KEY,
  original_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'acknowledged', 'in_review', 'waiting_on_resident', 'outcome_recorded', 'closed', 'reopened')),
  receipt_token_hash TEXT NOT NULL UNIQUE,
  department_name TEXT,
  outcome TEXT,
  sample INTEGER NOT NULL CHECK (sample IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX feedback_submissions_status_created_idx
  ON feedback_submissions (status, created_at);

CREATE TABLE feedback_messages (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES feedback_submissions(id),
  author_kind TEXT NOT NULL CHECK (author_kind IN ('resident', 'staff')),
  author_subject TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX feedback_messages_submission_created_idx
  ON feedback_messages (submission_id, created_at);

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  posting_id TEXT NOT NULL REFERENCES postings(id),
  applicant_subject TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'under_review', 'information_requested', 'shortlisted', 'declined', 'offer')),
  sample INTEGER NOT NULL CHECK (sample IN (0, 1)),
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (posting_id, applicant_subject)
);

CREATE INDEX applications_posting_status_idx ON applications (posting_id, status, submitted_at);
CREATE INDEX applications_applicant_idx ON applications (applicant_subject, submitted_at);

CREATE TABLE private_assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id),
  owner_subject TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('resume', 'application_attachment', 'feedback_attachment')),
  record_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  created_at TEXT NOT NULL
);

CREATE INDEX private_assets_owner_idx ON private_assets (owner_subject, purpose, record_id);
CREATE INDEX private_assets_org_idx ON private_assets (organization_id, purpose, record_id);

CREATE TABLE idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE outbox_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_subject TEXT,
  organization_id TEXT REFERENCES organizations(id),
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  delivered_at TEXT,
  last_error TEXT
);

CREATE INDEX outbox_pending_idx ON outbox_events (next_attempt_at, occurred_at)
  WHERE delivered_at IS NULL;

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_subject TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX audit_entity_idx ON audit_events (entity_type, entity_id, created_at);

INSERT INTO organizations (
  id, auth0_org_id, slug, display_name, jurisdiction_name, jurisdiction_region,
  sample, verification_status, created_at
) VALUES (
  'org_43G1B1RhPwac7EjS',
  'org_43G1B1RhPwac7EjS',
  'civicresolve-toronto-sandbox',
  'CivicResolve Toronto Sandbox (Fictional, unaffiliated)',
  'Toronto',
  'Ontario',
  1,
  'unverified',
  '2026-09-26T00:00:00.000Z'
);

INSERT INTO postings (
  id, organization_id, title, description, location_name, sample, status, created_at, updated_at
) VALUES (
  'sample-posting-intake-assistant',
  'org_43G1B1RhPwac7EjS',
  'Sample: Civic Services Intake Assistant',
  'A fictional sandbox posting used to demonstrate application review. It is not an official City of Toronto or government vacancy.',
  'Toronto, Ontario (sample geography)',
  1,
  'published',
  '2026-09-26T00:00:00.000Z',
  '2026-09-26T00:00:00.000Z'
);
