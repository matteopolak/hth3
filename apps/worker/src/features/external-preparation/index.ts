import { API_VERSION } from "@civicresolve/contracts/v1";
import { getSourceRecord } from "@civicresolve/db/d1";
import {
  EXTERNAL_PREPARATION_STATUS,
  formatPreparationDocument,
  validateExternalPreparation,
  validateReusableAnswer,
  type ExternalPreparation,
  type ReusableAnswer,
} from "@civicresolve/domain/external-preparation";
import { canPerformOwnerAction } from "@civicresolve/domain/permissions";
import type { SourceRecord } from "@civicresolve/sources";
import { authenticateRequest } from "../../auth/identity.js";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

const ROOT = "/api/v1/external-preparations";
const ID = "([A-Za-z0-9][A-Za-z0-9._:-]{0,127})";

interface PreparationRow {
  record_id: string;
  answers_json: string;
  checklist_json: string;
  created_at: string;
  updated_at: string;
}

type ExternalRecord = SourceRecord & {
  purpose: "application" | "participation";
};

export async function handleExternalPreparationRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  const path = url.pathname;
  if (path !== ROOT && !path.startsWith(`${ROOT}/`)) return null;

  if (path === ROOT) {
    if (request.method !== "GET") return methodError(context);
    return listPreparations(request, context);
  }
  if (path === `${ROOT}/answers`) {
    if (request.method !== "GET") return methodError(context);
    return listReusableAnswers(request, context);
  }
  const reusableMatch = path.match(
    new RegExp(`^${ROOT}/answers/([A-Za-z0-9_-]{1,48})$`),
  );
  if (reusableMatch) {
    if (request.method === "PUT")
      return saveReusableAnswer(request, reusableMatch[1]!, context);
    if (request.method === "DELETE")
      return deleteReusableAnswer(request, reusableMatch[1]!, context);
    return methodError(context);
  }
  const exportMatch = path.match(new RegExp(`^${ROOT}/${ID}/export$`));
  if (exportMatch) {
    if (request.method !== "GET") return methodError(context);
    return exportPreparation(request, exportMatch[1]!, url, context);
  }
  const recordMatch = path.match(new RegExp(`^${ROOT}/${ID}$`));
  if (!recordMatch)
    return featureError(context, "NOT_FOUND", "Preparation not found.", 404);
  const recordId = recordMatch[1]!;
  if (request.method === "GET")
    return readPreparation(request, recordId, context);
  if (request.method === "PUT")
    return savePreparation(request, recordId, context);
  if (request.method === "DELETE")
    return deletePreparation(request, recordId, context);
  return methodError(context);
}

async function readPreparation(
  request: Request,
  recordId: string,
  context: FeatureContext,
): Promise<Response> {
  const record = await externalRecord(recordId, context);
  if (!record) return missingRecord(context);
  const actor = await authenticateRequest(request, context.env);
  const owner =
    actor && canPerformOwnerAction(actor, "profile:read_own", actor.subject)
      ? actor.subject
      : null;
  const row = owner ? await readSaved(owner, recordId, context) : null;
  return featureJson(context, {
    apiVersion: API_VERSION,
    record: recordView(record),
    preparation: row ? preparationFromRow(row) : emptyPreparation(),
    saved: !!row,
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
    externalSubmissionRecorded: false,
    requestId: context.requestId,
  });
}

async function savePreparation(
  request: Request,
  recordId: string,
  context: FeatureContext,
): Promise<Response> {
  const subject = await applicantSubject(request, context);
  if (subject instanceof Response) return subject;
  const record = await externalRecord(recordId, context);
  if (!record) return missingRecord(context);
  const body = await request.json().catch(() => null);
  const preparation = validateExternalPreparation(body);
  if (!preparation)
    return featureError(
      context,
      "INVALID_PREPARATION",
      "Review answers and checklist limits.",
      400,
    );
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO external_preparations
       (owner_subject, record_id, answers_json, checklist_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'prepared-for-external', ?, ?)
     ON CONFLICT(owner_subject, record_id) DO UPDATE SET
       answers_json = excluded.answers_json,
       checklist_json = excluded.checklist_json,
       updated_at = excluded.updated_at`,
  )
    .bind(
      subject,
      recordId,
      JSON.stringify(preparation.answers),
      JSON.stringify(preparation.checklist),
      now,
      now,
    )
    .run();
  return featureJson(context, {
    apiVersion: API_VERSION,
    record: recordView(record),
    preparation,
    saved: true,
    updatedAt: now,
    externalSubmissionRecorded: false,
    requestId: context.requestId,
  });
}

async function deletePreparation(
  request: Request,
  recordId: string,
  context: FeatureContext,
): Promise<Response> {
  const subject = await applicantSubject(request, context);
  if (subject instanceof Response) return subject;
  await context.env.DB.prepare(
    "DELETE FROM external_preparations WHERE owner_subject = ? AND record_id = ?",
  )
    .bind(subject, recordId)
    .run();
  return featureJson(context, {
    apiVersion: API_VERSION,
    recordId,
    deleted: true,
    requestId: context.requestId,
  });
}

async function exportPreparation(
  request: Request,
  recordId: string,
  url: URL,
  context: FeatureContext,
): Promise<Response> {
  const record = await externalRecord(recordId, context);
  if (!record) return missingRecord(context);
  const actor = await authenticateRequest(request, context.env);
  const owner =
    actor && canPerformOwnerAction(actor, "profile:read_own", actor.subject)
      ? actor.subject
      : null;
  const row = owner ? await readSaved(owner, recordId, context) : null;
  const locale = url.searchParams.get("locale") === "fr" ? "fr" : "en";
  const document = formatPreparationDocument({
    title: record.title,
    publisher: record.publisher,
    officialUrl: record.sourceUrl,
    preparation: row ? preparationFromRow(row) : emptyPreparation(),
    locale,
    purpose: record.purpose,
  });
  const headers = new Headers(context.cors);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set(
    "Content-Disposition",
    `attachment; filename="envoy-preparation-${recordId.replace(/[^A-Za-z0-9_-]/g, "-")}.txt"`,
  );
  headers.set("Cache-Control", "no-store");
  return new Response(document, { status: 200, headers });
}

async function listPreparations(
  request: Request,
  context: FeatureContext,
): Promise<Response> {
  const subject = await applicantSubject(request, context);
  if (subject instanceof Response) return subject;
  const result = await context.env.DB.prepare(
    `SELECT p.record_id, p.answers_json, p.checklist_json, p.created_at, p.updated_at
     FROM external_preparations AS p
     JOIN source_records AS r ON r.id = p.record_id
     WHERE p.owner_subject = ? AND r.origin = 'official_external' AND r.terms_status = 'permitted'
     ORDER BY p.updated_at DESC LIMIT 100`,
  )
    .bind(subject)
    .all<PreparationRow>();
  const items = [];
  for (const row of result.results ?? []) {
    const record = await externalRecord(row.record_id, context);
    if (record)
      items.push({
        record: recordView(record),
        preparation: preparationFromRow(row),
        updatedAt: row.updated_at,
      });
  }
  return featureJson(context, {
    apiVersion: API_VERSION,
    items,
    requestId: context.requestId,
  });
}

async function listReusableAnswers(
  request: Request,
  context: FeatureContext,
): Promise<Response> {
  const subject = await applicantSubject(request, context);
  if (subject instanceof Response) return subject;
  const result = await context.env.DB.prepare(
    `SELECT id, label, response FROM external_preparation_answers
     WHERE owner_subject = ? ORDER BY updated_at DESC LIMIT 50`,
  )
    .bind(subject)
    .all<ReusableAnswer>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    answers: result.results ?? [],
    requestId: context.requestId,
  });
}

async function saveReusableAnswer(
  request: Request,
  id: string,
  context: FeatureContext,
): Promise<Response> {
  const subject = await applicantSubject(request, context);
  if (subject instanceof Response) return subject;
  const body = await request.json().catch(() => null);
  const answer = validateReusableAnswer({
    ...(body && typeof body === "object" ? body : {}),
    id,
  });
  if (!answer)
    return featureError(
      context,
      "INVALID_ANSWER",
      "Provide a short label and answer.",
      400,
    );
  const count = await context.env.DB.prepare(
    "SELECT COUNT(*) AS total FROM external_preparation_answers WHERE owner_subject = ?",
  )
    .bind(subject)
    .first<{ total: number }>();
  const existing = await context.env.DB.prepare(
    "SELECT 1 AS found FROM external_preparation_answers WHERE owner_subject = ? AND id = ?",
  )
    .bind(subject, id)
    .first<{ found: number }>();
  if (!existing && (count?.total ?? 0) >= 50)
    return featureError(
      context,
      "ANSWER_LIMIT",
      "Remove an answer before adding another.",
      409,
    );
  await context.env.DB.prepare(
    `INSERT INTO external_preparation_answers(owner_subject, id, label, response, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(owner_subject, id) DO UPDATE SET
       label = excluded.label, response = excluded.response, updated_at = excluded.updated_at`,
  )
    .bind(subject, id, answer.label, answer.response, new Date().toISOString())
    .run();
  return featureJson(context, {
    apiVersion: API_VERSION,
    answer,
    saved: true,
    requestId: context.requestId,
  });
}

async function deleteReusableAnswer(
  request: Request,
  id: string,
  context: FeatureContext,
): Promise<Response> {
  const subject = await applicantSubject(request, context);
  if (subject instanceof Response) return subject;
  await context.env.DB.prepare(
    "DELETE FROM external_preparation_answers WHERE owner_subject = ? AND id = ?",
  )
    .bind(subject, id)
    .run();
  return featureJson(context, {
    apiVersion: API_VERSION,
    answerId: id,
    deleted: true,
    requestId: context.requestId,
  });
}

async function applicantSubject(
  request: Request,
  context: FeatureContext,
): Promise<string | Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to save preparation.",
      401,
    );
  if (!canPerformOwnerAction(actor, "profile:write_own", actor.subject))
    return featureError(
      context,
      "FORBIDDEN",
      "An applicant account is required.",
      403,
    );
  return actor.subject;
}

async function externalRecord(
  id: string,
  context: FeatureContext,
): Promise<ExternalRecord | null> {
  const record = await getSourceRecord(context.env.DB, id);
  if (
    !record ||
    record.origin !== "official_external" ||
    !safeOfficialUrl(record.sourceUrl)
  )
    return null;
  const detail = await context.env.DB.prepare(
    `SELECT a.area, d.kind FROM source_records AS r
     LEFT JOIN discovery_record_areas AS a ON a.record_id = r.id
     LEFT JOIN source_record_details AS d ON d.record_id = r.id
     WHERE r.id = ?`,
  )
    .bind(id)
    .first<{ area: string | null; kind: string | null }>();
  return {
    ...record,
    purpose:
      detail?.area === "participation" || detail?.kind === "consultation_finder"
        ? "participation"
        : "application",
  };
}

function safeOfficialUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function recordView(record: ExternalRecord) {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    publisher: record.publisher,
    jurisdiction: record.jurisdiction.name,
    officialUrl: record.sourceUrl,
    verifiedAt: record.verifiedAt,
    freshness: record.freshness,
    purpose: record.purpose,
    handoff: {
      url: record.sourceUrl,
      publisher: record.publisher,
      verifyOnPublisherSite: true,
      externalSubmissionRecorded: false,
    },
  };
}

function emptyPreparation(): ExternalPreparation {
  return { answers: [], checklist: [], status: EXTERNAL_PREPARATION_STATUS };
}

function preparationFromRow(row: PreparationRow): ExternalPreparation {
  return {
    answers: JSON.parse(row.answers_json) as ExternalPreparation["answers"],
    checklist: JSON.parse(
      row.checklist_json,
    ) as ExternalPreparation["checklist"],
    status: EXTERNAL_PREPARATION_STATUS,
  };
}

async function readSaved(
  owner: string,
  recordId: string,
  context: FeatureContext,
): Promise<PreparationRow | null> {
  return context.env.DB.prepare(
    `SELECT record_id, answers_json, checklist_json, created_at, updated_at
     FROM external_preparations WHERE owner_subject = ? AND record_id = ?`,
  )
    .bind(owner, recordId)
    .first<PreparationRow>();
}

function missingRecord(context: FeatureContext): Response {
  return featureError(
    context,
    "NOT_FOUND",
    "Official external record not found.",
    404,
  );
}

function methodError(context: FeatureContext): Response {
  return featureError(
    context,
    "METHOD_NOT_ALLOWED",
    "Method not allowed.",
    405,
  );
}
