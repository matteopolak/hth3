CREATE TABLE feedback_themes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  category_id TEXT NOT NULL,
  topic_key TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  summary_fr TEXT NOT NULL,
  summary_source_ids_json TEXT NOT NULL DEFAULT '[]',
  summary_source_count INTEGER NOT NULL DEFAULT 0,
  summary_generated_at TEXT,
  summary_method TEXT NOT NULL DEFAULT 'deterministic',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, category_id, topic_key)
);

CREATE INDEX feedback_themes_org_category_idx
  ON feedback_themes (organization_id, category_id);

CREATE TABLE feedback_theme_memberships (
  submission_id TEXT PRIMARY KEY REFERENCES feedback_submissions(id),
  theme_id TEXT NOT NULL REFERENCES feedback_themes(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  source TEXT NOT NULL DEFAULT 'automatic' CHECK (source IN ('automatic', 'staff')),
  created_at TEXT NOT NULL
);

CREATE INDEX feedback_theme_memberships_theme_idx
  ON feedback_theme_memberships (theme_id, submission_id);
