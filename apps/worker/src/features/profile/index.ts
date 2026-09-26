import { API_VERSION } from "@civicresolve/contracts/v1";
import {
  canPerformOrganizationAction,
  canPerformOwnerAction,
} from "@civicresolve/domain/permissions";
import {
  EMPTY_APPLICANT_PROFILE,
  extractResumeText,
  suggestResumeFields,
  UnsupportedResumeDocumentError,
  validateApplicantProfile,
  type ApplicantProfile,
} from "@civicresolve/domain/profile";
import {
  privateAssetKey as makePrivateAssetKey,
  type D1Database,
  type R2Bucket,
} from "@civicresolve/db/d1";
import { authenticateRequest } from "../../auth/identity.js";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_RESUME_COUNT = 10;
const MAX_RESUME_SUGGESTIONS = 256;
const RETENTION_DAYS = 365;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const PROFILE_RECORD_ID = "profile";

type ProfileEnvironment = FeatureContext["env"] & { PRIVATE_ASSETS: R2Bucket };
type ProfileContext = Omit<FeatureContext, "env"> & { env: ProfileEnvironment };

interface ResumeRow {
  id: string;
  owner_subject: string;
  retention_expires_at: string;
  created_at: string;
  object_key: string;
  filename: string;
  content_type: string;
  byte_size: number;
}

interface ExtractionRow {
  extracted_text: string;
  suggestions_json: string;
  extracted_at: string;
}

type ResumeContentType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function handleProfileRequest(
  request: Request,
  url: URL,
  context: ProfileContext,
): Promise<Response | null> {
  const path = url.pathname;
  if (path === "/api/v1/profile") {
    if (request.method === "GET") return getProfile(request, context);
    if (request.method === "PUT") return updateProfile(request, context);
    if (request.method === "DELETE") return deleteProfile(request, context);
    return featureError(
      context,
      "METHOD_NOT_ALLOWED",
      "Use GET, PUT, or DELETE.",
      405,
    );
  }

  if (path === "/api/v1/profile/resumes") {
    if (request.method === "GET") return listResumes(request, context);
    if (request.method === "POST") return uploadResume(request, context);
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET or POST.", 405);
  }

  const resumeMatch = path.match(
    /^\/api\/v1\/profile\/resumes\/([A-Za-z0-9_-]{1,120})$/,
  );
  if (resumeMatch) {
    if (request.method === "GET")
      return readOwnResume(request, resumeMatch[1]!, context);
    if (request.method === "DELETE")
      return deleteOwnResume(request, resumeMatch[1]!, context);
    return featureError(
      context,
      "METHOD_NOT_ALLOWED",
      "Use GET or DELETE.",
      405,
    );
  }

  const extractionMatch = path.match(
    /^\/api\/v1\/profile\/resumes\/([A-Za-z0-9_-]{1,120})\/extract$/,
  );
  if (extractionMatch && request.method === "POST")
    return extractOwnedResume(request, extractionMatch[1]!, context);

  const savedExtractionMatch = path.match(
    /^\/api\/v1\/profile\/resumes\/([A-Za-z0-9_-]{1,120})\/extraction$/,
  );
  if (savedExtractionMatch && request.method === "GET")
    return getOwnedExtraction(request, savedExtractionMatch[1]!, context);

  const shareMatch = path.match(
    /^\/api\/v1\/applications\/([A-Za-z0-9_-]{1,120})\/resume$/,
  );
  if (shareMatch && request.method === "PUT")
    return shareResumeWithApplication(request, shareMatch[1]!, context);

  const staffResumeMatch = path.match(
    /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]{1,120})\/applications\/([A-Za-z0-9_-]{1,120})\/resume$/,
  );
  if (staffResumeMatch && request.method === "GET")
    return readApplicationResume(
      request,
      staffResumeMatch[1]!,
      staffResumeMatch[2]!,
      context,
    );

  return null;
}

async function getProfile(
  request: Request,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(request, "profile:read_own", context);
  if (actor instanceof Response) return actor;
  const row = await context.env.DB.prepare(
    "SELECT profile_json, updated_at FROM applicant_profiles WHERE owner_subject = ?",
  )
    .bind(actor.subject)
    .first<{ profile_json: string; updated_at: string }>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    profile: row
      ? (JSON.parse(row.profile_json) as ApplicantProfile)
      : EMPTY_APPLICANT_PROFILE,
    updatedAt: row?.updated_at ?? null,
  });
}

async function updateProfile(
  request: Request,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(
    request,
    "profile:write_own",
    context,
  );
  if (actor instanceof Response) return actor;
  const body = (await jsonBody(request)) as { profile?: unknown } | null;
  const profile = validateApplicantProfile(body?.profile);
  if (!profile)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a valid profile with supported fields only.",
      400,
    );
  const updatedAt = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO applicant_profiles (owner_subject, profile_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(owner_subject) DO UPDATE SET profile_json = excluded.profile_json, updated_at = excluded.updated_at`,
  )
    .bind(actor.subject, JSON.stringify(profile), updatedAt)
    .run();
  return featureJson(context, { apiVersion: API_VERSION, profile, updatedAt });
}

async function deleteProfile(
  request: Request,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(
    request,
    "profile:write_own",
    context,
  );
  if (actor instanceof Response) return actor;
  const resumes = await ownedResumes(context.env.DB, actor.subject);
  for (const resume of resumes)
    await context.env.PRIVATE_ASSETS.delete(resume.object_key);
  await context.env.DB.batch([
    context.env.DB.prepare(
      "DELETE FROM applicant_profiles WHERE owner_subject = ?",
    ).bind(actor.subject),
    ...resumes.flatMap((resume) =>
      removeResumeStatements(context.env.DB, resume.id, actor.subject),
    ),
  ]);
  return featureJson(context, { apiVersion: API_VERSION, deleted: true });
}

async function listResumes(
  request: Request,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(request, "profile:read_own", context);
  if (actor instanceof Response) return actor;
  await purgeExpiredResumes(
    context.env.DB,
    context.env.PRIVATE_ASSETS,
    actor.subject,
  );
  const resumes = await ownedResumes(context.env.DB, actor.subject);
  return featureJson(context, {
    apiVersion: API_VERSION,
    resumes: resumes.map(resumeView),
    retentionDays: RETENTION_DAYS,
  });
}

async function uploadResume(
  request: Request,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(
    request,
    "profile:write_own",
    context,
  );
  if (actor instanceof Response) return actor;
  await purgeExpiredResumes(
    context.env.DB,
    context.env.PRIVATE_ASSETS,
    actor.subject,
  );
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_RESUME_BYTES + 65_536
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Upload one PDF or DOCX file up to 5 MB.",
      413,
    );
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size <= 0 || file.size > MAX_RESUME_BYTES)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Upload one PDF or DOCX file up to 5 MB.",
      400,
    );
  const filename = safeFilename(file.name);
  if (!filename)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Use a PDF or DOCX filename.",
      400,
    );
  const type = resumeContentType(filename, file.type);
  if (!type)
    return featureError(
      context,
      "UNSUPPORTED_FILE_TYPE",
      "Only PDF and DOCX resumes are supported.",
      415,
    );

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasExpectedSignature(bytes, type))
    return featureError(
      context,
      "INVALID_FILE",
      "The file contents do not match the selected document type.",
      400,
    );

  const count = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM applicant_resumes WHERE owner_subject = ?",
  )
    .bind(actor.subject)
    .first<{ count: number }>();
  if ((count?.count ?? 0) >= MAX_RESUME_COUNT)
    return featureError(
      context,
      "RESUME_LIMIT_REACHED",
      "Delete an existing resume before uploading another.",
      409,
    );

  const id = crypto.randomUUID().replaceAll("-", "");
  const scope = resumeScope(actor.subject);
  const objectKey = makePrivateAssetKey(scope, id);
  const createdAt = new Date();
  const retentionExpiresAt = new Date(
    createdAt.getTime() + RETENTION_MS,
  ).toISOString();
  await context.env.PRIVATE_ASSETS.put(objectKey, bytes, {
    httpMetadata: { contentType: type },
  });
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO private_assets (
          id, organization_id, owner_subject, purpose, record_id, object_key,
          filename, content_type, byte_size, created_at
        ) VALUES (?, NULL, ?, 'resume', ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        actor.subject,
        PROFILE_RECORD_ID,
        objectKey,
        filename,
        type,
        bytes.byteLength,
        createdAt.toISOString(),
      ),
      context.env.DB.prepare(
        "INSERT INTO applicant_resumes (id, owner_subject, retention_expires_at, created_at) VALUES (?, ?, ?, ?)",
      ).bind(id, actor.subject, retentionExpiresAt, createdAt.toISOString()),
    ]);
  } catch (error) {
    await context.env.PRIVATE_ASSETS.delete(objectKey).catch(() => undefined);
    throw error;
  }
  const resume = await findOwnedResume(context.env.DB, actor.subject, id);
  if (!resume)
    return featureError(
      context,
      "INTERNAL_ERROR",
      "The resume could not be saved.",
      500,
    );
  return featureJson(
    context,
    { apiVersion: API_VERSION, resume: resumeView(resume) },
    201,
  );
}

async function readOwnResume(
  request: Request,
  id: string,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(request, "profile:read_own", context);
  if (actor instanceof Response) return actor;
  await purgeExpiredResumes(
    context.env.DB,
    context.env.PRIVATE_ASSETS,
    actor.subject,
  );
  const resume = await findOwnedResume(context.env.DB, actor.subject, id);
  if (!resume)
    return featureError(context, "NOT_FOUND", "Resume not found.", 404);
  return readResumeObject(context, resume);
}

async function deleteOwnResume(
  request: Request,
  id: string,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(
    request,
    "profile:write_own",
    context,
  );
  if (actor instanceof Response) return actor;
  const resume = await findOwnedResume(context.env.DB, actor.subject, id);
  if (!resume)
    return featureError(context, "NOT_FOUND", "Resume not found.", 404);
  await context.env.PRIVATE_ASSETS.delete(resume.object_key);
  await context.env.DB.batch(
    removeResumeStatements(context.env.DB, id, actor.subject),
  );
  return featureJson(context, { apiVersion: API_VERSION, deleted: true });
}

async function extractOwnedResume(
  request: Request,
  id: string,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(request, "profile:read_own", context);
  if (actor instanceof Response) return actor;
  await purgeExpiredResumes(
    context.env.DB,
    context.env.PRIVATE_ASSETS,
    actor.subject,
  );
  const resume = await findOwnedResume(context.env.DB, actor.subject, id);
  if (!resume)
    return featureError(context, "NOT_FOUND", "Resume not found.", 404);
  const object = await context.env.PRIVATE_ASSETS.get(resume.object_key);
  if (!object)
    return featureError(
      context,
      "NOT_FOUND",
      "Resume content is unavailable.",
      404,
    );
  const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
  let text: string;
  try {
    text = await extractResumeText(
      bytes,
      resume.content_type as ResumeContentType,
    );
  } catch (error) {
    if (error instanceof UnsupportedResumeDocumentError)
      return featureError(context, "UNREADABLE_RESUME", error.message, 422);
    throw error;
  }
  const extractedSuggestions = suggestResumeFields(
    text,
    MAX_RESUME_SUGGESTIONS + 1,
  );
  const suggestionsTruncated =
    extractedSuggestions.length > MAX_RESUME_SUGGESTIONS;
  const suggestions = extractedSuggestions.slice(0, MAX_RESUME_SUGGESTIONS);
  const extractedAt = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO resume_extractions (resume_id, extracted_text, suggestions_json, extracted_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(resume_id) DO UPDATE SET extracted_text = excluded.extracted_text,
       suggestions_json = excluded.suggestions_json, extracted_at = excluded.extracted_at`,
  )
    .bind(
      id,
      text,
      JSON.stringify({ suggestions, suggestionsTruncated }),
      extractedAt,
    )
    .run();
  return featureJson(context, {
    apiVersion: API_VERSION,
    extraction: {
      resumeId: id,
      text,
      suggestions,
      suggestionsTruncated,
      extractedAt,
    },
  });
}

async function getOwnedExtraction(
  request: Request,
  id: string,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(request, "profile:read_own", context);
  if (actor instanceof Response) return actor;
  await purgeExpiredResumes(
    context.env.DB,
    context.env.PRIVATE_ASSETS,
    actor.subject,
  );
  const resume = await findOwnedResume(context.env.DB, actor.subject, id);
  if (!resume)
    return featureError(context, "NOT_FOUND", "Resume not found.", 404);
  const extraction = await context.env.DB.prepare(
    "SELECT extracted_text, suggestions_json, extracted_at FROM resume_extractions WHERE resume_id = ?",
  )
    .bind(id)
    .first<ExtractionRow>();
  if (!extraction)
    return featureError(
      context,
      "NOT_FOUND",
      "No extraction is available for this resume.",
      404,
    );
  const saved = JSON.parse(extraction.suggestions_json) as {
    suggestions: ReturnType<typeof suggestResumeFields>;
    suggestionsTruncated: boolean;
  };
  return featureJson(context, {
    apiVersion: API_VERSION,
    extraction: {
      resumeId: id,
      text: extraction.extracted_text,
      suggestions: saved.suggestions,
      suggestionsTruncated: saved.suggestionsTruncated,
      extractedAt: extraction.extracted_at,
    },
  });
}

async function shareResumeWithApplication(
  request: Request,
  applicationId: string,
  context: ProfileContext,
): Promise<Response> {
  const actor = await requireProfileActor(
    request,
    "profile:write_own",
    context,
  );
  if (actor instanceof Response) return actor;
  const body = (await jsonBody(request)) as { resumeId?: unknown } | null;
  if (
    typeof body?.resumeId !== "string" ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(body.resumeId)
  )
    return featureError(context, "INVALID_REQUEST", "Provide a resumeId.", 400);
  await purgeExpiredResumes(
    context.env.DB,
    context.env.PRIVATE_ASSETS,
    actor.subject,
  );
  const [application, resume] = await Promise.all([
    context.env.DB.prepare(
      "SELECT id FROM applications WHERE id = ? AND applicant_subject = ?",
    )
      .bind(applicationId, actor.subject)
      .first<{ id: string }>(),
    findOwnedResume(context.env.DB, actor.subject, body.resumeId),
  ]);
  if (!application)
    return featureError(context, "NOT_FOUND", "Application not found.", 404);
  if (!resume)
    return featureError(context, "NOT_FOUND", "Resume not found.", 404);
  const createdAt = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO application_resume_shares (application_id, resume_id, owner_subject, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(application_id) DO UPDATE SET resume_id = excluded.resume_id,
       owner_subject = excluded.owner_subject, created_at = excluded.created_at`,
  )
    .bind(applicationId, resume.id, actor.subject, createdAt)
    .run();
  return featureJson(context, {
    apiVersion: API_VERSION,
    applicationId,
    resumeId: resume.id,
    sharedAt: createdAt,
  });
}

async function readApplicationResume(
  request: Request,
  organizationId: string,
  applicationId: string,
  context: ProfileContext,
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
  const resume = await context.env.DB.prepare(
    `SELECT r.id, r.owner_subject, r.retention_expires_at, r.created_at,
       p.object_key, p.filename, p.content_type, p.byte_size
     FROM application_resume_shares AS s
     JOIN applications AS a ON a.id = s.application_id AND a.applicant_subject = s.owner_subject
     JOIN postings AS posting ON posting.id = a.posting_id AND posting.organization_id = ?
     JOIN applicant_resumes AS r ON r.id = s.resume_id AND r.owner_subject = s.owner_subject
     JOIN private_assets AS p ON p.id = r.id AND p.owner_subject = r.owner_subject
     WHERE s.application_id = ?`,
  )
    .bind(organizationId, applicationId)
    .first<ResumeRow>();
  if (!resume)
    return featureError(context, "NOT_FOUND", "Shared resume not found.", 404);
  if (Date.parse(resume.retention_expires_at) <= Date.now()) {
    await context.env.PRIVATE_ASSETS.delete(resume.object_key);
    await context.env.DB.batch(
      removeResumeStatements(context.env.DB, resume.id, resume.owner_subject),
    );
    return featureError(
      context,
      "GONE",
      "The resume has passed its retention period.",
      410,
    );
  }
  return readResumeObject(context, resume);
}

async function readResumeObject(
  context: ProfileContext,
  resume: ResumeRow,
): Promise<Response> {
  const object = await context.env.PRIVATE_ASSETS.get(resume.object_key);
  if (!object)
    return featureError(
      context,
      "NOT_FOUND",
      "Resume content is unavailable.",
      404,
    );
  const headers = new Headers(context.cors);
  headers.set("Content-Type", resume.content_type);
  headers.set("Content-Length", String(resume.byte_size));
  headers.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(resume.filename)}`,
  );
  headers.set("Cache-Control", "no-store, private");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}

async function requireProfileActor(
  request: Request,
  action: "profile:read_own" | "profile:write_own",
  context: ProfileContext,
) {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (!canPerformOwnerAction(actor, action, actor.subject))
    return featureError(
      context,
      "FORBIDDEN",
      "Profile access is unavailable to this role.",
      403,
    );
  return actor;
}

async function findOwnedResume(
  database: D1Database,
  owner: string,
  id: string,
): Promise<ResumeRow | null> {
  return database
    .prepare(
      `SELECT r.id, r.owner_subject, r.retention_expires_at, r.created_at,
       p.object_key, p.filename, p.content_type, p.byte_size
     FROM applicant_resumes AS r JOIN private_assets AS p ON p.id = r.id
     WHERE r.owner_subject = ? AND r.id = ? AND p.owner_subject = ? AND p.purpose = 'resume' AND p.record_id = ?`,
    )
    .bind(owner, id, owner, PROFILE_RECORD_ID)
    .first<ResumeRow>();
}

async function ownedResumes(
  database: D1Database,
  owner: string,
): Promise<ResumeRow[]> {
  const result = await database
    .prepare(
      `SELECT r.id, r.owner_subject, r.retention_expires_at, r.created_at,
       p.object_key, p.filename, p.content_type, p.byte_size
     FROM applicant_resumes AS r JOIN private_assets AS p ON p.id = r.id
     WHERE r.owner_subject = ? AND p.owner_subject = ? AND p.purpose = 'resume' AND p.record_id = ?
     ORDER BY r.created_at DESC`,
    )
    .bind(owner, owner, PROFILE_RECORD_ID)
    .all<ResumeRow>();
  return result.results ?? [];
}

async function purgeExpiredResumes(
  database: D1Database,
  bucket: R2Bucket,
  owner: string,
): Promise<void> {
  const now = new Date().toISOString();
  const result = await database
    .prepare(
      `SELECT r.id, r.owner_subject, r.retention_expires_at, r.created_at,
       p.object_key, p.filename, p.content_type, p.byte_size
     FROM applicant_resumes AS r JOIN private_assets AS p ON p.id = r.id
     WHERE r.owner_subject = ? AND r.retention_expires_at <= ? LIMIT 100`,
    )
    .bind(owner, now)
    .all<ResumeRow>();
  for (const resume of result.results ?? []) {
    await bucket.delete(resume.object_key);
    await database.batch(removeResumeStatements(database, resume.id, owner));
  }
}

function removeResumeStatements(
  database: D1Database,
  id: string,
  owner: string,
) {
  return [
    database
      .prepare(
        "DELETE FROM application_resume_shares WHERE resume_id = ? AND owner_subject = ?",
      )
      .bind(id, owner),
    database
      .prepare("DELETE FROM resume_extractions WHERE resume_id = ?")
      .bind(id),
    database
      .prepare(
        "DELETE FROM applicant_resumes WHERE id = ? AND owner_subject = ?",
      )
      .bind(id, owner),
    database
      .prepare(
        "DELETE FROM private_assets WHERE id = ? AND owner_subject = ? AND purpose = 'resume'",
      )
      .bind(id, owner),
  ];
}

function resumeView(resume: ResumeRow) {
  return {
    id: resume.id,
    filename: resume.filename,
    contentType: resume.content_type,
    byteSize: resume.byte_size,
    createdAt: resume.created_at,
    retentionExpiresAt: resume.retention_expires_at,
  };
}

function resumeScope(ownerSubject: string) {
  return {
    purpose: "resume" as const,
    organizationId: null,
    ownerSubject,
    recordId: PROFILE_RECORD_ID,
  };
}

function safeFilename(value: string): string | null {
  const base = value
    .split(/[\\/]/)
    .pop()
    ?.trim()
    .replace(/[\u0000-\u001f\u007f]/g, "");
  if (!base || base.length > 180) return null;
  return /\.(pdf|docx)$/i.test(base) ? base : null;
}

function resumeContentType(
  filename: string,
  claimed: string,
): ResumeContentType | null {
  const pdf = /\.pdf$/i.test(filename);
  const expected: ResumeContentType = pdf
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return claimed === "" ||
    claimed === "application/octet-stream" ||
    claimed === expected
    ? expected
    : null;
}

function hasExpectedSignature(
  bytes: Uint8Array,
  type: ResumeContentType,
): boolean {
  if (type === "application/pdf")
    return (
      bytes.length >= 5 &&
      new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-"
    );
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
