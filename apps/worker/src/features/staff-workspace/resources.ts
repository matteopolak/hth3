import {
  API_VERSION,
  type StaffSavedReport,
  type StaffSavedView,
} from "@civicresolve/contracts/v1";
import type { AuthenticatedActor } from "../../auth/identity.js";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

type Kind = "views" | "reports";
type SavedRow = {
  id: string;
  name: string;
  days: 7 | 30 | 90;
  status_filter: string;
  category_filter: string;
  group_by: "status" | "category" | "intent";
  version: number;
  created_at: string;
  updated_at: string;
};
const statuses = new Set([
  "submitted",
  "acknowledged",
  "in_review",
  "waiting_on_resident",
  "outcome_recorded",
  "closed",
  "reopened",
]);
const days = new Set([7, 30, 90]);
const groups = new Set(["status", "category", "intent"]);

export async function handleSavedWorkspaceResource(
  request: Request,
  url: URL,
  context: FeatureContext,
  actor: AuthenticatedActor,
  organizationId: string,
  kind: Kind,
  rest: string,
): Promise<Response> {
  const table = kind === "views" ? "staff_saved_views" : "staff_saved_reports";
  const collection = rest === "";
  const match = rest.match(/^\/([a-z0-9_-]+)(?:\/(result))?$/);
  if (!collection && !match)
    return featureError(context, "NOT_FOUND", "Saved item not found.", 404);
  const id = match?.[1];
  const isResult = match?.[2] === "result";
  if (request.method === "GET" && collection) {
    const response = await context.env.DB.prepare(
      `SELECT * FROM ${table} WHERE organization_id = ? AND owner_subject = ? ORDER BY updated_at DESC LIMIT 100`,
    )
      .bind(organizationId, actor.subject)
      .all<SavedRow>();
    return featureJson(context, {
      apiVersion: API_VERSION,
      [kind]: (response.results ?? []).map((row) => viewRow(kind, row)),
    });
  }
  if (request.method === "GET" && id) {
    const row = await loadRow(
      context,
      table,
      id,
      organizationId,
      actor.subject,
    );
    if (!row)
      return featureError(context, "NOT_FOUND", "Saved item not found.", 404);
    if (!isResult)
      return featureJson(context, {
        apiVersion: API_VERSION,
        [kind === "views" ? "view" : "report"]: viewRow(kind, row),
      });
    return kind === "views"
      ? viewResult(context, organizationId, row)
      : reportResult(context, organizationId, row);
  }
  if (!collection && isResult)
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);
  if (!(["POST", "PATCH", "DELETE"] as string[]).includes(request.method))
    return featureError(
      context,
      "METHOD_NOT_ALLOWED",
      "Unsupported method.",
      405,
    );
  if ((request.method === "POST") !== collection)
    return featureError(
      context,
      "METHOD_NOT_ALLOWED",
      "Use POST on collection or PATCH/DELETE on item.",
      405,
    );
  const key = request.headers.get("Idempotency-Key");
  if (!key || key.length < 16 || key.length > 128)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide an Idempotency-Key.",
      400,
    );
  const body =
    request.method === "DELETE"
      ? await request.json().catch(() => null)
      : await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a JSON body.",
      400,
    );
  const payload = body as Record<string, unknown>;
  const scopedKey = `workspace:${kind}:${organizationId}:${actor.subject}:${key}`;
  const hash = await digest(
    JSON.stringify({ method: request.method, path: url.pathname, payload }),
  );
  const prior = await context.env.DB.prepare(
    "SELECT request_hash, response_json FROM idempotency_records WHERE idempotency_key = ?",
  )
    .bind(scopedKey)
    .first<{ request_hash: string; response_json: string }>();
  if (prior)
    return prior.request_hash === hash
      ? featureJson(context, JSON.parse(prior.response_json) as unknown)
      : featureError(
          context,
          "IDEMPOTENCY_CONFLICT",
          "This request key was used for different content.",
          409,
        );
  const expectedVersion = Number(payload.expectedVersion);
  const existing = id
    ? await loadRow(context, table, id, organizationId, actor.subject)
    : null;
  if (id && !existing)
    return featureError(context, "NOT_FOUND", "Saved item not found.", 404);
  if (
    id &&
    (!Number.isInteger(expectedVersion) ||
      expectedVersion !== existing!.version)
  )
    return featureError(
      context,
      "STALE_VERSION",
      "Refresh this item before changing it.",
      409,
    );
  if (request.method !== "DELETE" && !validDefinition(kind, payload))
    return featureError(
      context,
      "INVALID_REQUEST",
      "Check the name, window, and filters.",
      400,
    );
  const now = new Date().toISOString();
  const itemId = id ?? (await stableWorkspaceItemId(kind, scopedKey));
  const definition =
    request.method === "DELETE"
      ? existing!
      : {
          id: itemId,
          name: String(payload.name).trim(),
          days: payload.days as 7 | 30 | 90,
          status_filter: kind === "views" ? String(payload.status ?? "") : "",
          category_filter:
            kind === "views" ? String(payload.category ?? "") : "",
          group_by:
            kind === "reports"
              ? (payload.groupBy as SavedRow["group_by"])
              : ("status" as const),
          version: (existing?.version ?? 0) + 1,
          created_at: existing?.created_at ?? now,
          updated_at: now,
        };
  const result =
    request.method === "DELETE"
      ? { apiVersion: API_VERSION, deletedId: itemId }
      : {
          apiVersion: API_VERSION,
          [kind === "views" ? "view" : "report"]: viewRow(kind, definition),
        };
  const db = context.env.DB;
  const operation =
    request.method === "POST"
      ? kind === "views"
        ? db
            .prepare(
              `INSERT OR IGNORE INTO staff_saved_views (id,organization_id,owner_subject,name,days,status_filter,category_filter,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            )
            .bind(
              itemId,
              organizationId,
              actor.subject,
              definition.name,
              definition.days,
              definition.status_filter,
              definition.category_filter,
              1,
              now,
              now,
            )
        : db
            .prepare(
              `INSERT OR IGNORE INTO staff_saved_reports (id,organization_id,owner_subject,name,days,group_by,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
            )
            .bind(
              itemId,
              organizationId,
              actor.subject,
              definition.name,
              definition.days,
              definition.group_by,
              1,
              now,
              now,
            )
      : request.method === "DELETE"
        ? db
            .prepare(
              `DELETE FROM ${table} WHERE id = ? AND organization_id = ? AND owner_subject = ? AND version = ?`,
            )
            .bind(itemId, organizationId, actor.subject, expectedVersion)
        : kind === "views"
          ? db
              .prepare(
                `UPDATE staff_saved_views SET name=?,days=?,status_filter=?,category_filter=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND owner_subject=? AND version=?`,
              )
              .bind(
                definition.name,
                definition.days,
                definition.status_filter,
                definition.category_filter,
                now,
                itemId,
                organizationId,
                actor.subject,
                expectedVersion,
              )
          : db
              .prepare(
                `UPDATE staff_saved_reports SET name=?,days=?,group_by=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND owner_subject=? AND version=?`,
              )
              .bind(
                definition.name,
                definition.days,
                definition.group_by,
                now,
                itemId,
                organizationId,
                actor.subject,
                expectedVersion,
              );
  const writes = await db.batch([
    operation,
    db
      .prepare(
        `INSERT OR IGNORE INTO idempotency_records (idempotency_key,request_hash,aggregate_type,aggregate_id,response_json,created_at) SELECT ?,?,?,?,?,? WHERE changes() = 1`,
      )
      .bind(scopedKey, hash, kind, itemId, JSON.stringify(result), now),
    db
      .prepare(
        `INSERT INTO audit_events (id,actor_subject,organization_id,action,entity_type,entity_id,details_json,created_at) SELECT ?,?,?,?,?,?,'{}',? WHERE changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        actor.subject,
        organizationId,
        `workspace.${kind}.${request.method.toLowerCase()}`,
        kind === "views" ? "staff_saved_view" : "staff_saved_report",
        itemId,
        now,
      ),
  ]);
  if (!writes[0]?.meta?.changes) {
    const concurrent = await db
      .prepare(
        "SELECT request_hash,response_json FROM idempotency_records WHERE idempotency_key = ?",
      )
      .bind(scopedKey)
      .first<{ request_hash: string; response_json: string }>();
    if (concurrent)
      return concurrent.request_hash === hash
        ? featureJson(context, JSON.parse(concurrent.response_json) as unknown)
        : featureError(
            context,
            "IDEMPOTENCY_CONFLICT",
            "This request key was used for different content.",
            409,
          );
    return featureError(
      context,
      "STALE_VERSION",
      "Refresh this item before changing it.",
      409,
    );
  }
  return featureJson(context, result, request.method === "POST" ? 201 : 200);
}

function validDefinition(kind: Kind, body: Record<string, unknown>): boolean {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 80 || !days.has(body.days as number))
    return false;
  if (kind === "reports") return groups.has(body.groupBy as string);
  const status = body.status ?? "";
  const category = body.category ?? "";
  return (
    (status === "" || statuses.has(status as string)) &&
    typeof category === "string" &&
    (category === "" || /^[a-zA-Z0-9_-]{1,80}$/.test(category))
  );
}

async function loadRow(
  context: FeatureContext,
  table: string,
  id: string,
  organizationId: string,
  subject: string,
): Promise<SavedRow | null> {
  return context.env.DB.prepare(
    `SELECT * FROM ${table} WHERE id = ? AND organization_id = ? AND owner_subject = ?`,
  )
    .bind(id, organizationId, subject)
    .first<SavedRow>();
}

function viewRow(kind: Kind, row: SavedRow): StaffSavedView | StaffSavedReport {
  const common = {
    id: row.id,
    name: row.name,
    days: row.days,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return kind === "views"
    ? { ...common, status: row.status_filter, category: row.category_filter }
    : { ...common, groupBy: row.group_by };
}

async function viewResult(
  context: FeatureContext,
  organizationId: string,
  row: SavedRow,
): Promise<Response> {
  const since = new Date(Date.now() - row.days * 86_400_000).toISOString();
  const filters = `${row.status_filter ? " AND status = ?" : ""}${row.category_filter ? " AND COALESCE(category_id, category) = ?" : ""}`;
  const args = [
    organizationId,
    since,
    ...(row.status_filter ? [row.status_filter] : []),
    ...(row.category_filter ? [row.category_filter] : []),
  ];
  const db = context.env.DB;
  const total = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM feedback_submissions WHERE organization_id = ? AND created_at >= ?${filters}`,
    )
    .bind(...args)
    .first<{ count: number }>();
  const rows = await db
    .prepare(
      `SELECT id,status,COALESCE(category_id,category,'') AS category,created_at FROM feedback_submissions WHERE organization_id = ? AND created_at >= ?${filters} ORDER BY created_at DESC LIMIT 100`,
    )
    .bind(...args)
    .all<{
      id: string;
      status: string;
      category: string;
      created_at: string;
    }>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    total: total?.count ?? 0,
    submissions: (rows.results ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      category: item.category,
      createdAt: item.created_at,
    })),
    generatedAt: new Date().toISOString(),
  });
}

async function reportResult(
  context: FeatureContext,
  organizationId: string,
  row: SavedRow,
): Promise<Response> {
  const since = new Date(Date.now() - row.days * 86_400_000).toISOString();
  const dimension =
    row.group_by === "category"
      ? "COALESCE(category_id,category,'unclassified')"
      : row.group_by === "intent"
        ? "COALESCE(intent,'unclassified')"
        : "status";
  const db = context.env.DB;
  const grouped = await db
    .prepare(
      `SELECT ${dimension} AS key,COUNT(*) AS count FROM feedback_submissions WHERE organization_id=? AND created_at>=? GROUP BY key ORDER BY count DESC,key`,
    )
    .bind(organizationId, since)
    .all<{ key: string; count: number }>();
  const sources = await db
    .prepare(
      "SELECT id FROM feedback_submissions WHERE organization_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 20",
    )
    .bind(organizationId, since)
    .all<{ id: string }>();
  const rows = grouped.results ?? [];
  return featureJson(context, {
    apiVersion: API_VERSION,
    total: rows.reduce((sum, item) => sum + item.count, 0),
    rows,
    sourceIds: (sources.results ?? []).map((item) => item.id),
    generatedAt: new Date().toISOString(),
  });
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function stableWorkspaceItemId(
  kind: Kind,
  scopedKey: string,
): Promise<string> {
  return `${kind === "views" ? "sview" : "sreport"}_${(await digest(scopedKey)).slice(0, 32)}`;
}
