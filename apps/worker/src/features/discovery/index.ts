import { API_VERSION } from "@civicresolve/contracts/v1";
import { getSourceRecord, listSourceRecords } from "@civicresolve/db/d1";
import { canPerformOwnerAction } from "@civicresolve/domain/permissions";
import type {
  OfficialRecordKind,
  SourceRecord,
  SourceRecordWithDetails,
} from "@civicresolve/sources";
import { authenticateRequest } from "../../auth/index.js";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

const ROOT = "/api/v1/discovery";
const AREAS = [
  "jobs",
  "support",
  "funding",
  "nearby",
  "participation",
] as const;
type Area = (typeof AREAS)[number];

interface DetailRow {
  record_id: string;
  kind: OfficialRecordKind | null;
  latitude: number | null;
  longitude: number | null;
  area: Area | null;
}

interface SavedRow {
  record_id: string;
  checklist_json: string;
  created_at: string;
  updated_at: string;
}

interface ChecklistEntry {
  id: string;
  text: string;
  done: boolean;
}

export async function handleDiscoveryRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  const path = url.pathname;
  if (path !== ROOT && !path.startsWith(`${ROOT}/`)) return null;
  if (path === ROOT) {
    if (request.method !== "GET") return methodError(context);
    return search(url, context);
  }
  if (path === `${ROOT}/saved`) {
    if (request.method !== "GET") return methodError(context);
    return listSaved(url, request, context);
  }
  const savedMatch = path.match(
    /^\/api\/v1\/discovery\/saved\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/,
  );
  if (savedMatch) {
    if (request.method === "PUT")
      return save(request, url, savedMatch[1]!, context);
    if (request.method === "DELETE")
      return removeSaved(request, savedMatch[1]!, context);
    return methodError(context);
  }
  const handoffMatch = path.match(
    /^\/api\/v1\/discovery\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})\/handoff$/,
  );
  if (handoffMatch) {
    if (request.method !== "GET") return methodError(context);
    return handoff(url, handoffMatch[1]!, context);
  }
  const detailMatch = path.match(
    /^\/api\/v1\/discovery\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/,
  );
  if (detailMatch) {
    if (request.method !== "GET") return methodError(context);
    return detail(url, detailMatch[1]!, context);
  }
  return featureError(context, "NOT_FOUND", "Discovery item not found.", 404);
}

async function search(url: URL, context: FeatureContext): Promise<Response> {
  const area = url.searchParams.get("area");
  if (area && !isArea(area))
    return featureError(
      context,
      "INVALID_FILTER",
      "Unknown discovery area.",
      400,
    );
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length > 120)
    return featureError(context, "INVALID_FILTER", "Search is too long.", 400);
  const jurisdiction = url.searchParams.get("jurisdiction")?.trim() ?? "";
  if (jurisdiction.length > 60)
    return featureError(
      context,
      "INVALID_FILTER",
      "Jurisdiction is too long.",
      400,
    );
  const language = url.searchParams.get("language");
  if (language && language !== "en" && language !== "fr")
    return featureError(context, "INVALID_FILTER", "Unknown language.", 400);
  const freshness = url.searchParams.get("freshness");
  if (
    freshness &&
    !["current", "stale", "expired", "error", "unknown"].includes(freshness)
  )
    return featureError(context, "INVALID_FILTER", "Unknown freshness.", 400);
  const limit = boundedInteger(url.searchParams.get("limit"), 30, 1, 100);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 10000);
  if (limit === null || offset === null)
    return featureError(context, "INVALID_FILTER", "Invalid pagination.", 400);

  const includeSamples = url.searchParams.get("includeSamples") === "true";
  const records = await listSourceRecords(context.env.DB, { includeSamples });
  const details = await loadDetails(context);
  const needle = q.toLocaleLowerCase();
  const filtered = records
    .map((record) => discoveryItem(record, details.get(record.id)))
    .filter((item) => area === null || item.area === area)
    .filter(
      (item) =>
        !needle ||
        `${item.title} ${item.summary} ${item.publisher} ${item.jurisdiction.name}`
          .toLocaleLowerCase()
          .includes(needle),
    )
    .filter(
      (item) =>
        !jurisdiction ||
        item.jurisdiction.code === jurisdiction ||
        (jurisdiction.startsWith("CA-") && item.jurisdiction.code === "CA"),
    )
    .filter((item) => !language || item.language === language)
    .filter((item) => !freshness || item.freshness === freshness);
  return featureJson(context, {
    apiVersion: API_VERSION,
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
    samplesIncluded: includeSamples,
    requestId: context.requestId,
  });
}

async function detail(
  url: URL,
  id: string,
  context: FeatureContext,
): Promise<Response> {
  const item = await findItem(
    id,
    url.searchParams.get("includeSamples") === "true",
    context,
  );
  if (!item)
    return featureError(context, "NOT_FOUND", "Discovery item not found.", 404);
  return featureJson(context, {
    apiVersion: API_VERSION,
    item,
    requestId: context.requestId,
  });
}

async function handoff(
  url: URL,
  id: string,
  context: FeatureContext,
): Promise<Response> {
  const item = await findItem(
    id,
    url.searchParams.get("includeSamples") === "true",
    context,
  );
  if (!item)
    return featureError(context, "NOT_FOUND", "Discovery item not found.", 404);
  if (!item.handoff)
    return featureError(
      context,
      "NO_OFFICIAL_HANDOFF",
      "No official destination is available.",
      409,
    );
  return featureJson(context, {
    apiVersion: API_VERSION,
    handoff: item.handoff,
    itemId: item.id,
    externalSubmissionRecorded: false,
    requestId: context.requestId,
  });
}

async function listSaved(
  url: URL,
  request: Request,
  context: FeatureContext,
): Promise<Response> {
  const subject = await applicantSubject(request, context);
  if (subject instanceof Response) return subject;
  const result = await context.env.DB.prepare(
    `SELECT record_id, checklist_json, created_at, updated_at
     FROM discovery_saved_items WHERE owner_subject = ?
     ORDER BY updated_at DESC LIMIT 100`,
  )
    .bind(subject)
    .all<SavedRow>();
  const includeSamples = url.searchParams.get("includeSamples") === "true";
  const items = [];
  for (const row of result.results ?? []) {
    const item = await findItem(row.record_id, includeSamples, context);
    if (item)
      items.push({
        item,
        checklist: JSON.parse(row.checklist_json) as ChecklistEntry[],
        savedAt: row.created_at,
        updatedAt: row.updated_at,
      });
  }
  return featureJson(context, {
    apiVersion: API_VERSION,
    items,
    samplesIncluded: includeSamples,
    requestId: context.requestId,
  });
}

async function save(
  request: Request,
  url: URL,
  id: string,
  context: FeatureContext,
): Promise<Response> {
  const subject = await applicantSubject(request, context);
  if (subject instanceof Response) return subject;
  const item = await findItem(
    id,
    url.searchParams.get("includeSamples") === "true",
    context,
  );
  if (!item)
    return featureError(context, "NOT_FOUND", "Discovery item not found.", 404);
  const body = (await request.json().catch(() => null)) as {
    checklist?: unknown;
  } | null;
  const checklist =
    body?.checklist === undefined ? [] : parseChecklist(body.checklist);
  if (!checklist)
    return featureError(
      context,
      "INVALID_CHECKLIST",
      "Provide up to 12 short checklist entries.",
      400,
    );
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO discovery_saved_items
      (owner_subject, record_id, checklist_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (owner_subject, record_id) DO UPDATE SET
       checklist_json = CASE WHEN ? = 1 THEN excluded.checklist_json ELSE discovery_saved_items.checklist_json END,
       updated_at = excluded.updated_at`,
  )
    .bind(
      subject,
      id,
      JSON.stringify(checklist),
      now,
      now,
      body?.checklist === undefined ? 0 : 1,
    )
    .run();
  const saved = await context.env.DB.prepare(
    "SELECT checklist_json FROM discovery_saved_items WHERE owner_subject = ? AND record_id = ?",
  )
    .bind(subject, id)
    .first<{ checklist_json: string }>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    item,
    checklist: saved
      ? (JSON.parse(saved.checklist_json) as ChecklistEntry[])
      : checklist,
    saved: true,
    requestId: context.requestId,
  });
}

async function removeSaved(
  request: Request,
  id: string,
  context: FeatureContext,
): Promise<Response> {
  const subject = await applicantSubject(request, context);
  if (subject instanceof Response) return subject;
  await context.env.DB.prepare(
    "DELETE FROM discovery_saved_items WHERE owner_subject = ? AND record_id = ?",
  )
    .bind(subject, id)
    .run();
  return featureJson(context, {
    apiVersion: API_VERSION,
    itemId: id,
    saved: false,
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
      "Sign in to save items.",
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

async function findItem(
  id: string,
  includeSamples: boolean,
  context: FeatureContext,
) {
  const record = await getSourceRecord(context.env.DB, id, { includeSamples });
  if (!record) return null;
  const detail = await context.env.DB.prepare(
    `SELECT d.record_id, d.kind, d.latitude, d.longitude, a.area
     FROM source_records AS r
     LEFT JOIN source_record_details AS d ON d.record_id = r.id
     LEFT JOIN discovery_record_areas AS a ON a.record_id = r.id
     WHERE r.id = ?`,
  )
    .bind(id)
    .first<DetailRow>();
  return discoveryItem(record, detail);
}

async function loadDetails(
  context: FeatureContext,
): Promise<Map<string, DetailRow>> {
  const result = await context.env.DB.prepare(
    `SELECT r.id AS record_id, d.kind, d.latitude, d.longitude, a.area
     FROM source_records AS r
     LEFT JOIN source_record_details AS d ON d.record_id = r.id
     LEFT JOIN discovery_record_areas AS a ON a.record_id = r.id`,
  ).all<DetailRow>();
  return new Map((result.results ?? []).map((row) => [row.record_id, row]));
}

function discoveryItem(
  record: SourceRecord,
  detail: DetailRow | null | undefined,
) {
  const area = detail?.area ?? areaForKind(detail?.kind);
  const coordinates =
    typeof detail?.latitude === "number" && typeof detail.longitude === "number"
      ? { latitude: detail.latitude, longitude: detail.longitude }
      : null;
  const withDetails: SourceRecordWithDetails = {
    ...record,
    kind: detail?.kind ?? null,
    coordinates,
  };
  const handoff =
    record.origin !== "sample" &&
    record.termsStatus === "permitted" &&
    safeOfficialUrl(record.sourceUrl)
      ? {
          url: record.sourceUrl,
          publisher: record.publisher,
          destination: "official_external" as const,
          verifyOnPublisherSite: true,
          externalSubmissionRecorded: false,
        }
      : null;
  return { ...withDetails, area, handoff };
}

function areaForKind(kind: OfficialRecordKind | null | undefined): Area | null {
  if (kind === "jobs_finder") return "jobs";
  if (kind === "benefits_finder") return "support";
  if (kind === "funding_finder") return "funding";
  if (kind === "service_location") return "nearby";
  return null;
}

function safeOfficialUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isArea(value: string): value is Area {
  return (AREAS as readonly string[]).includes(value);
}

function boundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function parseChecklist(value: unknown): ChecklistEntry[] | null {
  if (!Array.isArray(value) || value.length > 12) return null;
  const seen = new Set<string>();
  const entries: ChecklistEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return null;
    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,40}$/.test(item.id) ||
      seen.has(item.id) ||
      typeof item.text !== "string" ||
      item.text.trim().length < 1 ||
      item.text.trim().length > 140 ||
      typeof item.done !== "boolean"
    )
      return null;
    seen.add(item.id);
    entries.push({ id: item.id, text: item.text.trim(), done: item.done });
  }
  return entries;
}

function methodError(context: FeatureContext): Response {
  return featureError(
    context,
    "METHOD_NOT_ALLOWED",
    "Method not allowed.",
    405,
  );
}
