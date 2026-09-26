CREATE TABLE staff_saved_views (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  owner_subject TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  days INTEGER NOT NULL CHECK (days IN (7, 30, 90)),
  status_filter TEXT NOT NULL DEFAULT '',
  category_filter TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX staff_saved_views_owner_idx ON staff_saved_views (organization_id, owner_subject, updated_at DESC);

CREATE TABLE staff_saved_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  owner_subject TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  days INTEGER NOT NULL CHECK (days IN (7, 30, 90)),
  group_by TEXT NOT NULL CHECK (group_by IN ('status', 'category', 'intent')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX staff_saved_reports_owner_idx ON staff_saved_reports (organization_id, owner_subject, updated_at DESC);

CREATE TABLE staff_workspace_preferences (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  owner_subject TEXT NOT NULL,
  default_view TEXT NOT NULL DEFAULT 'assistant',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, owner_subject)
);

CREATE TABLE staff_workspace_settings (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id),
  reporting_window_days INTEGER NOT NULL DEFAULT 30 CHECK (reporting_window_days IN (7, 30, 90)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
