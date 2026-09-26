import { API_VERSION, type FeedbackStatus } from "@civicresolve/contracts/v1";
import {
  canStaffRecordOutcome,
  canStaffRequestDetails,
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
  optionalFeedbackText,
  outboxStatement,
  parseIdempotencyKey,
  scopedIdempotencyKey,
  sha256Hex,
  stableId,
  validLocale,
} from "./common.js";
import { downloadEvidence, evidenceView, listEvidence } from "./evidence.js";
import {
  loadFeedbackForOrganization,
  loadMessage,
  loadMessages,
} from "./repository.js";
import type {
  FeedbackContext,
  FeedbackAssigneeRow,
  FeedbackAssignmentBody,
  FeedbackDepartmentRow,
  FeedbackMessageBody,
  FeedbackOutcomeBody,
  FeedbackRequestDetailsBody,
  FeedbackRow,
  FeedbackStaffAssignmentRow,
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
  const action = match[3] ?? match[5];
  const assetId = match[4];
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "A valid access token is required.",
      401,
    );
  const roleAction =
    request.method === "GET" && action !== "assignment-options"
      ? "read"
      : "respond";
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

  if (
    action === "assignment-options" &&
    !submissionId &&
    !assetId &&
    request.method === "GET"
  )
    return getFeedbackAssignmentOptions(request, organizationId, context);
  if (!submissionId && !action && !assetId && request.method === "GET")
    return listStaffFeedback(organizationId, context);
  if (submissionId && !action && !assetId && request.method === "GET")
    return getStaffFeedback(request, organizationId, submissionId, context);
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
    action === "assignment" &&
    !assetId &&
    request.method === "PATCH"
  )
    return assignFeedback(
      request,
      organizationId,
      submissionId,
      actor,
      context,
    );
  if (
    submissionId &&
    action === "request-details" &&
    !assetId &&
    request.method === "POST"
  )
    return requestResidentDetails(
      request,
      organizationId,
      submissionId,
      actor,
      context,
    );
  if (
    submissionId &&
    action === "outcome" &&
    !assetId &&
    request.method === "POST"
  )
    return recordFeedbackOutcome(
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

async function getFeedbackAssignmentOptions(
  request: Request,
  organizationId: string,
  context: FeedbackContext,
): Promise<Response> {
  const [departments, members] = await Promise.all([
    context.env.DB.prepare(
      `SELECT id, name_en, name_fr, jurisdiction_level
       FROM taxonomy_departments
       WHERE organization_id = ? AND active = 1
       ORDER BY name_en, id`,
    )
      .bind(organizationId)
      .all<FeedbackDepartmentRow>(),
    context.env.DB.prepare(
      `SELECT user_subject, role FROM organization_memberships
       WHERE organization_id = ? AND role IN ('civic_staff', 'organization_admin')
       ORDER BY user_subject, role`,
    )
      .bind(organizationId)
      .all<FeedbackAssigneeRow>(),
  ]);
  const assignees = new Map<string, Set<FeedbackAssigneeRow["role"]>>();
  for (const member of members.results ?? []) {
    const roles = assignees.get(member.user_subject) ?? new Set();
    roles.add(member.role);
    assignees.set(member.user_subject, roles);
  }
  const locale = validLocale(undefined, request);
  let staffNumber = 0;
  let adminNumber = 0;
  return featureJson(context, {
    apiVersion: API_VERSION,
    departments: (departments.results ?? []).map((department) => ({
      id: department.id,
      nameEn: department.name_en,
      nameFr: department.name_fr,
      jurisdictionLevel: department.jurisdiction_level,
    })),
    assignees: [...assignees.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([subject, roles]) => {
        const sortedRoles = [...roles].sort();
        const isCivicStaff = roles.has("civic_staff");
        const ordinal = isCivicStaff ? ++staffNumber : ++adminNumber;
        const displayLabel = isCivicStaff
          ? locale === "fr"
            ? `Membre du personnel civique ${ordinal}`
            : `Civic staff member ${ordinal}`
          : locale === "fr"
            ? `Responsable de l’organisation ${ordinal}`
            : `Organization admin ${ordinal}`;
        return { subject, roles: sortedRoles, displayLabel };
      }),
  });
}

async function getStaffFeedback(
  request: Request,
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
  const [messages, evidence, assignment] = await Promise.all([
    loadMessages(context.env.DB, submissionId),
    listEvidence(context.env.DB, submissionId),
    loadStaffAssignment(context, submissionId, organizationId),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    submission: staffFeedbackView(
      feedback,
      messages,
      evidence.map(evidenceView),
      assignment
        ? assignmentView(assignment, validLocale(undefined, request))
        : null,
    ),
  });
}

async function loadStaffAssignment(
  context: FeedbackContext,
  submissionId: string,
  organizationId: string,
): Promise<FeedbackStaffAssignmentRow | null> {
  return context.env.DB.prepare(
    `SELECT a.submission_id, a.organization_id, a.department_id,
      d.name_en AS department_name_en, d.name_fr AS department_name_fr,
      a.assignee_subject, a.assigned_by, a.updated_at
     FROM feedback_staff_assignments AS a
     JOIN taxonomy_departments AS d
       ON d.organization_id = a.organization_id AND d.id = a.department_id
     WHERE a.submission_id = ? AND a.organization_id = ?`,
  )
    .bind(submissionId, organizationId)
    .first<FeedbackStaffAssignmentRow>();
}

function assignmentView(
  assignment: FeedbackStaffAssignmentRow,
  locale: "en" | "fr",
) {
  return {
    departmentId: assignment.department_id,
    departmentName:
      locale === "fr"
        ? assignment.department_name_fr
        : assignment.department_name_en,
    assigneeSubject: assignment.assignee_subject,
    updatedAt: assignment.updated_at,
  };
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

async function assignFeedback(
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

  const body = await jsonBody<FeedbackAssignmentBody>(request);
  const departmentId = body?.departmentId;
  const assigneeSubject = body?.assigneeSubject;
  const clientKey = parseIdempotencyKey(request);
  const validSubject =
    assigneeSubject === null ||
    (typeof assigneeSubject === "string" &&
      assigneeSubject.length > 0 &&
      assigneeSubject.length <= 255 &&
      assigneeSubject.trim() === assigneeSubject &&
      !/[\u0000-\u001f\u007f]/.test(assigneeSubject));
  if (
    !body ||
    !Object.hasOwn(body, "assigneeSubject") ||
    typeof departmentId !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(departmentId) ||
    !validSubject ||
    !clientKey
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide an active department, an optional organization staff subject, and an Idempotency-Key.",
      400,
    );

  const idempotencyKey = scopedIdempotencyKey(
    `feedback:assignment:${submissionId}`,
    actor.subject,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({
      submissionId,
      organizationId,
      departmentId,
      assigneeSubject,
    }),
  );
  const replay = await findIdempotentResponse(
    context.env.DB,
    idempotencyKey,
    requestHash,
  );
  if (replay)
    return featureJson(context, {
      apiVersion: API_VERSION,
      ...asRecord(replay),
    });

  const department = await context.env.DB.prepare(
    `SELECT id, name_en, name_fr, active, jurisdiction_level
     FROM taxonomy_departments
     WHERE id = ? AND organization_id = ? AND active = 1`,
  )
    .bind(departmentId, organizationId)
    .first<FeedbackDepartmentRow & { active: number }>();
  if (!department)
    return featureError(
      context,
      "DEPARTMENT_NOT_AVAILABLE",
      "Choose an active department in this organization.",
      422,
    );

  if (typeof assigneeSubject === "string") {
    const member = await context.env.DB.prepare(
      `SELECT user_subject FROM organization_memberships
       WHERE user_subject = ? AND organization_id = ?
         AND role IN ('civic_staff', 'organization_admin') LIMIT 1`,
    )
      .bind(assigneeSubject, organizationId)
      .first<{ user_subject: string }>();
    if (!member)
      return featureError(
        context,
        "ASSIGNEE_NOT_ELIGIBLE",
        "Choose a civic staff member or organization administrator in this organization.",
        422,
      );
  }

  const locale = validLocale(undefined, request);
  const assignment = {
    departmentId: department.id,
    departmentName: locale === "fr" ? department.name_fr : department.name_en,
    assigneeSubject,
    updatedAt: new Date().toISOString(),
  };
  const now = assignment.updatedAt;
  const auditId = await stableId("audit", `${idempotencyKey}:assignment`);
  const eventKey = `feedback.assignment_changed:${idempotencyKey}`;
  const eventId = await stableId("evt", eventKey);
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO feedback_staff_assignments (
        submission_id, organization_id, department_id, assignee_subject,
        assigned_by, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (submission_id) DO UPDATE SET
        organization_id = excluded.organization_id,
        department_id = excluded.department_id,
        assignee_subject = excluded.assignee_subject,
        assigned_by = excluded.assigned_by,
        updated_at = excluded.updated_at`,
    ).bind(
      submissionId,
      organizationId,
      departmentId,
      assigneeSubject,
      actor.subject,
      now,
    ),
    context.env.DB.prepare(
      `UPDATE feedback_submissions SET updated_at = ?
       WHERE id = ? AND organization_id = ?`,
    ).bind(now, submissionId, organizationId),
    insertAudit(context.env.DB, {
      id: auditId,
      subject: actor.subject,
      organizationId,
      action: "feedback_assigned",
      entityId: submissionId,
      details: {
        departmentId,
        assigneeChanged: true,
        assigned: assigneeSubject !== null,
      },
      createdAt: now,
      onlyIfPreviousChange: true,
    }),
    outboxStatement(context.env.DB, {
      eventId,
      eventType: "feedback.assignment_changed",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: eventKey,
      payload: {
        departmentId,
        assigned: assigneeSubject !== null,
      },
    }),
    idempotencyStatement(context.env.DB, {
      key: idempotencyKey,
      requestHash,
      aggregateType: "feedback_staff_assignment",
      aggregateId: submissionId,
      response: { apiVersion: API_VERSION, assignment },
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
      "The feedback assignment could not be applied.",
      409,
    );
  return featureJson(context, asRecord(saved));
}

async function requestResidentDetails(
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
  const body = await jsonBody<FeedbackRequestDetailsBody>(request);
  const message = normalizedMessage(body?.message);
  const clientKey = parseIdempotencyKey(request);
  if (!message || !clientKey)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a resident-facing question and an Idempotency-Key.",
      400,
    );

  const idempotencyKey = scopedIdempotencyKey(
    `feedback:request-details:${submissionId}`,
    actor.subject,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ submissionId, organizationId, message }),
  );
  const replay = (await findIdempotentResponse(
    context.env.DB,
    idempotencyKey,
    requestHash,
  )) as (IdempotentFeedbackResponse & { status?: FeedbackStatus }) | null;
  if (replay) {
    const saved = replay.messageId
      ? await loadMessage(context.env.DB, submissionId, replay.messageId)
      : null;
    if (!saved)
      return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
    return featureJson(context, {
      apiVersion: API_VERSION,
      message: messageView(saved),
      submission: { id: submissionId, status: replay.status },
    });
  }
  if (!canStaffRequestDetails(feedback.status))
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      `Feedback cannot move from ${feedback.status} to waiting_on_resident.`,
      409,
    );

  const database = context.env.DB;
  const now = new Date().toISOString();
  const nextStatus: FeedbackStatus = "waiting_on_resident";
  const messageId = await stableId("fbm", `${idempotencyKey}:message`);
  const statusAuditId = await stableId("audit", `${idempotencyKey}:status`);
  const messageAuditId = await stableId("audit", `${idempotencyKey}:message`);
  const statusEventKey = `feedback.status_changed:${idempotencyKey}`;
  const messageEventKey = `feedback.message_added:${idempotencyKey}`;
  await database.batch([
    database
      .prepare(
        `UPDATE feedback_submissions
         SET status = ?, updated_at = ?
         WHERE id = ? AND organization_id = ? AND status = ?`,
      )
      .bind(nextStatus, now, submissionId, organizationId, feedback.status),
    insertAudit(database, {
      id: statusAuditId,
      subject: actor.subject,
      organizationId,
      action: "feedback_status_changed",
      entityId: submissionId,
      details: {
        previousStatus: feedback.status,
        status: nextStatus,
        detailsRequested: true,
      },
      createdAt: now,
      onlyIfPreviousChange: true,
    }),
    outboxStatement(database, {
      eventId: await stableId("evt", statusEventKey),
      eventType: "feedback.status_changed",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: statusEventKey,
      payload: { previousStatus: feedback.status, status: nextStatus },
    }),
    insertMessage(database, {
      id: messageId,
      submissionId,
      authorKind: "staff",
      authorSubject: actor.subject,
      body: message,
      createdAt: now,
      organizationId,
      onlyIfPreviousChange: true,
    }),
    insertAudit(database, {
      id: messageAuditId,
      subject: actor.subject,
      organizationId,
      action: "feedback_message_added",
      entityId: submissionId,
      details: {
        author: "staff",
        messageLength: message.length,
        detailsRequested: true,
      },
      createdAt: now,
      onlyIfPreviousChange: true,
    }),
    outboxStatement(database, {
      eventId: await stableId("evt", messageEventKey),
      eventType: "feedback.message_added",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: messageEventKey,
      payload: { author: "staff", messageLength: message.length },
    }),
    idempotencyStatement(database, {
      key: idempotencyKey,
      requestHash,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      response: { submissionId, messageId, status: nextStatus },
      createdAt: now,
    }),
  ]);
  const savedResult = (await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  )) as (IdempotentFeedbackResponse & { status?: FeedbackStatus }) | null;
  const savedMessage = savedResult?.messageId
    ? await loadMessage(database, submissionId, savedResult.messageId)
    : null;
  if (!savedResult || !savedMessage)
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "The case changed before the resident question could be recorded.",
      409,
    );
  return featureJson(context, {
    apiVersion: API_VERSION,
    message: messageView(savedMessage),
    submission: { id: submissionId, status: savedResult.status },
  });
}

async function recordFeedbackOutcome(
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
  const body = await jsonBody<FeedbackOutcomeBody>(request);
  const summary = optionalFeedbackText(body?.summary, MAX_OUTCOME_LENGTH);
  const clientKey = parseIdempotencyKey(request);
  if (!summary || !clientKey)
    return featureError(
      context,
      "INVALID_REQUEST",
      `Provide an outcome summary up to ${MAX_OUTCOME_LENGTH} characters and an Idempotency-Key.`,
      400,
    );

  const idempotencyKey = scopedIdempotencyKey(
    `feedback:outcome:${submissionId}`,
    actor.subject,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ submissionId, organizationId, summary }),
  );
  const replay = await findIdempotentResponse(
    context.env.DB,
    idempotencyKey,
    requestHash,
  );
  if (replay)
    return featureJson(context, {
      apiVersion: API_VERSION,
      submission: asRecord(replay),
    });
  if (!canStaffRecordOutcome(feedback.status))
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      `Feedback cannot move from ${feedback.status} to outcome_recorded.`,
      409,
    );

  const database = context.env.DB;
  const now = new Date().toISOString();
  const nextStatus: FeedbackStatus = "outcome_recorded";
  const statusAuditId = await stableId("audit", `${idempotencyKey}:status`);
  const eventKey = `feedback.status_changed:${idempotencyKey}`;
  await database.batch([
    database
      .prepare(
        `UPDATE feedback_submissions
         SET status = ?, outcome = ?, updated_at = ?
         WHERE id = ? AND organization_id = ? AND status = ?`,
      )
      .bind(
        nextStatus,
        summary,
        now,
        submissionId,
        organizationId,
        feedback.status,
      ),
    insertAudit(database, {
      id: statusAuditId,
      subject: actor.subject,
      organizationId,
      action: "feedback_outcome_recorded",
      entityId: submissionId,
      details: {
        previousStatus: feedback.status,
        status: nextStatus,
        summaryLength: summary.length,
      },
      createdAt: now,
      onlyIfPreviousChange: true,
    }),
    outboxStatement(database, {
      eventId: await stableId("evt", eventKey),
      eventType: "feedback.status_changed",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: eventKey,
      payload: {
        previousStatus: feedback.status,
        status: nextStatus,
        summaryLength: summary.length,
      },
    }),
    idempotencyStatement(database, {
      key: idempotencyKey,
      requestHash,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      response: { id: submissionId, status: nextStatus, outcome: summary },
      createdAt: now,
    }),
  ]);
  const saved = await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  );
  if (!saved)
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "The case changed before its outcome could be recorded.",
      409,
    );
  return featureJson(context, {
    apiVersion: API_VERSION,
    submission: asRecord(saved),
  });
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
  assignment: ReturnType<typeof assignmentView> | null,
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
    assignment,
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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  return {};
}
