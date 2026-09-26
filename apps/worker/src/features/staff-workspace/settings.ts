import {
  API_VERSION,
  type StaffDefaultView,
  type StaffWorkspaceCapabilities,
  type StaffWorkspaceSettings,
} from "@civicresolve/contracts/v1";
import { canPerformOrganizationAction } from "@civicresolve/domain/permissions";
import type { AuthenticatedActor } from "../../auth/identity.js";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

interface PersonalRow {
  default_view: StaffDefaultView;
  version: number;
  updated_at: string;
}
interface OrganizationRow {
  reporting_window_days: 7 | 30 | 90;
  version: number;
  updated_at: string;
}

export async function handleWorkspaceSettings(
  request: Request,
  context: FeatureContext,
  actor: AuthenticatedActor,
  organizationId: string,
  capabilities: StaffWorkspaceCapabilities,
): Promise<Response> {
  if (request.method === "GET")
    return featureJson(context, {
      apiVersion: API_VERSION,
      settings: await loadSettings(context, organizationId, actor.subject),
    });
  if (request.method !== "PATCH")
    return featureError(
      context,
      "METHOD_NOT_ALLOWED",
      "Use GET or PATCH.",
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
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object")
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a JSON body.",
      400,
    );
  const changingView = Object.hasOwn(body, "defaultView");
  const changingWindow = Object.hasOwn(body, "reportingWindowDays");
  if (changingView === changingWindow)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Change one setting at a time.",
      400,
    );
  if (
    changingWindow &&
    !canPerformOrganizationAction(
      actor,
      "organization:manage_own",
      organizationId,
    )
  )
    return featureError(
      context,
      "FORBIDDEN",
      "Organization administration is required.",
      403,
    );
  if (changingView && !allowedView(body.defaultView, capabilities))
    return featureError(
      context,
      "FORBIDDEN",
      "This default view is unavailable to your role.",
      403,
    );
  if (
    changingWindow &&
    ![7, 30, 90].includes(body.reportingWindowDays as number)
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Choose a 7, 30, or 90 day window.",
      400,
    );
  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide the current version.",
      400,
    );
  const scopedKey = `workspace:settings:${organizationId}:${actor.subject}:${key}`;
  const hash = await digest(JSON.stringify(body));
  const db = context.env.DB;
  const replay = await db
    .prepare(
      "SELECT request_hash,response_json FROM idempotency_records WHERE idempotency_key=?",
    )
    .bind(scopedKey)
    .first<{ request_hash: string; response_json: string }>();
  if (replay)
    return replay.request_hash === hash
      ? featureJson(context, JSON.parse(replay.response_json) as unknown)
      : featureError(
          context,
          "IDEMPOTENCY_CONFLICT",
          "This request key was used for different content.",
          409,
        );
  const current = await loadSettings(context, organizationId, actor.subject);
  if (
    expectedVersion !==
    (changingView ? current.personalVersion : current.organizationVersion)
  )
    return featureError(
      context,
      "STALE_VERSION",
      "Refresh settings before changing them.",
      409,
    );
  const now = new Date().toISOString();
  const result = {
    apiVersion: API_VERSION,
    settings: {
      ...current,
      ...(changingView
        ? {
            defaultView: body.defaultView as StaffDefaultView,
            personalVersion: expectedVersion + 1,
          }
        : {
            reportingWindowDays: body.reportingWindowDays as 7 | 30 | 90,
            organizationVersion: expectedVersion + 1,
          }),
      updatedAt: now,
    } satisfies StaffWorkspaceSettings,
  };
  const operation = changingView
    ? db
        .prepare(
          `INSERT INTO staff_workspace_preferences (organization_id,owner_subject,default_view,version,updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT (organization_id,owner_subject) DO UPDATE SET default_view=excluded.default_view,version=version+1,updated_at=excluded.updated_at WHERE version=?`,
        )
        .bind(
          organizationId,
          actor.subject,
          body.defaultView as string,
          1,
          now,
          expectedVersion,
        )
    : db
        .prepare(
          `INSERT INTO staff_workspace_settings (organization_id,reporting_window_days,version,updated_at) VALUES (?,?,?,?)
        ON CONFLICT (organization_id) DO UPDATE SET reporting_window_days=excluded.reporting_window_days,version=version+1,updated_at=excluded.updated_at WHERE version=?`,
        )
        .bind(
          organizationId,
          body.reportingWindowDays as number,
          1,
          now,
          expectedVersion,
        );
  const writes = await db.batch([
    operation,
    db
      .prepare(
        `INSERT INTO idempotency_records (idempotency_key,request_hash,aggregate_type,aggregate_id,response_json,created_at) SELECT ?,?,?,?,?,? WHERE changes() = 1`,
      )
      .bind(
        scopedKey,
        hash,
        "staff_workspace_settings",
        changingView ? actor.subject : organizationId,
        JSON.stringify(result),
        now,
      ),
    db
      .prepare(
        `INSERT INTO audit_events (id,actor_subject,organization_id,action,entity_type,entity_id,details_json,created_at) SELECT ?,?,?,?,?,?,'{}',? WHERE changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        actor.subject,
        organizationId,
        changingView
          ? "workspace.default_view_changed"
          : "workspace.reporting_window_changed",
        "staff_workspace_settings",
        changingView ? actor.subject : organizationId,
        now,
      ),
  ]);
  if (!writes[0]?.meta?.changes)
    return featureError(
      context,
      "STALE_VERSION",
      "Refresh settings before changing them.",
      409,
    );
  return featureJson(context, result);
}

export async function loadSettings(
  context: FeatureContext,
  organizationId: string,
  subject: string,
): Promise<StaffWorkspaceSettings> {
  const db = context.env.DB;
  const [personal, organization] = await Promise.all([
    db
      .prepare(
        "SELECT default_view,version,updated_at FROM staff_workspace_preferences WHERE organization_id=? AND owner_subject=?",
      )
      .bind(organizationId, subject)
      .first<PersonalRow>(),
    db
      .prepare(
        "SELECT reporting_window_days,version,updated_at FROM staff_workspace_settings WHERE organization_id=?",
      )
      .bind(organizationId)
      .first<OrganizationRow>(),
  ]);
  return {
    defaultView: personal?.default_view ?? "assistant",
    personalVersion: personal?.version ?? 0,
    reportingWindowDays: organization?.reporting_window_days ?? 30,
    organizationVersion: organization?.version ?? 0,
    updatedAt: personal?.updated_at ?? organization?.updated_at ?? null,
  };
}

function allowedView(
  view: unknown,
  capabilities: StaffWorkspaceCapabilities,
): boolean {
  if (view === "assistant" || view === "settings") return true;
  if (
    ["issues", "overview", "themes", "analytics", "views", "reports"].includes(
      view as string,
    )
  )
    return capabilities.feedbackRead;
  if (view === "hiring") return capabilities.postingManage;
  if (view === "applicants") return capabilities.applicantReview;
  if (view === "taxonomy") return capabilities.taxonomyManage;
  if (view === "audit") return capabilities.auditRead;
  return false;
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
