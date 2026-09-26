CREATE TABLE feedback_staff_assignments (
  submission_id TEXT PRIMARY KEY REFERENCES feedback_submissions(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  department_id TEXT NOT NULL,
  assignee_subject TEXT CHECK (
    assignee_subject IS NULL OR length(assignee_subject) BETWEEN 1 AND 255
  ),
  assigned_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id, department_id)
    REFERENCES taxonomy_departments (organization_id, id)
);

CREATE INDEX feedback_staff_assignments_org_assignee_idx
  ON feedback_staff_assignments (organization_id, assignee_subject);
