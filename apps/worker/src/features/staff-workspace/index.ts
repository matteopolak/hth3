import {
  API_VERSION,
  type StaffAuditEvent,
  type StaffWorkspaceSummary,
} from "@civicresolve/contracts/v1";
import {
  canPerformGlobalAction,
  canPerformOrganizationAction,
} from "@civicresolve/domain/permissions";
import { authenticateRequest } from "../../auth/identity.js";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export async function handleStaffWorkspaceRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  const match = url.pathname.match(
    /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/workspace$/,
  );
  if (!match) return null;
  if (request.method !== "GET")
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);

  const organizationId = match[1]!;
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (actor.organizationId !== organizationId)
    return featureError(
      context,
      "FORBIDDEN",
      "This organization is unavailable.",
      403,
    );

  const capabilities = {
    feedbackRead: canPerformOrganizationAction(
      actor,
      "feedback:read_organization",
      organizationId,
    ),
    feedbackRespond: canPerformOrganizationAction(
      actor,
      "feedback:respond_organization",
      organizationId,
    ),
    applicantReview: canPerformOrganizationAction(
      actor,
      "application:review_organization",
      organizationId,
    ),
    postingManage: canPerformOrganizationAction(
      actor,
      "posting:manage_organization",
      organizationId,
    ),
    taxonomyManage: canPerformGlobalAction(actor, "taxonomy:manage"),
    auditRead:
      canPerformOrganizationAction(
        actor,
        "organization:manage_own",
        organizationId,
      ) || canPerformGlobalAction(actor, "organization:manage_all"),
  };
  if (!Object.values(capabilities).some(Boolean))
    return featureError(
      context,
      "FORBIDDEN",
      "No staff workspace access.",
      403,
    );

  let auditEvents: StaffAuditEvent[] = [];
  if (capabilities.auditRead) {
    const audit = await context.env.DB.prepare(
      `SELECT id, action, entity_type, entity_id, created_at
       FROM audit_events WHERE organization_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 50`,
    )
      .bind(organizationId)
      .all<AuditRow>();
    auditEvents = (audit.results ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
    }));
  }

  return featureJson(context, {
    apiVersion: API_VERSION,
    organizationId,
    capabilities,
    auditEvents,
  } satisfies StaffWorkspaceSummary);
}
