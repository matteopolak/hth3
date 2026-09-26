import {
  API_VERSION,
  type ApplicationStatus,
} from "@civicresolve/contracts/v1";
import type { D1Database } from "@civicresolve/db/d1";
import {
  canPerformOrganizationAction,
  canPerformOwnerAction,
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

const MAX_ANSWER_COUNT = 32;
const MAX_ANSWER_LENGTH = 4_000;
const MAX_APPLICATION_LENGTH = 16_000;

interface ApplicationBody {
  postingId?: unknown;
  answers?: unknown;
  confirmedByApplicant?: unknown;
}

interface ApplicationStatusBody {
  status?: unknown;
}

interface PostingRow {
  id: string;
  organization_id: string;
  organization_name: string;
  title: string;
  description: string;
  location_name: string;
  sample: number;
}

interface ApplicationRow {
  id: string;
  posting_id: string;
  applicant_subject: string;
  answers_json: string;
  status: ApplicationStatus;
  sample: number;
  submitted_at: string;
  updated_at: string;
  title?: string;
  organization_id?: string;
}

interface StoredApplicationResponse {
  applicationId?: string;
  status?: ApplicationStatus;
}

const APPLICATION_TRANSITIONS: Readonly<
  Record<ApplicationStatus, readonly ApplicationStatus[]>
> = {
  submitted: ["under_review"],
  under_review: ["information_requested", "shortlisted", "declined"],
  information_requested: ["under_review", "declined"],
  shortlisted: ["offer", "declined"],
  declined: [],
  offer: [],
};

export async function handleApplicationRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  if (url.pathname === "/api/v1/postings") {
    if (request.method === "GET") return listPublicPostings(context);
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);
  }

  const postingMatch = url.pathname.match(
    /^\/api\/v1\/postings\/([A-Za-z0-9_-]+)$/,
  );
  if (postingMatch) {
    if (request.method === "GET")
      return getPublicPosting(postingMatch[1]!, context);
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);
  }

  if (url.pathname === "/api/v1/applications") {
    if (request.method === "POST") return submitApplication(request, context);
    if (request.method === "GET")
      return listApplicantApplications(request, context);
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET or POST.", 405);
  }

  const ownApplicationMatch = url.pathname.match(
    /^\/api\/v1\/applications\/([A-Za-z0-9_-]+)$/,
  );
  if (ownApplicationMatch && request.method === "GET")
    return getApplicantApplication(request, ownApplicationMatch[1]!, context);

  const staffCollectionMatch = url.pathname.match(
    /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/applications$/,
  );
  if (staffCollectionMatch && request.method === "GET")
    return listOrganizationApplications(
      request,
      staffCollectionMatch[1]!,
      context,
    );

  const staffStatusMatch = url.pathname.match(
    /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/applications\/([A-Za-z0-9_-]+)\/status$/,
  );
  if (staffStatusMatch && request.method === "PATCH")
    return changeApplicationStatus(
      request,
      staffStatusMatch[1]!,
      staffStatusMatch[2]!,
      context,
    );

  return null;
}

async function listPublicPostings(context: FeatureContext): Promise<Response> {
  const rows = await context.env.DB.prepare(
    `SELECT p.id, p.organization_id, o.display_name AS organization_name,
       p.title, p.description, p.location_name, p.sample
     FROM postings AS p JOIN organizations AS o ON o.id = p.organization_id
     WHERE p.status = 'published' AND (
       (p.sample = 1 AND o.sample = 1) OR
       (p.sample = 0 AND o.sample = 0 AND o.verification_status = 'verified')
     )
     ORDER BY p.created_at DESC LIMIT 50`,
  ).all<PostingRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    postings: (rows.results ?? []).map(publicPostingView),
  });
}

async function getPublicPosting(
  postingId: string,
  context: FeatureContext,
): Promise<Response> {
  const row = await findPublicPosting(context.env.DB, postingId);
  if (!row)
    return featureError(context, "NOT_FOUND", "Posting not found.", 404);
  return featureJson(context, {
    apiVersion: API_VERSION,
    posting: publicPostingView(row),
  });
}

async function submitApplication(
  request: Request,
  context: FeatureContext,
): Promise<Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in when you are ready to submit an application.",
      401,
    );
  if (!canPerformOwnerAction(actor, "application:submit_own", actor.subject))
    return featureError(
      context,
      "FORBIDDEN",
      "Your account cannot submit applications.",
      403,
    );

  const body = await jsonBody<ApplicationBody>(request);
  if (
    typeof body?.postingId !== "string" ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(body.postingId) ||
    body.confirmedByApplicant !== true ||
    !isAnswerMap(body.answers)
  ) {
    return featureError(
      context,
      "INVALID_REQUEST",
      "Choose a posting, provide answers, and confirm the application before submission.",
      400,
    );
  }

  const clientKey = parseIdempotencyKey(request);
  if (!clientKey)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide an Idempotency-Key.",
      400,
    );

  const posting = await findPublicPosting(context.env.DB, body.postingId);
  if (!posting)
    return featureError(context, "NOT_FOUND", "Posting not found.", 404);

  const idempotencyKey = scopedIdempotencyKey(
    `application:create:${posting.id}`,
    actor.subject,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ postingId: posting.id, answers: body.answers }),
  );
  const replay = await findIdempotentResponse(
    context.env.DB,
    idempotencyKey,
    requestHash,
  );
  if (replay) {
    const applicationId = (replay as StoredApplicationResponse).applicationId;
    const saved = applicationId
      ? await findApplicantApplication(
          context.env.DB,
          actor.subject,
          applicationId,
        )
      : null;
    if (!saved)
      return featureError(context, "NOT_FOUND", "Application not found.", 404);
    return featureJson(context, {
      apiVersion: API_VERSION,
      application: applicantApplicationView(saved),
    });
  }

  const now = new Date().toISOString();
  const applicationId = await stableId("app", idempotencyKey);
  const auditId = await stableId("audit", `${idempotencyKey}:submitted`);
  const eventKey = `application.submitted:${idempotencyKey}`;
  const eventId = await stableId("evt", eventKey);
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO applications (
          id, posting_id, applicant_subject, answers_json, status, sample,
          submitted_at, updated_at
        ) VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?)`,
    ).bind(
      applicationId,
      posting.id,
      actor.subject,
      JSON.stringify(body.answers),
      posting.sample,
      now,
      now,
    ),
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO audit_events (
        id, actor_subject, organization_id, action, entity_type, entity_id,
        details_json, created_at
      ) SELECT ?, ?, ?, 'application_submitted', 'application', ?, ?, ?
        WHERE changes() = 1`,
    ).bind(
      auditId,
      actor.subject,
      posting.organization_id,
      applicationId,
      JSON.stringify({ status: "submitted", sample: posting.sample === 1 }),
      now,
    ),
    outboxStatement(context.env.DB, {
      eventId,
      eventType: "application.submitted",
      occurredAt: now,
      actorKind: "applicant",
      actorSubject: actor.subject,
      organizationId: posting.organization_id,
      aggregateType: "application",
      aggregateId: applicationId,
      idempotencyKey: eventKey,
      payload: { status: "submitted", sample: posting.sample === 1 },
    }),
    idempotencyStatement(context.env.DB, {
      key: idempotencyKey,
      requestHash,
      aggregateType: "application",
      aggregateId: applicationId,
      response: { applicationId },
      createdAt: now,
    }),
  ]);

  const saved = await findApplicantApplication(
    context.env.DB,
    actor.subject,
    applicationId,
  );
  if (!saved)
    return featureError(
      context,
      "APPLICATION_EXISTS",
      "An application already exists for this posting.",
      409,
    );
  return featureJson(
    context,
    { apiVersion: API_VERSION, application: applicantApplicationView(saved) },
    201,
  );
}

async function listApplicantApplications(
  request: Request,
  context: FeatureContext,
): Promise<Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (!canPerformOwnerAction(actor, "application:read_own", actor.subject))
    return featureError(
      context,
      "FORBIDDEN",
      "Applications are unavailable.",
      403,
    );
  const rows = await context.env.DB.prepare(
    `SELECT a.id, a.posting_id, a.applicant_subject, a.answers_json, a.status,
       a.sample, a.submitted_at, a.updated_at, p.title
     FROM applications AS a JOIN postings AS p ON p.id = a.posting_id
     WHERE a.applicant_subject = ? ORDER BY a.submitted_at DESC LIMIT 50`,
  )
    .bind(actor.subject)
    .all<ApplicationRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    applications: (rows.results ?? []).map(applicantApplicationView),
  });
}

async function getApplicantApplication(
  request: Request,
  applicationId: string,
  context: FeatureContext,
): Promise<Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (!canPerformOwnerAction(actor, "application:read_own", actor.subject))
    return featureError(
      context,
      "FORBIDDEN",
      "Applications are unavailable.",
      403,
    );
  const row = await findApplicantApplication(
    context.env.DB,
    actor.subject,
    applicationId,
  );
  if (!row)
    return featureError(context, "NOT_FOUND", "Application not found.", 404);
  return featureJson(context, {
    apiVersion: API_VERSION,
    application: applicantApplicationView(row),
  });
}

async function listOrganizationApplications(
  request: Request,
  organizationId: string,
  context: FeatureContext,
): Promise<Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (
    !canPerformOrganizationAction(
      actor,
      "application:read_organization",
      organizationId,
    )
  )
    return featureError(
      context,
      "FORBIDDEN",
      "Applications are unavailable to this role or organization.",
      403,
    );
  const rows = await context.env.DB.prepare(
    `SELECT a.id, a.posting_id, a.applicant_subject, a.answers_json, a.status,
       a.sample, a.submitted_at, a.updated_at, p.title, p.organization_id
     FROM applications AS a JOIN postings AS p ON p.id = a.posting_id
     WHERE p.organization_id = ?
     ORDER BY a.submitted_at DESC LIMIT 100`,
  )
    .bind(organizationId)
    .all<ApplicationRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    applications: (rows.results ?? []).map(staffApplicationView),
  });
}

async function changeApplicationStatus(
  request: Request,
  organizationId: string,
  applicationId: string,
  context: FeatureContext,
): Promise<Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (
    !canPerformOrganizationAction(
      actor,
      "application:review_organization",
      organizationId,
    )
  )
    return featureError(
      context,
      "FORBIDDEN",
      "This role cannot review applications.",
      403,
    );

  const body = await jsonBody<ApplicationStatusBody>(request);
  const nextStatus = body?.status;
  const clientKey = parseIdempotencyKey(request);
  if (
    typeof nextStatus !== "string" ||
    !Object.hasOwn(APPLICATION_TRANSITIONS, nextStatus) ||
    !clientKey
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a valid status and Idempotency-Key.",
      400,
    );

  const idempotencyKey = scopedIdempotencyKey(
    `application:status:${applicationId}`,
    actor.subject,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ applicationId, organizationId, status: nextStatus }),
  );
  const replay = await findIdempotentResponse(
    context.env.DB,
    idempotencyKey,
    requestHash,
  );
  if (replay)
    return featureJson(context, {
      apiVersion: API_VERSION,
      application: replay,
    });

  const current = await findOrganizationApplication(
    context.env.DB,
    organizationId,
    applicationId,
  );
  if (!current)
    return featureError(context, "NOT_FOUND", "Application not found.", 404);
  const next = nextStatus as ApplicationStatus;
  if (!APPLICATION_TRANSITIONS[current.status].includes(next))
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      `Application cannot move from ${current.status} to ${next}.`,
      409,
    );

  const now = new Date().toISOString();
  const responseBody = { id: applicationId, status: next };
  const auditId = await stableId("audit", `${idempotencyKey}:status`);
  const eventKey = `application.status_changed:${idempotencyKey}`;
  const eventId = await stableId("evt", eventKey);
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE applications SET status = ?, updated_at = ?
         WHERE id = ? AND status = ? AND posting_id IN (
           SELECT id FROM postings WHERE organization_id = ?
         )`,
    ).bind(next, now, applicationId, current.status, organizationId),
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO audit_events (
        id, actor_subject, organization_id, action, entity_type, entity_id,
        details_json, created_at
      ) SELECT ?, ?, ?, 'application_status_changed', 'application', ?, ?, ?
        WHERE changes() = 1`,
    ).bind(
      auditId,
      actor.subject,
      organizationId,
      applicationId,
      JSON.stringify({ previousStatus: current.status, status: next }),
      now,
    ),
    outboxStatement(context.env.DB, {
      eventId,
      eventType: "application.status_changed",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "application",
      aggregateId: applicationId,
      idempotencyKey: eventKey,
      payload: { previousStatus: current.status, status: next },
    }),
    idempotencyStatement(context.env.DB, {
      key: idempotencyKey,
      requestHash,
      aggregateType: "application",
      aggregateId: applicationId,
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
      "The application changed before this update could be applied.",
      409,
    );
  return featureJson(context, { apiVersion: API_VERSION, application: saved });
}

async function findPublicPosting(
  database: D1Database,
  postingId: string,
): Promise<PostingRow | null> {
  return database
    .prepare(
      `SELECT p.id, p.organization_id, o.display_name AS organization_name,
        p.title, p.description, p.location_name, p.sample
       FROM postings AS p JOIN organizations AS o ON o.id = p.organization_id
       WHERE p.id = ? AND p.status = 'published' AND (
         (p.sample = 1 AND o.sample = 1) OR
         (p.sample = 0 AND o.sample = 0 AND o.verification_status = 'verified')
       )`,
    )
    .bind(postingId)
    .first<PostingRow>();
}

async function findApplicantApplication(
  database: D1Database,
  subject: string,
  applicationId: string,
): Promise<ApplicationRow | null> {
  return database
    .prepare(
      `SELECT a.id, a.posting_id, a.applicant_subject, a.answers_json, a.status,
        a.sample, a.submitted_at, a.updated_at, p.title
       FROM applications AS a JOIN postings AS p ON p.id = a.posting_id
       WHERE a.id = ? AND a.applicant_subject = ?`,
    )
    .bind(applicationId, subject)
    .first<ApplicationRow>();
}

async function findOrganizationApplication(
  database: D1Database,
  organizationId: string,
  applicationId: string,
): Promise<ApplicationRow | null> {
  return database
    .prepare(
      `SELECT a.id, a.posting_id, a.applicant_subject, a.answers_json, a.status,
        a.sample, a.submitted_at, a.updated_at, p.title, p.organization_id
       FROM applications AS a JOIN postings AS p ON p.id = a.posting_id
       WHERE a.id = ? AND p.organization_id = ?`,
    )
    .bind(applicationId, organizationId)
    .first<ApplicationRow>();
}

function publicPostingView(posting: PostingRow) {
  return {
    id: posting.id,
    organizationName: posting.organization_name,
    title: posting.title,
    description: posting.description,
    location: posting.location_name,
    sample: posting.sample === 1,
  };
}

function applicantApplicationView(application: ApplicationRow) {
  return {
    id: application.id,
    postingId: application.posting_id,
    postingTitle: application.title,
    status: application.status,
    sample: application.sample === 1,
    submittedAt: application.submitted_at,
    updatedAt: application.updated_at,
    answers: JSON.parse(application.answers_json) as Record<string, string>,
  };
}

function staffApplicationView(application: ApplicationRow) {
  return {
    ...applicantApplicationView(application),
    applicantSubject: application.applicant_subject,
  };
}

function isAnswerMap(value: unknown): value is Record<string, string> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length === 0 ||
    Object.keys(value).length > MAX_ANSWER_COUNT
  )
    return false;
  let totalLength = 0;
  for (const [question, answer] of Object.entries(value)) {
    if (
      question.trim().length === 0 ||
      question.length > 120 ||
      typeof answer !== "string" ||
      answer.trim().length === 0 ||
      answer.length > MAX_ANSWER_LENGTH
    )
      return false;
    totalLength += question.length + answer.length;
    if (totalLength > MAX_APPLICATION_LENGTH) return false;
  }
  return true;
}

async function jsonBody<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}
