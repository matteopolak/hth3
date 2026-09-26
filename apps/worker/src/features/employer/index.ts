import {
  API_VERSION,
  type ApplicationStatus,
} from "@civicresolve/contracts/v1";
import type { D1Database } from "@civicresolve/db/d1";
import {
  canPerformOrganizationAction,
  canPerformOwnerAction,
  type OrganizationAction,
} from "@civicresolve/domain/permissions";
import {
  authenticateRequest,
  type AuthenticatedActor,
} from "../../auth/identity.js";
import {
  featureError,
  featureJson,
  outboxStatement,
  type FeatureContext,
} from "../shared.js";

type EmployerContext = FeatureContext;
type PostingState = "draft" | "published" | "closed";

interface OrganizationRow {
  id: string;
  sample: number;
  verification_status: string;
}

interface PostingRow {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  location_name: string;
  sample: number;
  status: PostingState;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closed_at: string | null;
}

interface ApplicationRow {
  id: string;
  posting_id: string;
  posting_title: string;
  applicant_subject: string;
  answers_json: string;
  status: ApplicationStatus;
  sample: number;
  submitted_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  application_id: string;
  author_kind: "applicant" | "employer";
  author_subject: string;
  body: string;
  created_at: string;
}

const POSTING_PATH =
  /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]{1,120})\/postings(?:\/([A-Za-z0-9_-]{1,120}))?(?:\/(publish|close))?$/;
const STAFF_APPLICATION_PATH =
  /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]{1,120})\/applications\/([A-Za-z0-9_-]{1,120})(?:\/(messages|decision))?$/;
const OWN_MESSAGES_PATH =
  /^\/api\/v1\/applications\/([A-Za-z0-9_-]{1,120})\/messages$/;
const DECISION_TRANSITIONS: Readonly<
  Partial<Record<ApplicationStatus, readonly ApplicationStatus[]>>
> = {
  under_review: ["shortlisted", "declined"],
  information_requested: ["declined"],
  shortlisted: ["offer", "declined"],
};

export async function handleEmployerRequest(
  request: Request,
  url: URL,
  context: EmployerContext,
): Promise<Response | null> {
  const postingMatch = url.pathname.match(POSTING_PATH);
  if (postingMatch) {
    const [, organizationId, postingId, operation] = postingMatch;
    if (!organizationId) return null;
    if (!postingId) {
      if (request.method === "GET")
        return listPostings(request, organizationId, context);
      if (request.method === "POST")
        return createPosting(request, organizationId, context);
    } else if (!operation) {
      if (request.method === "GET")
        return getPosting(request, organizationId, postingId, context);
      if (request.method === "PATCH")
        return editPosting(request, organizationId, postingId, context);
    } else if (request.method === "POST") {
      return changePostingState(
        request,
        organizationId,
        postingId,
        operation as "publish" | "close",
        context,
      );
    }
    return featureError(
      context,
      "METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }

  const staffMatch = url.pathname.match(STAFF_APPLICATION_PATH);
  if (staffMatch) {
    const [, organizationId, applicationId, operation] = staffMatch;
    if (!organizationId || !applicationId) return null;
    if (!operation && request.method === "GET")
      return getStaffApplication(
        request,
        organizationId,
        applicationId,
        context,
      );
    if (operation === "messages") {
      if (request.method === "GET")
        return listMessages(request, applicationId, organizationId, context);
      if (request.method === "POST")
        return addMessage(request, applicationId, organizationId, context);
    }
    if (operation === "decision" && request.method === "POST")
      return recordDecision(request, organizationId, applicationId, context);
    return featureError(
      context,
      "METHOD_NOT_ALLOWED",
      "Method not allowed.",
      405,
    );
  }

  const ownMatch = url.pathname.match(OWN_MESSAGES_PATH);
  if (ownMatch) {
    if (request.method === "GET")
      return listMessages(request, ownMatch[1]!, null, context);
    if (request.method === "POST")
      return addMessage(request, ownMatch[1]!, null, context);
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET or POST.", 405);
  }
  return null;
}

async function listPostings(
  request: Request,
  organizationId: string,
  context: EmployerContext,
): Promise<Response> {
  const actor = await staffActor(
    request,
    organizationId,
    "posting:manage_organization",
    context,
  );
  if (actor instanceof Response) return actor;
  const result = await context.env.DB.prepare(
    `SELECT * FROM postings WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(organizationId)
    .all<PostingRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    postings: (result.results ?? []).map(postingView),
  });
}

async function getPosting(
  request: Request,
  organizationId: string,
  postingId: string,
  context: EmployerContext,
): Promise<Response> {
  const actor = await staffActor(
    request,
    organizationId,
    "posting:manage_organization",
    context,
  );
  if (actor instanceof Response) return actor;
  const posting = await findPosting(context.env.DB, organizationId, postingId);
  return posting
    ? featureJson(context, {
        apiVersion: API_VERSION,
        posting: postingView(posting),
      })
    : featureError(context, "NOT_FOUND", "Posting not found.", 404);
}

async function createPosting(
  request: Request,
  organizationId: string,
  context: EmployerContext,
): Promise<Response> {
  const actor = await staffActor(
    request,
    organizationId,
    "posting:manage_organization",
    context,
  );
  if (actor instanceof Response) return actor;
  const body = (await jsonBody(request)) as Record<string, unknown> | null;
  const fields = postingFields(body, false);
  if (!fields)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a title, description, and location.",
      400,
    );
  const organization = await findOrganization(context.env.DB, organizationId);
  if (!organization)
    return featureError(context, "NOT_FOUND", "Organization not found.", 404);
  const postingId = `post_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO postings (id, organization_id, title, description, location_name, sample, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    ).bind(
      postingId,
      organizationId,
      fields.title!,
      fields.description!,
      fields.location!,
      organization.sample,
      now,
      now,
    ),
    auditStatement(
      context.env.DB,
      actor.subject,
      organizationId,
      "posting_created",
      "posting",
      postingId,
      { status: "draft" },
      now,
    ),
    outboxStatement(context.env.DB, {
      eventId: crypto.randomUUID(),
      eventType: "posting.created",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "posting",
      aggregateId: postingId,
      idempotencyKey: `posting.created:${postingId}`,
      payload: { status: "draft", sample: organization.sample === 1 },
    }),
  ]);
  const posting = await findPosting(context.env.DB, organizationId, postingId);
  return featureJson(
    context,
    { apiVersion: API_VERSION, posting: postingView(posting!) },
    201,
  );
}

async function editPosting(
  request: Request,
  organizationId: string,
  postingId: string,
  context: EmployerContext,
): Promise<Response> {
  const actor = await staffActor(
    request,
    organizationId,
    "posting:manage_organization",
    context,
  );
  if (actor instanceof Response) return actor;
  const current = await findPosting(context.env.DB, organizationId, postingId);
  if (!current)
    return featureError(context, "NOT_FOUND", "Posting not found.", 404);
  if (current.status === "closed")
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "Closed postings cannot be edited.",
      409,
    );
  const fields = postingFields(
    (await jsonBody(request)) as Record<string, unknown> | null,
    true,
  );
  if (!fields)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a valid title, description, or location.",
      400,
    );
  const now = new Date().toISOString();
  const result = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE postings SET title = ?, description = ?, location_name = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND status = ?`,
    ).bind(
      fields.title ?? current.title,
      fields.description ?? current.description,
      fields.location ?? current.location_name,
      now,
      postingId,
      organizationId,
      current.status,
    ),
    auditStatement(
      context.env.DB,
      actor.subject,
      organizationId,
      "posting_updated",
      "posting",
      postingId,
      { status: current.status },
      now,
    ),
    outboxStatement(context.env.DB, {
      eventId: crypto.randomUUID(),
      eventType: "posting.updated",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "posting",
      aggregateId: postingId,
      idempotencyKey: `posting.updated:${postingId}:${crypto.randomUUID()}`,
      payload: { status: current.status },
    }),
  ]);
  if (result[0]?.meta.changes !== 1)
    return featureError(
      context,
      "CONFLICT",
      "Posting changed before this edit.",
      409,
    );
  const posting = await findPosting(context.env.DB, organizationId, postingId);
  return featureJson(context, {
    apiVersion: API_VERSION,
    posting: postingView(posting!),
  });
}

async function changePostingState(
  request: Request,
  organizationId: string,
  postingId: string,
  operation: "publish" | "close",
  context: EmployerContext,
): Promise<Response> {
  const actor = await staffActor(
    request,
    organizationId,
    "posting:manage_organization",
    context,
  );
  if (actor instanceof Response) return actor;
  const current = await findPosting(context.env.DB, organizationId, postingId);
  if (!current)
    return featureError(context, "NOT_FOUND", "Posting not found.", 404);
  const before = operation === "publish" ? "draft" : "published";
  const after = operation === "publish" ? "published" : "closed";
  if (current.status !== before)
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      `Posting must be ${before}.`,
      409,
    );
  if (operation === "publish" && current.sample !== 1) {
    const organization = await findOrganization(context.env.DB, organizationId);
    if (organization?.verification_status !== "verified")
      return featureError(
        context,
        "ORGANIZATION_UNVERIFIED",
        "The employer must be verified before publishing.",
        403,
      );
  }
  const now = new Date().toISOString();
  const result = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE postings SET status = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END,
       closed_at = CASE WHEN ? = 'closed' THEN ? ELSE closed_at END
       WHERE id = ? AND organization_id = ? AND status = ?`,
    ).bind(
      after,
      now,
      after,
      now,
      after,
      now,
      postingId,
      organizationId,
      before,
    ),
    auditStatement(
      context.env.DB,
      actor.subject,
      organizationId,
      operation === "publish" ? "posting_published" : "posting_closed",
      "posting",
      postingId,
      { previousStatus: before, status: after },
      now,
    ),
    outboxStatement(context.env.DB, {
      eventId: crypto.randomUUID(),
      eventType: `posting.${after}`,
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "posting",
      aggregateId: postingId,
      idempotencyKey: `posting.${after}:${postingId}`,
      payload: {
        previousStatus: before,
        status: after,
        sample: current.sample === 1,
      },
    }),
  ]);
  if (result[0]?.meta.changes !== 1)
    return featureError(
      context,
      "CONFLICT",
      "Posting changed before this action.",
      409,
    );
  const posting = await findPosting(context.env.DB, organizationId, postingId);
  return featureJson(context, {
    apiVersion: API_VERSION,
    posting: postingView(posting!),
  });
}

function postingFields(
  body: Record<string, unknown> | null,
  partial: boolean,
): { title?: string; description?: string; location?: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = ["title", "description", "location"] as const;
  if (partial && !keys.some((key) => Object.hasOwn(body, key))) return null;
  const limits = { title: 160, description: 12_000, location: 200 };
  const values: { title?: string; description?: string; location?: string } =
    {};
  for (const key of keys) {
    const value = body[key];
    if (value === undefined && partial) continue;
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > limits[key]
    )
      return null;
    values[key] = value.trim();
  }
  return values;
}

async function findOrganization(
  database: D1Database,
  organizationId: string,
): Promise<OrganizationRow | null> {
  return database
    .prepare(
      "SELECT id, sample, verification_status FROM organizations WHERE id = ?",
    )
    .bind(organizationId)
    .first<OrganizationRow>();
}

async function findPosting(
  database: D1Database,
  organizationId: string,
  postingId: string,
): Promise<PostingRow | null> {
  return database
    .prepare("SELECT * FROM postings WHERE organization_id = ? AND id = ?")
    .bind(organizationId, postingId)
    .first<PostingRow>();
}

function postingView(row: PostingRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description,
    location: row.location_name,
    sample: row.sample === 1,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    closedAt: row.closed_at,
  };
}

async function staffActor(
  request: Request,
  organizationId: string,
  action: OrganizationAction,
  context: EmployerContext,
): Promise<AuthenticatedActor | Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (!canPerformOrganizationAction(actor, action, organizationId))
    return featureError(
      context,
      "FORBIDDEN",
      "This workspace is unavailable to this role or organization.",
      403,
    );
  return actor;
}

function auditStatement(
  database: D1Database,
  actorSubject: string,
  organizationId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: unknown,
  now: string,
) {
  return database
    .prepare(
      `INSERT INTO audit_events (id, actor_subject, organization_id, action, entity_type, entity_id, details_json, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
    )
    .bind(
      crypto.randomUUID(),
      actorSubject,
      organizationId,
      action,
      entityType,
      entityId,
      JSON.stringify(details),
      now,
    );
}

async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

async function getStaffApplication(
  request: Request,
  organizationId: string,
  applicationId: string,
  context: EmployerContext,
): Promise<Response> {
  const authorized = await applicationAccess(
    request,
    applicationId,
    organizationId,
    false,
    context,
  );
  if (authorized instanceof Response) return authorized;
  return featureJson(context, {
    apiVersion: API_VERSION,
    application: staffApplicationView(authorized.application),
  });
}

async function listMessages(
  request: Request,
  applicationId: string,
  organizationId: string | null,
  context: EmployerContext,
): Promise<Response> {
  const authorized = await applicationAccess(
    request,
    applicationId,
    organizationId,
    false,
    context,
  );
  if (authorized instanceof Response) return authorized;
  const result = await context.env.DB.prepare(
    `SELECT id, application_id, author_kind, author_subject, body, created_at
     FROM application_messages WHERE application_id = ?
     ORDER BY created_at ASC, id ASC LIMIT 500`,
  )
    .bind(applicationId)
    .all<MessageRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    messages: (result.results ?? []).map(messageView),
  });
}

async function addMessage(
  request: Request,
  applicationId: string,
  organizationId: string | null,
  context: EmployerContext,
): Promise<Response> {
  const authorized = await applicationAccess(
    request,
    applicationId,
    organizationId,
    true,
    context,
  );
  if (authorized instanceof Response) return authorized;
  const body = (await jsonBody(request)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4_000)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a message up to 4,000 characters.",
      400,
    );
  const messageId = `amsg_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  const authorKind = organizationId ? "employer" : "applicant";
  const employerOrganizationId = authorized.organizationId;
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO application_messages (id, application_id, author_kind, author_subject, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      messageId,
      applicationId,
      authorKind,
      authorized.actor.subject,
      message,
      now,
    ),
    auditStatement(
      context.env.DB,
      authorized.actor.subject,
      employerOrganizationId,
      "application_message_added",
      "application",
      applicationId,
      { authorKind, messageId },
      now,
    ),
    outboxStatement(context.env.DB, {
      eventId: crypto.randomUUID(),
      eventType: "application.message_added",
      occurredAt: now,
      actorKind: authorKind === "employer" ? "staff" : "applicant",
      actorSubject: authorized.actor.subject,
      organizationId: employerOrganizationId,
      aggregateType: "application",
      aggregateId: applicationId,
      idempotencyKey: `application.message_added:${messageId}`,
      payload: { authorKind, messageId },
    }),
  ]);
  return featureJson(
    context,
    {
      apiVersion: API_VERSION,
      message: {
        id: messageId,
        author: authorKind,
        body: message,
        createdAt: now,
      },
    },
    201,
  );
}

async function recordDecision(
  request: Request,
  organizationId: string,
  applicationId: string,
  context: EmployerContext,
): Promise<Response> {
  const authorized = await applicationAccess(
    request,
    applicationId,
    organizationId,
    true,
    context,
  );
  if (authorized instanceof Response) return authorized;
  const body = (await jsonBody(request)) as {
    status?: unknown;
    message?: unknown;
  } | null;
  const status = body?.status;
  const message = body?.message;
  if (
    (status !== "shortlisted" && status !== "offer" && status !== "declined") ||
    (message !== undefined &&
      (typeof message !== "string" ||
        !message.trim() ||
        message.trim().length > 4_000))
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a supported decision and optional message.",
      400,
    );
  const current = authorized.application;
  if (!DECISION_TRANSITIONS[current.status]?.includes(status))
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "This decision is unavailable from the current status.",
      409,
    );
  const now = new Date().toISOString();
  const messageId =
    message === undefined
      ? null
      : `amsg_${crypto.randomUUID().replaceAll("-", "")}`;
  const statements = [
    context.env.DB.prepare(
      `UPDATE applications SET status = ?, updated_at = ?
       WHERE id = ? AND status = ? AND posting_id IN
       (SELECT id FROM postings WHERE organization_id = ?)`,
    ).bind(status, now, applicationId, current.status, organizationId),
  ];
  if (messageId) {
    statements.push(
      context.env.DB.prepare(
        `INSERT INTO application_messages (id, application_id, author_kind, author_subject, body, created_at)
       SELECT ?, ?, 'employer', ?, ?, ? WHERE changes() = 1`,
      ).bind(
        messageId,
        applicationId,
        authorized.actor.subject,
        (message as string).trim(),
        now,
      ),
    );
  }
  statements.push(
    auditStatement(
      context.env.DB,
      authorized.actor.subject,
      organizationId,
      "application_decision_recorded",
      "application",
      applicationId,
      { previousStatus: current.status, status, messageId },
      now,
    ),
    outboxStatement(context.env.DB, {
      eventId: crypto.randomUUID(),
      eventType: "application.decision_recorded",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: authorized.actor.subject,
      organizationId,
      aggregateType: "application",
      aggregateId: applicationId,
      idempotencyKey: `application.decision_recorded:${applicationId}:${status}`,
      payload: { previousStatus: current.status, status, messageId },
    }),
  );
  const result = await context.env.DB.batch(statements);
  if (result[0]?.meta.changes !== 1)
    return featureError(
      context,
      "CONFLICT",
      "Application changed before this decision.",
      409,
    );
  const updated = await findApplication(
    context.env.DB,
    applicationId,
    organizationId,
    null,
  );
  return featureJson(context, {
    apiVersion: API_VERSION,
    application: staffApplicationView(updated!),
    message: messageId
      ? {
          id: messageId,
          author: "employer",
          body: (message as string).trim(),
          createdAt: now,
        }
      : null,
  });
}

async function applicationAccess(
  request: Request,
  applicationId: string,
  organizationId: string | null,
  write: boolean,
  context: EmployerContext,
): Promise<
  | {
      actor: AuthenticatedActor;
      application: ApplicationRow;
      organizationId: string;
    }
  | Response
> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (organizationId) {
    const action = write
      ? "application:review_organization"
      : "application:read_organization";
    if (!canPerformOrganizationAction(actor, action, organizationId))
      return featureError(
        context,
        "FORBIDDEN",
        "Applications are unavailable to this role or organization.",
        403,
      );
  } else if (
    !canPerformOwnerAction(
      actor,
      write ? "application:submit_own" : "application:read_own",
      actor.subject,
    )
  ) {
    return featureError(
      context,
      "FORBIDDEN",
      "Applications are unavailable.",
      403,
    );
  }
  const application = await findApplication(
    context.env.DB,
    applicationId,
    organizationId,
    organizationId ? null : actor.subject,
  );
  if (!application)
    return featureError(context, "NOT_FOUND", "Application not found.", 404);
  const postingOrganizationId = await context.env.DB.prepare(
    "SELECT organization_id FROM postings WHERE id = ?",
  )
    .bind(application.posting_id)
    .first<{ organization_id: string }>();
  if (!postingOrganizationId)
    return featureError(context, "NOT_FOUND", "Application not found.", 404);
  return {
    actor,
    application,
    organizationId: postingOrganizationId.organization_id,
  };
}

async function findApplication(
  database: D1Database,
  applicationId: string,
  organizationId: string | null,
  applicantSubject: string | null,
): Promise<ApplicationRow | null> {
  return database
    .prepare(
      `SELECT a.id, a.posting_id, p.title AS posting_title, a.applicant_subject,
       a.answers_json, a.status, a.sample, a.submitted_at, a.updated_at
     FROM applications AS a JOIN postings AS p ON p.id = a.posting_id
     WHERE a.id = ? AND (? IS NULL OR p.organization_id = ?)
       AND (? IS NULL OR a.applicant_subject = ?)`,
    )
    .bind(
      applicationId,
      organizationId,
      organizationId,
      applicantSubject,
      applicantSubject,
    )
    .first<ApplicationRow>();
}

function staffApplicationView(application: ApplicationRow) {
  return {
    id: application.id,
    postingId: application.posting_id,
    postingTitle: application.posting_title,
    applicantSubject: application.applicant_subject,
    answers: JSON.parse(application.answers_json) as Record<string, string>,
    status: application.status,
    sample: application.sample === 1,
    submittedAt: application.submitted_at,
    updatedAt: application.updated_at,
  };
}

function messageView(message: MessageRow) {
  return {
    id: message.id,
    author: message.author_kind,
    body: message.body,
    createdAt: message.created_at,
  };
}
