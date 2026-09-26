import { API_VERSION } from "@civicresolve/contracts/v1";
import type { D1Database, D1PreparedStatement } from "@civicresolve/db/d1";
import {
  PROGRAM_APPLICATION_TRANSITIONS,
  parseProgramAnswers,
  parseProgramQuestions,
  type ProgramApplicationStatus,
  type ProgramQuestion,
} from "@civicresolve/domain/program-intake";
import {
  canPerformOrganizationAction,
  canPerformOwnerAction,
} from "@civicresolve/domain/permissions";
import {
  authenticateRequest,
  type AuthenticatedActor,
} from "../../auth/identity.js";
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

interface ProgramRow {
  id: string;
  organization_id: string;
  organization_name: string;
  kind: "grant" | "benefit";
  title: string;
  summary: string;
  questions_json: string;
  status: "draft" | "published" | "closed";
  sample: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closed_at: string | null;
}

interface ApplicationRow {
  id: string;
  program_id: string;
  organization_id: string;
  program_title: string;
  program_questions_json: string;
  applicant_subject: string;
  answers_json: string;
  status: ProgramApplicationStatus;
  sample: number;
  submitted_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  author_kind: "applicant" | "sponsor";
  body: string;
  created_at: string;
}

const ID = "([A-Za-z0-9_-]{1,120})";
const programPath = new RegExp(`^/api/v1/programs/${ID}$`);
const staffProgramPath = new RegExp(
  `^/api/v1/staff/organizations/${ID}/programs(?:/${ID})?(?:/(publish|close))?$`,
);
const applicationPath = new RegExp(
  `^/api/v1/program-applications/${ID}(?:/(messages))?$`,
);
const staffApplicationPath = new RegExp(
  `^/api/v1/staff/organizations/${ID}/program-applications(?:/${ID})?(?:/(status|messages))?$`,
);

export async function handleProgramIntakeRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  if (url.pathname === "/api/v1/programs") {
    return request.method === "GET"
      ? listPublicPrograms(context)
      : methodError(context);
  }
  const publicProgram = url.pathname.match(programPath);
  if (publicProgram) {
    return request.method === "GET"
      ? getPublicProgram(publicProgram[1]!, context)
      : methodError(context);
  }
  const staffProgram = url.pathname.match(staffProgramPath);
  if (staffProgram) {
    const [, orgId, id, action] = staffProgram;
    if (!orgId) return null;
    if (!id && request.method === "GET")
      return listStaffPrograms(request, orgId, context);
    if (!id && request.method === "POST")
      return createProgram(request, orgId, context);
    if (id && !action && request.method === "GET")
      return getStaffProgram(request, orgId, id, context);
    if (id && !action && request.method === "PATCH")
      return editProgram(request, orgId, id, context);
    if (id && action && request.method === "POST")
      return changeProgramState(
        request,
        orgId,
        id,
        action as "publish" | "close",
        context,
      );
    return methodError(context);
  }
  if (url.pathname === "/api/v1/program-applications") {
    if (request.method === "GET") return listOwnApplications(request, context);
    if (request.method === "POST") return submitApplication(request, context);
    return methodError(context);
  }
  const ownApplication = url.pathname.match(applicationPath);
  if (ownApplication) {
    const [, id, action] = ownApplication;
    if (!id) return null;
    if (action === "messages" && request.method === "GET")
      return listMessages(request, id, null, context);
    if (action === "messages" && request.method === "POST")
      return addMessage(request, id, null, context);
    if (!action && request.method === "GET")
      return getApplication(request, id, null, context);
    return methodError(context);
  }
  const staffApplication = url.pathname.match(staffApplicationPath);
  if (staffApplication) {
    const [, orgId, id, action] = staffApplication;
    if (!orgId) return null;
    if (!id && request.method === "GET")
      return listStaffApplications(request, orgId, context);
    if (id && !action && request.method === "GET")
      return getApplication(request, id, orgId, context);
    if (id && action === "status" && request.method === "PATCH")
      return changeApplicationStatus(request, id, orgId, context);
    if (id && action === "messages" && request.method === "GET")
      return listMessages(request, id, orgId, context);
    if (id && action === "messages" && request.method === "POST")
      return addMessage(request, id, orgId, context);
    return methodError(context);
  }
  return null;
}

function methodError(context: FeatureContext): Response {
  return featureError(
    context,
    "METHOD_NOT_ALLOWED",
    "Method not allowed.",
    405,
  );
}

async function listPublicPrograms(context: FeatureContext): Promise<Response> {
  const result = await context.env.DB.prepare(
    `SELECT p.*, o.display_name AS organization_name FROM sponsor_programs p
     JOIN organizations o ON o.id = p.organization_id
     WHERE p.status = 'published' AND ((p.sample = 1 AND o.sample = 1)
       OR (p.sample = 0 AND o.sample = 0 AND o.verification_status = 'verified'))
     ORDER BY p.created_at DESC LIMIT 100`,
  ).all<ProgramRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    programs: (result.results ?? []).map(programView),
  });
}

async function getPublicProgram(
  id: string,
  context: FeatureContext,
): Promise<Response> {
  const row = await context.env.DB.prepare(
    `SELECT p.*, o.display_name AS organization_name FROM sponsor_programs p
     JOIN organizations o ON o.id = p.organization_id
     WHERE p.id = ? AND p.status = 'published' AND ((p.sample = 1 AND o.sample = 1)
       OR (p.sample = 0 AND o.sample = 0 AND o.verification_status = 'verified'))`,
  )
    .bind(id)
    .first<ProgramRow>();
  return row
    ? featureJson(context, {
        apiVersion: API_VERSION,
        program: programView(row),
      })
    : featureError(context, "NOT_FOUND", "Program not found.", 404);
}

async function listStaffPrograms(
  request: Request,
  orgId: string,
  context: FeatureContext,
): Promise<Response> {
  const actor = await sponsorActor(request, orgId, context);
  if (actor instanceof Response) return actor;
  const result = await context.env.DB.prepare(
    `SELECT p.*, o.display_name AS organization_name FROM sponsor_programs p
     JOIN organizations o ON o.id = p.organization_id WHERE p.organization_id = ?
     ORDER BY p.created_at DESC LIMIT 100`,
  )
    .bind(orgId)
    .all<ProgramRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    programs: (result.results ?? []).map(programView),
  });
}

async function getStaffProgram(
  request: Request,
  orgId: string,
  id: string,
  context: FeatureContext,
): Promise<Response> {
  const actor = await sponsorActor(request, orgId, context);
  if (actor instanceof Response) return actor;
  const program = await findProgram(context.env.DB, orgId, id);
  return program
    ? featureJson(context, {
        apiVersion: API_VERSION,
        program: programView(program),
      })
    : featureError(context, "NOT_FOUND", "Program not found.", 404);
}

function programFields(
  body: unknown,
  partial: boolean,
): {
  kind?: "grant" | "benefit";
  title?: string;
  summary?: string;
  questions?: ProgramQuestion[];
} | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (
    partial &&
    !["kind", "title", "summary", "questions"].some((key) =>
      Object.hasOwn(input, key),
    )
  )
    return null;
  const result: {
    kind?: "grant" | "benefit";
    title?: string;
    summary?: string;
    questions?: ProgramQuestion[];
  } = {};
  if (!partial || input.kind !== undefined) {
    if (input.kind !== "grant" && input.kind !== "benefit") return null;
    result.kind = input.kind;
  }
  for (const key of ["title", "summary"] as const) {
    if (partial && input[key] === undefined) continue;
    const value = input[key];
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > (key === "title" ? 160 : 4000)
    )
      return null;
    result[key] = value.trim();
  }
  if (!partial || input.questions !== undefined) {
    const questions = parseProgramQuestions(input.questions);
    if (!questions) return null;
    result.questions = questions;
  }
  return result;
}

async function createProgram(
  request: Request,
  orgId: string,
  context: FeatureContext,
): Promise<Response> {
  const actor = await sponsorActor(request, orgId, context);
  if (actor instanceof Response) return actor;
  const fields = programFields(await jsonBody(request), false);
  if (!fields)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a program kind, title, summary, and intake questions.",
      400,
    );
  const organization = await context.env.DB.prepare(
    "SELECT sample FROM organizations WHERE id = ?",
  )
    .bind(orgId)
    .first<{ sample: number }>();
  if (!organization)
    return featureError(context, "NOT_FOUND", "Organization not found.", 404);
  const id = `prg_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO sponsor_programs (id, organization_id, kind, title, summary, questions_json, status, sample, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    ).bind(
      id,
      orgId,
      fields.kind!,
      fields.title!,
      fields.summary!,
      JSON.stringify(fields.questions),
      organization.sample,
      now,
      now,
    ),
    audit(
      context.env.DB,
      actor,
      orgId,
      "program_created",
      id,
      { status: "draft" },
      now,
    ),
    event(
      context.env.DB,
      actor,
      orgId,
      "program.created",
      "program",
      id,
      { sample: organization.sample === 1 },
      now,
    ),
  ]);
  const row = await findProgram(context.env.DB, orgId, id);
  return featureJson(
    context,
    { apiVersion: API_VERSION, program: programView(row!) },
    201,
  );
}

async function editProgram(
  request: Request,
  orgId: string,
  id: string,
  context: FeatureContext,
): Promise<Response> {
  const actor = await sponsorActor(request, orgId, context);
  if (actor instanceof Response) return actor;
  const current = await findProgram(context.env.DB, orgId, id);
  if (!current)
    return featureError(context, "NOT_FOUND", "Program not found.", 404);
  if (current.status !== "draft")
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "Close this program before creating a revised form.",
      409,
    );
  const fields = programFields(await jsonBody(request), true);
  if (!fields)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide valid program fields.",
      400,
    );
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE sponsor_programs SET kind = ?, title = ?, summary = ?, questions_json = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND status = 'draft'`,
    ).bind(
      fields.kind ?? current.kind,
      fields.title ?? current.title,
      fields.summary ?? current.summary,
      JSON.stringify(fields.questions ?? JSON.parse(current.questions_json)),
      now,
      id,
      orgId,
    ),
    audit(context.env.DB, actor, orgId, "program_updated", id, {}, now),
  ]);
  const row = await findProgram(context.env.DB, orgId, id);
  return featureJson(context, {
    apiVersion: API_VERSION,
    program: programView(row!),
  });
}

async function changeProgramState(
  request: Request,
  orgId: string,
  id: string,
  operation: "publish" | "close",
  context: FeatureContext,
): Promise<Response> {
  const actor = await sponsorActor(request, orgId, context);
  if (actor instanceof Response) return actor;
  const current = await findProgram(context.env.DB, orgId, id);
  if (!current)
    return featureError(context, "NOT_FOUND", "Program not found.", 404);
  const expected = operation === "publish" ? "draft" : "published";
  if (current.status !== expected)
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "Program state has changed.",
      409,
    );
  if (operation === "publish" && current.sample === 0) {
    const verified = await context.env.DB.prepare(
      "SELECT id FROM organizations WHERE id = ? AND sample = 0 AND verification_status = 'verified'",
    )
      .bind(orgId)
      .first<{ id: string }>();
    if (!verified)
      return featureError(
        context,
        "FORBIDDEN",
        "Sponsor verification is required to publish.",
        403,
      );
  }
  const now = new Date().toISOString();
  const status = operation === "publish" ? "published" : "closed";
  const result = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE sponsor_programs SET status = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END,
       closed_at = CASE WHEN ? = 'closed' THEN ? ELSE closed_at END
       WHERE id = ? AND organization_id = ? AND status = ?`,
    ).bind(status, now, status, now, status, now, id, orgId, expected),
    audit(
      context.env.DB,
      actor,
      orgId,
      `program_${status}`,
      id,
      { status },
      now,
    ),
    event(
      context.env.DB,
      actor,
      orgId,
      `program.${status}`,
      "program",
      id,
      { status },
      now,
    ),
  ]);
  if (result[0]?.meta.changes !== 1)
    return featureError(context, "CONFLICT", "Program state has changed.", 409);
  const row = await findProgram(context.env.DB, orgId, id);
  return featureJson(context, {
    apiVersion: API_VERSION,
    program: programView(row!),
  });
}

async function submitApplication(
  request: Request,
  context: FeatureContext,
): Promise<Response> {
  const actor = await applicantActor(request, true, context);
  if (actor instanceof Response) return actor;
  const body = (await jsonBody(request)) as Record<string, unknown> | null;
  const programId = body?.programId;
  if (
    typeof programId !== "string" ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(programId) ||
    body?.confirmedByApplicant !== true
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Choose a program and review your answers before submitting.",
      400,
    );
  const program = await context.env.DB.prepare(
    `SELECT p.*, o.display_name AS organization_name FROM sponsor_programs p
     JOIN organizations o ON o.id = p.organization_id
     WHERE p.id = ? AND p.status = 'published' AND ((p.sample = 1 AND o.sample = 1)
       OR (p.sample = 0 AND o.sample = 0 AND o.verification_status = 'verified'))`,
  )
    .bind(programId)
    .first<ProgramRow>();
  if (!program)
    return featureError(
      context,
      "NOT_FOUND",
      "Participating program not found.",
      404,
    );
  if (program.sample === 1 && body?.sandboxAcknowledged !== true)
    return featureError(
      context,
      "SANDBOX_ACKNOWLEDGMENT_REQUIRED",
      "Confirm that this practice application does not reach a government sponsor.",
      400,
    );
  const answers = parseProgramAnswers(
    body?.answers,
    JSON.parse(program.questions_json) as ProgramQuestion[],
  );
  if (!answers)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Complete the required program questions.",
      400,
    );
  const clientKey = parseIdempotencyKey(request);
  if (!clientKey)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide an Idempotency-Key.",
      400,
    );
  const key = scopedIdempotencyKey(
    `program-application:create:${program.id}`,
    actor.subject,
    clientKey,
  );
  const hash = await sha256Hex(JSON.stringify({ programId, answers }));
  const replay = await findIdempotentResponse(context.env.DB, key, hash);
  if (replay) {
    const prior = await findApplication(
      context.env.DB,
      (replay as { applicationId: string }).applicationId,
    );
    return prior
      ? featureJson(context, {
          apiVersion: API_VERSION,
          application: applicationView(prior),
        })
      : featureError(context, "NOT_FOUND", "Application not found.", 404);
  }
  const existing = await context.env.DB.prepare(
    "SELECT id FROM program_applications WHERE program_id = ? AND applicant_subject = ?",
  )
    .bind(program.id, actor.subject)
    .first<{ id: string }>();
  if (existing)
    return featureError(
      context,
      "ALREADY_SUBMITTED",
      "You have already submitted to this program.",
      409,
    );
  const id = await stableId("papp", key);
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO program_applications (id, program_id, applicant_subject, answers_json, status, sample, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?)`,
    ).bind(
      id,
      program.id,
      actor.subject,
      JSON.stringify(answers),
      program.sample,
      now,
      now,
    ),
    audit(
      context.env.DB,
      actor,
      program.organization_id,
      "program_application_submitted",
      id,
      { programId: program.id },
      now,
    ),
    event(
      context.env.DB,
      actor,
      program.organization_id,
      "program_application.submitted",
      "program_application",
      id,
      { programId: program.id, sample: program.sample === 1 },
      now,
    ),
    idempotencyStatement(context.env.DB, {
      key,
      requestHash: hash,
      aggregateType: "program_application",
      aggregateId: id,
      response: { applicationId: id },
      createdAt: now,
    }),
  ]);
  const application = await findApplication(context.env.DB, id);
  return featureJson(
    context,
    { apiVersion: API_VERSION, application: applicationView(application!) },
    201,
  );
}

async function listOwnApplications(
  request: Request,
  context: FeatureContext,
): Promise<Response> {
  const actor = await applicantActor(request, false, context);
  if (actor instanceof Response) return actor;
  const result = await context.env.DB.prepare(
    `SELECT a.*, p.organization_id, p.title AS program_title, p.questions_json AS program_questions_json FROM program_applications a
     JOIN sponsor_programs p ON p.id = a.program_id WHERE a.applicant_subject = ?
     ORDER BY a.submitted_at DESC LIMIT 100`,
  )
    .bind(actor.subject)
    .all<ApplicationRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    applications: (result.results ?? []).map(applicationView),
  });
}

async function listStaffApplications(
  request: Request,
  orgId: string,
  context: FeatureContext,
): Promise<Response> {
  const actor = await sponsorActor(request, orgId, context);
  if (actor instanceof Response) return actor;
  const result = await context.env.DB.prepare(
    `SELECT a.*, p.organization_id, p.title AS program_title, p.questions_json AS program_questions_json FROM program_applications a
     JOIN sponsor_programs p ON p.id = a.program_id WHERE p.organization_id = ?
     ORDER BY a.submitted_at DESC LIMIT 100`,
  )
    .bind(orgId)
    .all<ApplicationRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    applications: (result.results ?? []).map(applicationView),
  });
}

async function getApplication(
  request: Request,
  id: string,
  orgId: string | null,
  context: FeatureContext,
): Promise<Response> {
  const access = await applicationAccess(request, id, orgId, false, context);
  if (access instanceof Response) return access;
  return featureJson(context, {
    apiVersion: API_VERSION,
    application: applicationView(access.application),
  });
}

async function changeApplicationStatus(
  request: Request,
  id: string,
  orgId: string,
  context: FeatureContext,
): Promise<Response> {
  const access = await applicationAccess(request, id, orgId, true, context);
  if (access instanceof Response) return access;
  const body = (await jsonBody(request)) as Record<string, unknown> | null;
  const status = body?.status as ProgramApplicationStatus | undefined;
  if (
    !status ||
    !PROGRAM_APPLICATION_TRANSITIONS[access.application.status].includes(status)
  )
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "Choose a valid next status.",
      409,
    );
  const now = new Date().toISOString();
  const result = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE program_applications SET status = ?, updated_at = ? WHERE id = ? AND status = ? AND program_id IN
       (SELECT id FROM sponsor_programs WHERE organization_id = ?)`,
    ).bind(status, now, id, access.application.status, orgId),
    audit(
      context.env.DB,
      access.actor,
      orgId,
      "program_application_status_changed",
      id,
      { from: access.application.status, to: status },
      now,
    ),
    event(
      context.env.DB,
      access.actor,
      orgId,
      "program_application.status_changed",
      "program_application",
      id,
      { from: access.application.status, to: status },
      now,
    ),
  ]);
  if (result[0]?.meta.changes !== 1)
    return featureError(
      context,
      "CONFLICT",
      "Application state has changed.",
      409,
    );
  const updated = await findApplication(context.env.DB, id);
  return featureJson(context, {
    apiVersion: API_VERSION,
    application: applicationView(updated!),
  });
}

async function listMessages(
  request: Request,
  id: string,
  orgId: string | null,
  context: FeatureContext,
): Promise<Response> {
  const access = await applicationAccess(request, id, orgId, false, context);
  if (access instanceof Response) return access;
  const result = await context.env.DB.prepare(
    `SELECT id, author_kind, body, created_at FROM program_application_messages
     WHERE application_id = ? ORDER BY created_at ASC, id ASC LIMIT 500`,
  )
    .bind(id)
    .all<MessageRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    messages: (result.results ?? []).map(messageView),
  });
}

async function addMessage(
  request: Request,
  id: string,
  orgId: string | null,
  context: FeatureContext,
): Promise<Response> {
  const access = await applicationAccess(request, id, orgId, true, context);
  if (access instanceof Response) return access;
  const body = (await jsonBody(request)) as Record<string, unknown> | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4000)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a message up to 4,000 characters.",
      400,
    );
  const messageId = `pmsg_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  const authorKind = orgId ? "sponsor" : "applicant";
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO program_application_messages (id, application_id, author_kind, author_subject, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(messageId, id, authorKind, access.actor.subject, message, now),
    audit(
      context.env.DB,
      access.actor,
      access.application.organization_id,
      "program_application_message_added",
      id,
      { messageId, authorKind },
      now,
    ),
    event(
      context.env.DB,
      access.actor,
      access.application.organization_id,
      "program_application.message_added",
      "program_application",
      id,
      { messageId, authorKind },
      now,
    ),
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

async function sponsorActor(
  request: Request,
  orgId: string,
  context: FeatureContext,
): Promise<AuthenticatedActor | Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (!canPerformOrganizationAction(actor, "organization:manage_own", orgId))
    return featureError(
      context,
      "FORBIDDEN",
      "This program workspace is unavailable to your organization.",
      403,
    );
  return actor;
}

async function applicantActor(
  request: Request,
  write: boolean,
  context: FeatureContext,
): Promise<AuthenticatedActor | Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (
    !canPerformOwnerAction(
      actor,
      write ? "application:submit_own" : "application:read_own",
      actor.subject,
    )
  )
    return featureError(
      context,
      "FORBIDDEN",
      "Applications are unavailable to this account.",
      403,
    );
  return actor;
}

async function applicationAccess(
  request: Request,
  id: string,
  orgId: string | null,
  write: boolean,
  context: FeatureContext,
): Promise<
  { actor: AuthenticatedActor; application: ApplicationRow } | Response
> {
  const actor = orgId
    ? await sponsorActor(request, orgId, context)
    : await applicantActor(request, write, context);
  if (actor instanceof Response) return actor;
  const application = await findApplication(context.env.DB, id);
  if (
    !application ||
    (orgId
      ? application.organization_id !== orgId
      : application.applicant_subject !== actor.subject)
  )
    return featureError(context, "NOT_FOUND", "Application not found.", 404);
  return { actor, application };
}

async function findProgram(
  db: D1Database,
  orgId: string,
  id: string,
): Promise<ProgramRow | null> {
  return db
    .prepare(
      `SELECT p.*, o.display_name AS organization_name FROM sponsor_programs p
     JOIN organizations o ON o.id = p.organization_id WHERE p.id = ? AND p.organization_id = ?`,
    )
    .bind(id, orgId)
    .first<ProgramRow>();
}

async function findApplication(
  db: D1Database,
  id: string,
): Promise<ApplicationRow | null> {
  return db
    .prepare(
      `SELECT a.*, p.organization_id, p.title AS program_title, p.questions_json AS program_questions_json FROM program_applications a
     JOIN sponsor_programs p ON p.id = a.program_id WHERE a.id = ?`,
    )
    .bind(id)
    .first<ApplicationRow>();
}

function programView(row: ProgramRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sponsor: row.organization_name,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    questions: JSON.parse(row.questions_json) as ProgramQuestion[],
    status: row.status,
    sample: row.sample === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    closedAt: row.closed_at,
  };
}

function applicationView(row: ApplicationRow) {
  return {
    id: row.id,
    programId: row.program_id,
    programTitle: row.program_title,
    status: row.status,
    sample: row.sample === 1,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    answers: JSON.parse(row.answers_json) as Record<string, string>,
    questions: JSON.parse(row.program_questions_json) as ProgramQuestion[],
  };
}

function messageView(row: MessageRow) {
  return {
    id: row.id,
    author: row.author_kind,
    body: row.body,
    createdAt: row.created_at,
  };
}

function audit(
  db: D1Database,
  actor: AuthenticatedActor,
  orgId: string,
  action: string,
  id: string,
  details: unknown,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_events (id, actor_subject, organization_id, action, entity_type, entity_id, details_json, created_at)
     SELECT ?, ?, ?, ?, 'program_intake', ?, ?, ? WHERE changes() = 1`,
    )
    .bind(
      crypto.randomUUID(),
      actor.subject,
      orgId,
      action,
      id,
      JSON.stringify(details),
      now,
    );
}

function event(
  db: D1Database,
  actor: AuthenticatedActor,
  orgId: string,
  eventType: string,
  aggregateType: string,
  id: string,
  payload: unknown,
  now: string,
): D1PreparedStatement {
  return outboxStatement(db, {
    eventId: crypto.randomUUID(),
    eventType,
    occurredAt: now,
    actorKind: actor.organizationId === orgId ? "staff" : "applicant",
    actorSubject: actor.subject,
    organizationId: orgId,
    aggregateType,
    aggregateId: id,
    idempotencyKey: `${eventType}:${id}:${crypto.randomUUID()}`,
    payload,
  });
}

async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
