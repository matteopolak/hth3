import type { D1Database } from "@civicresolve/db/d1";
import type {
  DepartmentJurisdictionLevel,
  TaxonomyDocument,
} from "@civicresolve/domain/taxonomy";

export interface TaxonomyVersionRow {
  id: string;
  organization_id: string;
  version: number;
  status: "draft" | "published" | "superseded";
  document_json: string;
  created_by: string;
  created_at: string;
  published_by: string | null;
  published_at: string | null;
}

export interface TaxonomyDepartmentRow {
  id: string;
  name_en: string;
  name_fr: string;
  active: number;
  jurisdiction_level: DepartmentJurisdictionLevel;
}

export async function loadVersion(
  database: D1Database,
  organizationId: string,
  status: "draft" | "published",
): Promise<TaxonomyVersionRow | null> {
  return database
    .prepare(
      `SELECT * FROM taxonomy_versions WHERE organization_id = ? AND status = ?`,
    )
    .bind(organizationId, status)
    .first<TaxonomyVersionRow>();
}

export async function loadDepartments(
  database: D1Database,
  organizationId: string,
): Promise<TaxonomyDepartmentRow[]> {
  const result = await database
    .prepare(
      `SELECT id, name_en, name_fr, active, jurisdiction_level FROM taxonomy_departments WHERE organization_id = ? ORDER BY id`,
    )
    .bind(organizationId)
    .all<TaxonomyDepartmentRow>();
  return result.results ?? [];
}

export function versionView(row: TaxonomyVersionRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    document: JSON.parse(row.document_json) as TaxonomyDocument,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

export async function organizationExists(
  database: D1Database,
  id: string,
): Promise<boolean> {
  return Boolean(
    await database
      .prepare("SELECT id FROM organizations WHERE id = ?")
      .bind(id)
      .first(),
  );
}

export async function isActiveOrganizationMember(
  database: D1Database,
  subject: string,
  organizationId: string,
  roles: readonly string[],
): Promise<boolean> {
  if (roles.length === 0) return false;
  const slots = roles.map(() => "?").join(",");
  return Boolean(
    await database
      .prepare(
        `SELECT 1 AS member FROM organization_memberships WHERE user_subject = ? AND organization_id = ? AND role IN (${slots}) LIMIT 1`,
      )
      .bind(subject, organizationId, ...roles)
      .first(),
  );
}
