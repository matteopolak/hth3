import { API_VERSION, type FeedbackStatus } from "@civicresolve/contracts/v1";
import type { D1Database, D1PreparedStatement } from "@civicresolve/db/d1";
import {
  canPerformOrganizationAction,
  type OrganizationAction,
} from "@civicresolve/domain/permissions";
import { authenticateRequest } from "../../auth/identity.js";
import {
  featureError,
  featureJson,
  findIdempotentResponse,
  idempotencyStatement,
  outboxStatement,
  parseIdempotencyKey,
  scopedIdempotencyKey,
  sha256Hex,
  stableId,
  type FeatureContext,
} from "../shared.js";

const SAMPLE_ORGANIZATION_ID = "org_43G1B1RhPwac7EjS";
const RECEIPT_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_MESSAGE_LENGTH = 5_000;

interface FeedbackCreateBody {
  message?: unknown;
}

interface FeedbackMessageBody {
  message?: unknown;
}

interface FeedbackStatusBody {
  status?: unknown;
  outcome?: unknown;
}

interface SampleOrganizationRow {
  id: string;
  display_name: string;
  sample: number;
}

interface FeedbackRow {
  id: string;
  status: FeedbackStatus;
  receipt_token_hash: string;
  department_name: string | null;
  outcome: string | null;
  sample: number;
  created_at: string;
  updated_at: string;
  original_text?: string;
}

interface FeedbackMessageRow {
  id: string;
  author_kind: "resident" | "staff";
  body: string;
  created_at: string;
}

interface IdempotentFeedbackResponse {
  submissionId?: string;
  messageId?: string;
  status?: FeedbackStatus;
}

const FEEDBACK_TRANSITIONS: Readonly<
  Record<FeedbackStatus, readonly FeedbackStatus[]>
> = {
  submitted: ["acknowledged"],
  acknowledged: ["in_review"],
  in_review: ["waiting_on_resident", "outcome_recorded"],
  waiting_on_resident: ["in_review"],
  outcome_recorded: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: ["in_review"],
};

const STAFF_FEEDBACK_ACTIONS: Readonly<Record<string, OrganizationAction>> = {
  read: "feedback:read_organization",
  respond: "feedback:respond_organization",
};

export async function handleFeedbackRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  if (url.pathname === "/api/v1/feedback") {
    if (request.method === "POST") return createGuestFeedback(request, context);
    return featureError(context, "METHOD_NOT_ALLOWED", "Use POST.", 405);
  }

  const receiptMatch = url.pathname.match(
    /^\/api\/v1\/feedback\/receipts\/(fb_[a-f0-9]{32})(?:\/(messages))?$/,
  );
  if (receiptMatch) {
    const submissionId = receiptMatch[1]!;
    if (!receiptMatch[2] && request.method === "GET")
      return getGuestReceipt(request, submissionId, context);
    if (receiptMatch[2] === "messages" && request.method === "POST")
      return addGuestMessage(request, submissionId, context);
    return featureError(
      context,
      "METHOD_NOT_ALLOWED",
      receiptMatch[2] ? "Use POST." : "Use GET.",
      405,
    );
  }

  const staffMatch = url.pathname.match(
    /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/feedback(?:\/(fb_[a-f0-9]{32})(?:\/(messages|status))?)?$/,
  );
  if (staffMatch) return handleStaffFeedback(request, staffMatch, context);

  return null;
}

async function createGuestFeedback(
  request: Request,
  context: FeatureContext,
): Promise<Response> {
  const body = await jsonBody<FeedbackCreateBody>(request);
  const message = normalizedMessage(body?.message);
  const token = request.headers.get("X-Receipt-Token")?.toLowerCase();
  const clientKey = parseIdempotencyKey(request);
  if (!message || !token || !RECEIPT_TOKEN_PATTERN.test(token) || !clientKey) {
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a message, a 32-byte receipt token, and an Idempotency-Key.",
      400,
    );
  }

  const database = context.env.DB;
  const receiptTokenHash = await sha256Hex(token);
  const idempotencyKey = scopedIdempotencyKey(
    "feedback:create",
    null,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ message, receiptTokenHash }),
  );
  const replay = await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  );
  if (replay) {
    const submissionId = (replay as IdempotentFeedbackResponse).submissionId;
    const receipt = await loadReceipt(
      database,
      submissionId!,
      receiptTokenHash,
    );
    if (!receipt)
      return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
    return featureJson(context, {
      apiVersion: API_VERSION,
      submission: receipt,
      receiptToken: token,
    });
  }

  const organization = await database
    .prepare(
      "SELECT id, display_name, sample FROM organizations WHERE id = ? AND sample = 1",
    )
    .bind(SAMPLE_ORGANIZATION_ID)
    .first<SampleOrganizationRow>();
  if (!organization) {
    return featureError(
      context,
      "SANDBOX_UNAVAILABLE",
      "The clearly labeled sandbox destination is unavailable.",
      503,
    );
  }

  const now = new Date().toISOString();
  const submissionId = await stableId("fb", idempotencyKey);
  const messageId = await stableId("fbm", `${idempotencyKey}:initial`);
  const auditId = await stableId("audit", `${idempotencyKey}:created`);
  const eventKey = `feedback.submitted:${idempotencyKey}`;
  const eventId = await stableId("evt", eventKey);
  await database.batch([
    database
      .prepare(
        `INSERT OR IGNORE INTO feedback_submissions (
          id, organization_id, original_text, status, receipt_token_hash,
          department_name, outcome, sample, created_at, updated_at
        ) VALUES (?, ?, ?, 'submitted', ?, ?, NULL, 1, ?, ?)`,
      )
      .bind(
        submissionId,
        organization.id,
        message,
        receiptTokenHash,
        organization.display_name,
        now,
        now,
      ),
    database
      .prepare(
        `INSERT OR IGNORE INTO feedback_messages (
          id, submission_id, author_kind, author_subject, body, created_at
        ) VALUES (?, ?, 'resident', NULL, ?, ?)`,
      )
      .bind(messageId, submissionId, message, now),
    insertAudit(database, {
      id: auditId,
      subject: "guest",
      organizationId: organization.id,
      action: "feedback_submitted",
      entityId: submissionId,
      details: { status: "submitted", sample: true },
      createdAt: now,
    }),
    outboxStatement(database, {
      eventId,
      eventType: "feedback.submitted",
      occurredAt: now,
      actorKind: "guest",
      actorSubject: null,
      organizationId: organization.id,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: eventKey,
      payload: { status: "submitted", messageLength: message.length },
    }),
    idempotencyStatement(database, {
      key: idempotencyKey,
      requestHash,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      response: { submissionId },
      createdAt: now,
    }),
  ]);

  const persisted = await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  );
  const savedId = (persisted as IdempotentFeedbackResponse | null)
    ?.submissionId;
  const receipt = savedId
    ? await loadReceipt(database, savedId, receiptTokenHash)
    : null;
  if (!receipt)
    return featureError(
      context,
      "IDEMPOTENCY_CONFLICT",
      "The request key could not be applied to this submission.",
      409,
    );
  return featureJson(
    context,
    { apiVersion: API_VERSION, submission: receipt, receiptToken: token },
    201,
  );
}

async function getGuestReceipt(
  request: Request,
  submissionId: string,
  context: FeatureContext,
): Promise<Response> {
  const tokenHash = await receiptTokenHash(request);
  if (!tokenHash)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  const receipt = await loadReceipt(context.env.DB, submissionId, tokenHash);
  if (!receipt)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  return featureJson(context, { apiVersion: API_VERSION, submission: receipt });
}

async function addGuestMessage(
  request: Request,
  submissionId: string,
  context: FeatureContext,
): Promise<Response> {
  const tokenHash = await receiptTokenHash(request);
  if (!tokenHash)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  const current = await loadFeedbackForReceipt(
    context.env.DB,
    submissionId,
    tokenHash,
  );
  if (!current)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  if (current.status === "closed")
    return featureError(
      context,
      "FEEDBACK_CLOSED",
      "This feedback thread is closed.",
      409,
    );
  const body = await jsonBody<FeedbackMessageBody>(request);
  const message = normalizedMessage(body?.message);
  const clientKey = parseIdempotencyKey(request);
  if (!message || !clientKey)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a message and an Idempotency-Key.",
      400,
    );

  const database = context.env.DB;
  const idempotencyKey = scopedIdempotencyKey(
    `feedback:resident-message:${submissionId}`,
    null,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ submissionId, tokenHash, message }),
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
    const now = new Date().toISOString();
    const auditId = await stableId("audit", `${idempotencyKey}:message`);
    const eventKey = `feedback.message_added:${idempotencyKey}`;
    const eventId = await stableId("evt", eventKey);
    await database.batch([
      insertMessage(database, {
        id: messageId,
        submissionId,
        authorKind: "resident",
        authorSubject: null,
        body: message,
        createdAt: now,
        receiptHash: tokenHash,
      }),
      insertAudit(database, {
        id: auditId,
        subject: "guest",
        organizationId: current.organization_id,
        action: "feedback_message_added",
        entityId: submissionId,
        details: { author: "resident", messageLength: message.length },
        createdAt: now,
        onlyIfPreviousChange: true,
      }),
      outboxStatement(database, {
        eventId,
        eventType: "feedback.message_added",
        occurredAt: now,
        actorKind: "guest",
        actorSubject: null,
        organizationId: current.organization_id,
        aggregateType: "feedback_submission",
        aggregateId: submissionId,
        idempotencyKey: eventKey,
        payload: { author: "resident", messageLength: message.length },
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
    return featureError(
      context,
      "FEEDBACK_CLOSED",
      "This feedback thread is no longer open.",
      409,
    );
  return featureJson(context, {
    apiVersion: API_VERSION,
    message: messageView(saved),
  });
}

async function handleStaffFeedback(
  request: Request,
  match: RegExpMatchArray,
  context: FeatureContext,
): Promise<Response> {
  const organizationId = match[1]!;
  const submissionId = match[2];
  const action = match[3];
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
      STAFF_FEEDBACK_ACTIONS[roleAction]!,
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

  if (!submissionId && !action && request.method === "GET")
    return listStaffFeedback(organizationId, context);
  if (submissionId && action === "messages" && request.method === "POST")
    return addStaffMessage(
      request,
      organizationId,
      submissionId,
      actor,
      context,
    );
  if (submissionId && action === "status" && request.method === "PATCH")
    return changeFeedbackStatus(
      request,
      organizationId,
      submissionId,
      actor,
      context,
    );
  return featureError(
    context,
    "METHOD_NOT_ALLOWED",
    "Unsupported action.",
    405,
  );
}

async function listStaffFeedback(
  organizationId: string,
  context: FeatureContext,
): Promise<Response> {
  const rows = await context.env.DB.prepare(
    `SELECT id, original_text, status, department_name, outcome, sample,
      created_at, updated_at
     FROM feedback_submissions
     WHERE organization_id = ?
     ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(organizationId)
    .all<FeedbackRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    submissions: (rows.results ?? []).map((row) => ({
      id: row.id,
      originalText: row.original_text,
      status: row.status,
      departmentName: row.department_name,
      outcome: row.outcome,
      sample: row.sample === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

async function addStaffMessage(
  request: Request,
  organizationId: string,
  submissionId: string,
  actor: NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>,
  context: FeatureContext,
): Promise<Response> {
  const feedback = await loadFeedbackForOrganization(
    context.env.DB,
    submissionId,
    organizationId,
  );
  if (!feedback)
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  if (feedback.status === "closed")
    return featureError(
      context,
      "FEEDBACK_CLOSED",
      "This feedback thread is closed.",
      409,
    );
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
  context: FeatureContext,
): Promise<Response> {
  const body = await jsonBody<FeedbackStatusBody>(request);
  const nextStatus = body?.status;
  const outcome = typeof body?.outcome === "string" ? body.outcome.trim() : "";
  const clientKey = parseIdempotencyKey(request);
  if (
    typeof nextStatus !== "string" ||
    !Object.hasOwn(FEEDBACK_TRANSITIONS, nextStatus) ||
    (nextStatus === "outcome_recorded" && outcome.length === 0) ||
    outcome.length > 2_000 ||
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

  const idempotencyKey = scopedIdempotencyKey(
    `feedback:status:${submissionId}`,
    actor.subject,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({
      submissionId,
      organizationId,
      status: nextStatus,
      outcome,
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
      submission: replay,
    });

  const current = await loadFeedbackForOrganization(
    context.env.DB,
    submissionId,
    organizationId,
  );
  if (!current)
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  if (
    !FEEDBACK_TRANSITIONS[current.status].includes(nextStatus as FeedbackStatus)
  )
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      `Feedback cannot move from ${current.status} to ${nextStatus}.`,
      409,
    );

  const next = nextStatus as FeedbackStatus;
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
  return featureJson(context, {
    apiVersion: API_VERSION,
    submission: saved,
  });
}

async function loadReceipt(
  database: D1Database,
  submissionId: string,
  tokenHash: string,
) {
  const feedback = await loadFeedbackForReceipt(
    database,
    submissionId,
    tokenHash,
  );
  if (!feedback) return null;
  const messages = await database
    .prepare(
      `SELECT id, author_kind, body, created_at FROM feedback_messages
       WHERE submission_id = ? ORDER BY created_at, id`,
    )
    .bind(submissionId)
    .all<FeedbackMessageRow>();
  return {
    id: feedback.id,
    sample: feedback.sample === 1,
    status: feedback.status,
    departmentName: feedback.department_name,
    messages: (messages.results ?? []).map(messageView),
    outcome: feedback.outcome,
  };
}

async function loadFeedbackForReceipt(
  database: D1Database,
  submissionId: string,
  tokenHash: string,
): Promise<(FeedbackRow & { organization_id: string | null }) | null> {
  return database
    .prepare(
      `SELECT id, status, receipt_token_hash, department_name, outcome,
        sample, created_at, updated_at, organization_id
       FROM feedback_submissions
       WHERE id = ? AND receipt_token_hash = ?`,
    )
    .bind(submissionId, tokenHash)
    .first<FeedbackRow & { organization_id: string | null }>();
}

async function loadFeedbackForOrganization(
  database: D1Database,
  submissionId: string,
  organizationId: string,
): Promise<(FeedbackRow & { organization_id: string }) | null> {
  return database
    .prepare(
      `SELECT id, original_text, status, receipt_token_hash, department_name,
        outcome, sample, created_at, updated_at, organization_id
       FROM feedback_submissions WHERE id = ? AND organization_id = ?`,
    )
    .bind(submissionId, organizationId)
    .first<FeedbackRow & { organization_id: string }>();
}

async function loadMessage(
  database: D1Database,
  submissionId: string,
  messageId: string,
): Promise<FeedbackMessageRow | null> {
  return database
    .prepare(
      `SELECT id, author_kind, body, created_at FROM feedback_messages
       WHERE submission_id = ? AND id = ?`,
    )
    .bind(submissionId, messageId)
    .first<FeedbackMessageRow>();
}

function messageView(message: FeedbackMessageRow) {
  return {
    id: message.id,
    author: message.author_kind,
    body: message.body,
    createdAt: message.created_at,
  } as const;
}

function insertMessage(
  database: D1Database,
  input: {
    id: string;
    submissionId: string;
    authorKind: "resident" | "staff";
    authorSubject: string | null;
    body: string;
    createdAt: string;
    receiptHash?: string;
    organizationId?: string;
  },
): D1PreparedStatement {
  const visibility = input.receiptHash
    ? `WHERE EXISTS (
         SELECT 1 FROM feedback_submissions
         WHERE id = ? AND receipt_token_hash = ? AND status != 'closed'
       )`
    : `WHERE EXISTS (
         SELECT 1 FROM feedback_submissions
         WHERE id = ? AND organization_id = ? AND status != 'closed'
       )`;
  const params = input.receiptHash
    ? [input.submissionId, input.receiptHash]
    : [input.submissionId, input.organizationId!];
  return database
    .prepare(
      `INSERT OR IGNORE INTO feedback_messages (
        id, submission_id, author_kind, author_subject, body, created_at
      ) SELECT ?, ?, ?, ?, ?, ? ${visibility}`,
    )
    .bind(
      input.id,
      input.submissionId,
      input.authorKind,
      input.authorSubject,
      input.body,
      input.createdAt,
      ...params,
    );
}

function insertAudit(
  database: D1Database,
  input: {
    id: string;
    subject: string;
    organizationId: string | null;
    action: string;
    entityId: string;
    details: unknown;
    createdAt: string;
    onlyIfPreviousChange?: boolean;
  },
): D1PreparedStatement {
  const values = input.onlyIfPreviousChange
    ? `SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`
    : `VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  return database
    .prepare(
      `INSERT OR IGNORE INTO audit_events (
        id, actor_subject, organization_id, action, entity_type, entity_id,
        details_json, created_at
      ) ${values}`,
    )
    .bind(
      input.id,
      input.subject,
      input.organizationId,
      input.action,
      "feedback_submission",
      input.entityId,
      JSON.stringify(input.details),
      input.createdAt,
    );
}

function normalizedMessage(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > MAX_MESSAGE_LENGTH
  ) {
    return null;
  }
  return value;
}

async function receiptTokenHash(request: Request): Promise<string | null> {
  const token = request.headers.get("X-Receipt-Token")?.toLowerCase();
  if (!token || !RECEIPT_TOKEN_PATTERN.test(token)) return null;
  return sha256Hex(token);
}

async function jsonBody<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}
