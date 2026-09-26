ALTER TABLE feedback_submissions
  ADD COLUMN organization_id TEXT REFERENCES organizations(id);

CREATE INDEX feedback_submissions_org_status_created_idx
  ON feedback_submissions (organization_id, status, created_at);
