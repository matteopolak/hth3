CREATE TABLE applicant_profiles (
  owner_subject TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE applicant_resumes (
  id TEXT PRIMARY KEY,
  owner_subject TEXT NOT NULL,
  retention_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (id) REFERENCES private_assets(id) ON DELETE CASCADE
);

CREATE INDEX applicant_resumes_owner_created_idx
  ON applicant_resumes (owner_subject, created_at);
CREATE INDEX applicant_resumes_retention_idx
  ON applicant_resumes (retention_expires_at);

CREATE TABLE resume_extractions (
  resume_id TEXT PRIMARY KEY REFERENCES applicant_resumes(id) ON DELETE CASCADE,
  extracted_text TEXT NOT NULL,
  suggestions_json TEXT NOT NULL,
  extracted_at TEXT NOT NULL
);

CREATE TABLE application_resume_shares (
  application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  resume_id TEXT NOT NULL REFERENCES applicant_resumes(id) ON DELETE CASCADE,
  owner_subject TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX application_resume_shares_resume_idx
  ON application_resume_shares (resume_id);
