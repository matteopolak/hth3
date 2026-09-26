INSERT OR IGNORE INTO organizations (
  id, auth0_org_id, slug, display_name, jurisdiction_name, jurisdiction_region,
  sample, verification_status, created_at
) VALUES (
  'org_local_other',
  'org_local_other',
  'civicresolve-local-other-sandbox',
  'CivicResolve Other Local Sandbox (Fictional, unaffiliated)',
  'Victoria',
  'British Columbia',
  1,
  'unverified',
  '2026-09-26T00:00:00.000Z'
);

INSERT OR IGNORE INTO organization_memberships (
  user_subject, organization_id, role, created_at
) VALUES
  ('local:civic-staff', 'org_43G1B1RhPwac7EjS', 'civic_staff', '2026-09-26T00:00:00.000Z'),
  ('local:hiring-reviewer', 'org_43G1B1RhPwac7EjS', 'hiring_reviewer', '2026-09-26T00:00:00.000Z'),
  ('local:organization-admin', 'org_43G1B1RhPwac7EjS', 'organization_admin', '2026-09-26T00:00:00.000Z'),
  ('local:curator', 'org_43G1B1RhPwac7EjS', 'curator', '2026-09-26T00:00:00.000Z'),
  ('local:other-civic-staff', 'org_local_other', 'civic_staff', '2026-09-26T00:00:00.000Z');
