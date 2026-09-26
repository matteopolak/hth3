import { API_VERSION, type FeedbackStatus } from "@civicresolve/contracts/v1";
import {
  canTransitionFeedback,
  FEEDBACK_TRANSITIONS,
} from "@civicresolve/domain/feedback";
import { canPerformOrganizationAction } from "@civicresolve/domain/permissions";
import { authenticateRequest } from "../../auth/identity.js";
import {
  featureError,
  featureJson,
  findIdempotentResponse,
  idempotencyStatement,
  insertAudit,
  insertMessage,
  jsonBody,
  messageView,
  normalizedMessage,
  outboxStatement,
  parseIdempotencyKey,
  scopedIdempotencyKey,
  sha256Hex,
  stableId,
} from "./common.js";
import { downloadEvidence, evidenceView, listEvidence } from "./evidence.js";
import {
  loadFeedbackForOrganization,
  loadMessage,
  loadMessages,
} from "./repository.js";
import type {
  FeedbackContext,
  FeedbackMessageBody,
  FeedbackRow,
  FeedbackStatusBody,
  IdempotentFeedbackResponse,
} from "./types.js";
import { MAX_OUTCOME_LENGTH, STAFF_FEEDBACK_ACTIONS } from "./types.js";

export async function handleStaffFeedback(
  request: Request,
  match: RegExpMatchArray,
  context: FeedbackContext,
): Promise<Response> {
  const organizationId = match[1]!;
  const submissionId = match[2];
  const action = match[3];
  const assetId = match[4];
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "A valid access token is required.",
      401,
    );
  const roleAction = request.method === "GET" ? "read" : "respond";
  if (
    !canPerformOrganizationAction(
      actor,
      STAFF_FEEDBACK_ACTIONS[roleAction],
      organizationId,
    )
  ) {
    return featureError(
      context,
      "FORBIDDEN",
      "This action is not allowed for your organization role.",
      403,
    );
  }

  if (!submissionId && !action && !assetId && request.method === "GET")
    return listStaffFeedback(organizationId, context);
  if (submissionId && !action && !assetId && request.method === "GET")
    return getStaffFeedback(organizationId, submissionId, context);
  if (
    submissionId &&
    action === "messages" &&
    !assetId &&
    request.method === "GET"
  )
    return listStaffMessages(organizationId, submissionId, context);
  if (
    submissionId &&
    action === "messages" &&
    !assetId &&
    request.method === "POST"
  )
    return addStaffMessage(
      request,
      organizationId,
      submissionId,
      actor,
      context,
    );
  if (
    submissionId &&
    action === "status" &&
    !assetId &&
    request.method === "PATCH"
  )
    return changeFeedbackStatus(
      request,
      organizationId,
      submissionId,
      actor,
      context,
    );
  if (
    submissionId &&
    action === "attachments" &&
    assetId &&
    request.method === "GET"
  )
    return getStaffEvidence(organizationId, submissionId, assetId, context);
  return featureError(
    context,
    "METHOD_NOT_ALLOWED",
    "Unsupported action.",
    405,
  );
}

async function listStaffFeedback(
  organizationId: string,
  context: FeedbackContext,
): Promise<Response> {
  const rows = await context.env.DB.prepare(
    `SELECT f.id, f.original_text, f.constructive_follow_up,
      COALESCE(f.category_id, f.category) AS category,
      f.intent, f.classification_review_status,
      f.municipality_csd_uid, m.name AS municipality_name,
      m.province_name, f.status,
      COALESCE(d.routing_label, f.department_name) AS department_name,
      f.outcome, f.sample, f.created_at, f.updated_at,
      (SELECT COUNT(*) FROM private_assets AS a
        WHERE a.purpose = 'feedback_attachment' AND a.record_id = f.id) AS evidence_count
     FROM feedback_submissions AS f
     LEFT JOIN municipality_geographies AS m ON m.csd_uid = f.municipality_csd_uid
     LEFT JOIN feedback_destinations AS d
       ON d.organization_id = f.organization_id
      AND d.municipality_csd_uid = f.municipality_csd_uid
     WHERE f.organization_id = ?
     ORDER BY f.created_at DESC LIMIT 50`,
  )
    .bind(organizationId)
    .all<FeedbackRow & { evidence_count: number }>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    submissions: (rows.results ?? []).map((row) => ({
      id: row.id,
      originalText: row.original_text,
      constructiveFollowUp: row.constructive_follow_up ?? null,
      category: row.category,
      intent: row.intent ?? null,
      classificationReviewStatus: row.classification_review_status ?? null,
      municipality: row.municipality_csd_uid
        ? {
            id: row.municipality_csd_uid,
            name: row.municipality_name,
            province: row.province_name,
          }
        : null,
      status: row.status,
      departmentName: row.department_name,
      sample: row.sample === 1,
      evidenceCount: row.evidence_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

async function getStaffFeedback(
  organizationId: string,
  submissionId: string,
  context: FeedbackContext,
): Promise<Response> {
  const feedback = await loadFeedbackForOrganization(
    context.env.DB,
    submissionId,
    organizationId,
  );
  if (!feedback)
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  const [messages, evidence] = await Promise.all([
    loadMessages(context.env.DB, submissionId),
    listEvidence(context.env.DB, submissionId),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    submission: staffFeedbackView(
      feedback,
      messages,
      evidence.map(evidenceView),
    ),
  });
}

async function listStaffMessages(
  organizationId: string,
  submissionId: string,
  context: FeedbackContext,
): Promise<Response> {
  const feedback = await loadFeedbackForOrganization(
    context.env.DB,
    submissionId,
    organizationId,
  );
  if (!feedback)
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  const messages = await loadMessages(context.env.DB, submissionId);
  return featureJson(context, {
    apiVersion: API_VERSION,
    messages: messages.map(messageView),
  });
}

async function getStaffEvidence(
  organizationId: string,
  submissionId: string,
  assetId: string,
  context: FeedbackContext,
): Promise<Response> {
  const feedback = await loadFeedbackForOrganization(
    context.env.DB,
    submissionId,
    organizationId,
  );
  if (!feedback)
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  const response = await downloadEvidence(context, {
    submissionId,
    assetId,
    organizationId,
  });
  return (
    response ?? featureError(context, "NOT_FOUND", "Evidence not found.", 404)
  );
}

async function addStaffMessage(
  request: Request,
  organizationId: string,
  submissionId: string,
  actor: NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>,
  context: FeedbackContext,
): Promise<Response> {
  const feedback = await loadFeedbackForOrganization(
    context.env.DB,
    submissionId,
    organizationId,
  );
  if (!feedback)
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  const body = await jsonBody<FeedbackMessageBody>(request);
  const message = normalizedMessage(body?.message);
  const clientKey = parseIdempotencyKey(request);
  if (!message || !clientKey)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a response and an Idempotency-Key.",
      400,
    );

  const database = context.env.DB;
  const idempotencyKey = scopedIdempotencyKey(
    `feedback:staff-message:${submissionId}`,
    actor.subject,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ submissionId, organizationId, message }),
  );
  const replay = await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  );
  const messageId =
    (replay as IdempotentFeedbackResponse | null)?.messageId ??
    (await stableId("fbm", idempotencyKey));
  if (!replay) {
    if (feedback.status === "closed")
      return featureError(
        context,
        "FEEDBACK_CLOSED",
        "This feedback thread is closed.",
        409,
      );
    const now = new Date().toISOString();
    const auditId = await stableId("audit", `${idempotencyKey}:message`);
    const eventKey = `feedback.message_added:${idempotencyKey}`;
    const eventId = await stableId("evt", eventKey);
    await database.batch([
      insertMessage(database, {
        id: messageId,
        submissionId,
        authorKind: "staff",
        authorSubject: actor.subject,
        body: message,
        createdAt: now,
        organizationId,
      }),
      insertAudit(database, {
        id: auditId,
        subject: actor.subject,
        organizationId,
        action: "feedback_message_added",
        entityId: submissionId,
        details: { author: "staff", messageLength: message.length },
        createdAt: now,
        onlyIfPreviousChange: true,
      }),
      outboxStatement(database, {
        eventId,
        eventType: "feedback.message_added",
        occurredAt: now,
        actorKind: "staff",
        actorSubject: actor.subject,
        organizationId,
        aggregateType: "feedback_submission",
        aggregateId: submissionId,
        idempotencyKey: eventKey,
        payload: { author: "staff", messageLength: message.length },
      }),
      idempotencyStatement(database, {
        key: idempotencyKey,
        requestHash,
        aggregateType: "feedback_message",
        aggregateId: messageId,
        response: { messageId },
        createdAt: now,
      }),
    ]);
  }

  const saved = await loadMessage(database, submissionId, messageId);
  if (!saved)
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  return featureJson(context, {
    apiVersion: API_VERSION,
    message: messageView(saved),
  });
}

async function changeFeedbackStatus(
  request: Request,
  organizationId: string,
  submissionId: string,
  actor: NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>,
  context: FeedbackContext,
): Promise<Response> {
  const body = await jsonBody<FeedbackStatusBody>(request);
  const nextStatus = body?.status;
  const outcome = typeof body?.outcome === "string" ? body.outcome.trim() : "";
  const clientKey = parseIdempotencyKey(request);
  if (
    typeof nextStatus !== "string" ||
    !Object.hasOwn(FEEDBACK_TRANSITIONS, nextStatus) ||
    (nextStatus === "outcome_recorded" && outcome.length === 0) ||
    outcome.length > MAX_OUTCOME_LENGTH ||
    (outcome.length > 0 && nextStatus !== "outcome_recorded") ||
    !clientKey
  ) {
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a valid status transition and an outcome when recording one.",
      400,
    );
  }

  const next = nextStatus as FeedbackStatus;
  const idempotencyKey = scopedIdempotencyKey(
    `feedback:status:${submissionId}`,
    actor.subject,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ submissionId, organizationId, status: next, outcome }),
  );
  const replay = await findIdempotentResponse(
    context.env.DB,
    idempotencyKey,
    requestHash,
  );
  if (replay)
    return featureJson(context, {
      apiVersion: API_VERSION,
      submission: replay,
    });

  const current = await loadFeedbackForOrganization(
    context.env.DB,
    submissionId,
    organizationId,
  );
  if (!current)
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  if (!canTransitionFeedback(current.status, next))
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      `Feedback cannot move from ${current.status} to ${next}.`,
      409,
    );

  const now = new Date().toISOString();
  const responseBody = { id: submissionId, status: next };
  const auditId = await stableId("audit", `${idempotencyKey}:status`);
  const eventKey = `feedback.status_changed:${idempotencyKey}`;
  const eventId = await stableId("evt", eventKey);
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE feedback_submissions SET status = ?, outcome = COALESCE(?, outcome), updated_at = ?
       WHERE id = ? AND organization_id = ? AND status = ?`,
    ).bind(
      next,
      outcome || null,
      now,
      submissionId,
      organizationId,
      current.status,
    ),
    insertAudit(context.env.DB, {
      id: auditId,
      subject: actor.subject,
      organizationId,
      action: "feedback_status_changed",
      entityId: submissionId,
      details: {
        previousStatus: current.status,
        status: next,
        outcomeRecorded: next === "outcome_recorded",
      },
      createdAt: now,
      onlyIfPreviousChange: true,
    }),
    outboxStatement(context.env.DB, {
      eventId,
      eventType: "feedback.status_changed",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: eventKey,
      payload: { previousStatus: current.status, status: next },
    }),
    idempotencyStatement(context.env.DB, {
      key: idempotencyKey,
      requestHash,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      response: responseBody,
      createdAt: now,
    }),
  ]);

  const saved = await findIdempotentResponse(
    context.env.DB,
    idempotencyKey,
    requestHash,
  );
  if (!saved)
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "The feedback status changed before this update could be applied.",
      409,
    );
  return featureJson(context, { apiVersion: API_VERSION, submission: saved });
}

function staffFeedbackView(
  row: FeedbackRow,
  messages: Array<{
    id: string;
    author_kind: "resident" | "staff";
    body: string;
    created_at: string;
  }>,
  evidence: Array<{
    id: string;
    fileName: string;
    contentType: string;
    byteSize: number;
  }>,
) {
  return {
    id: row.id,
    originalText: row.original_text ?? "",
    constructiveFollowUp: row.constructive_follow_up ?? null,
    category: row.category ?? "other_or_unsure",
    intent: row.intent ?? null,
    classificationReviewStatus: row.classification_review_status ?? null,
    municipality: row.municipality_csd_uid
      ? {
          id: row.municipality_csd_uid,
          name: row.municipality_name ?? "Toronto",
          province: row.province_name ?? "Ontario",
        }
      : null,
    sample: row.sample === 1,
    destinationLabel: row.department_name,
    status: row.status,
    departmentName: row.department_name,
    outcome: row.outcome,
    messages: messages.map(messageView),
    evidence: evidence.map((item) => ({
      ...item,
      downloadPath: `/api/v1/staff/organizations/${row.organization_id}/feedback/${row.id}/attachments/${item.id}`,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
