import { API_VERSION } from "@civicresolve/contracts/v1";
import { canPerformGlobalAction } from "@civicresolve/domain/permissions";
import type { D1Database } from "@civicresolve/db/d1";
import {
  authenticateRequest,
  type AuthenticatedActor,
} from "../../auth/identity.js";
import { sha256Hex, stableId, type FeatureContext } from "../shared.js";
import { featureError, featureJson } from "../shared.js";
import { ingestOfficialSources } from "./ingest.js";

const COLLECTION = "/api/v1/staff/sources";
const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const EDITABLE_FIELDS = [
  "name",
  "publisher",
  "sourceUrl",
  "jurisdictionLevel",
  "jurisdictionCode",
  "jurisdictionName",
  "municipalityCode",
  "municipalityName",
  "licenceName",
  "licenceUrl",
  "termsUrl",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];
type ProposedChanges = Partial<Record<EditableField, string | null>>;

interface SourceRow {
  id: string;
  origin: string;
  name: string;
  publisher: string;
  source_url: string;
  jurisdiction_level: string;
  jurisdiction_code: string;
  jurisdiction_name: string;
  municipality_code: string | null;
  municipality_name: string | null;
  licence_name: string | null;
  licence_url: string | null;
  terms_url: string | null;
  terms_status: string;
  collection_mode: string;
  fetched_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  freshness_state: string;
  last_error: string | null;
  sample_label: string | null;
  version: number;
  curator_overrides_json?: string;
  record_count?: number;
}

interface SourceRecordReviewRow {
  id: string;
  external_id: string | null;
  title: string;
  source_url: string;
  publisher: string;
  terms_status: string;
  fetched_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  freshness_state: string;
  last_error_code: string | null;
  evidence_url: string | null;
  payload_hash: string | null;
  sample_label: string | null;
}

interface ChangeRow {
  id: string;
  source_id: string;
  base_source_version: number;
  version: number;
  proposed_json: string;
  reason: string;
  evidence_url: string;
  status: "pending" | "approved" | "rejected";
  created_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
}

interface IdempotencyRow {
  request_hash: string;
  response_json: string;
}

export async function handleSourceCuratorRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  if (url.pathname !== COLLECTION && !url.pathname.startsWith(`${COLLECTION}/`))
    return null;

  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  if (!canPerformGlobalAction(actor, "source:manage"))
    return featureError(
      context,
      "FORBIDDEN",
      "Source curator access required.",
      403,
    );

  if (url.pathname === `${COLLECTION}/refresh`) {
    if (request.method !== "POST")
      return featureError(context, "METHOD_NOT_ALLOWED", "Use POST.", 405);
    return refreshVacancies(context, actor);
  }

  if (url.pathname === COLLECTION) {
    if (request.method !== "GET")
      return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);
    return listSources(context);
  }

  const parts = url.pathname.slice(COLLECTION.length + 1).split("/");
  const sourceId = parts[0];
  if (!sourceId || !SOURCE_ID.test(sourceId))
    return featureError(context, "NOT_FOUND", "Source not found.", 404);
  if (parts.length === 1 && request.method === "GET")
    return getSource(context, sourceId);
  if (parts.length === 2 && parts[1] === "changes" && request.method === "POST")
    return proposeChange(request, url, context, actor, sourceId);
  if (
    parts.length === 4 &&
    parts[1] === "changes" &&
    parts[3] === "decision" &&
    request.method === "POST"
  )
    return decideChange(request, url, context, actor, sourceId, parts[2]!);
  if (parts.length === 3 && parts[1] === "changes" && request.method === "GET")
    return getChange(context, sourceId, parts[2]!);
  return featureError(context, "NOT_FOUND", "Source route not found.", 404);
}

/** Explicit, curator-only refresh for immediate post-deploy vacancy ingestion. */
async function refreshVacancies(
  context: FeatureContext,
  actor: AuthenticatedActor,
): Promise<Response> {
  const now = new Date();
  const slot = Math.floor(now.getTime() / (5 * 60_000));
  const eventId = `source-refresh-vacancies-${slot}`;
  const started = await context.env.DB.prepare(
    `INSERT OR IGNORE INTO audit_events
      (id, actor_subject, organization_id, action, entity_type,
       entity_id, details_json, created_at)
     VALUES (?, ?, NULL, 'source.refresh', 'source_registry',
       'vacancies', ?, ?)`,
  )
    .bind(
      eventId,
      actor.subject,
      JSON.stringify({ status: "started", selection: "vacancies" }),
      now.toISOString(),
    )
    .run();
  if (started.meta.changes !== 1)
    return featureError(
      context,
      "REFRESH_RECENTLY_STARTED",
      "A vacancy refresh has already started in this five-minute window.",
      429,
    );

  try {
    const result = await ingestOfficialSources(
      context.env.DB,
      fetch,
      now,
      "vacancies",
    );
    await context.env.DB.prepare(
      "UPDATE audit_events SET details_json=? WHERE id=?",
    )
      .bind(
        JSON.stringify({
          status: "completed",
          selection: "vacancies",
          ...result,
        }),
        eventId,
      )
      .run();
    return featureJson(context, {
      apiVersion: API_VERSION,
      selection: "vacancies",
      ...result,
      requestId: context.requestId,
    });
  } catch {
    await context.env.DB.prepare(
      "UPDATE audit_events SET details_json=? WHERE id=?",
    )
      .bind(
        JSON.stringify({ status: "failed", selection: "vacancies" }),
        eventId,
      )
      .run();
    return featureError(
      context,
      "REFRESH_FAILED",
      "The vacancy refresh did not complete.",
      503,
    );
  }
}

async function listSources(context: FeatureContext): Promise<Response> {
  const result = await context.env.DB.prepare(
    `SELECT s.id, s.origin, s.name, s.publisher, s.source_url,
       s.jurisdiction_level, s.jurisdiction_code, s.jurisdiction_name,
       s.municipality_code, s.municipality_name, s.licence_name, s.licence_url,
       s.terms_url, s.terms_status, s.collection_mode, s.fetched_at,
       s.verified_at, s.expires_at, s.freshness_state, s.last_error,
       s.sample_label, s.version, COUNT(r.id) AS record_count
     FROM source_registry s LEFT JOIN source_records r ON r.source_id = s.id
     GROUP BY s.id ORDER BY s.jurisdiction_name, s.name LIMIT 250`,
  ).all<SourceRow>();
  const pending = await context.env.DB.prepare(
    `SELECT c.id, c.source_id, c.base_source_version, c.version,
       c.proposed_json, c.reason, c.evidence_url, c.status, c.created_by,
       c.created_at, c.reviewed_by, c.reviewed_at, c.review_reason,
       s.name AS source_name
     FROM source_review_changes c JOIN source_registry s ON s.id = c.source_id
     WHERE c.status = 'pending' ORDER BY c.created_at LIMIT 100`,
  ).all<ChangeRow & { source_name: string }>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    sources: (result.results ?? []).map(sourceDto),
    pendingChanges: (pending.results ?? []).map(changeDto),
  });
}

async function getSource(
  context: FeatureContext,
  sourceId: string,
): Promise<Response> {
  const source = await loadSource(context.env.DB, sourceId);
  if (!source)
    return featureError(context, "NOT_FOUND", "Source not found.", 404);
  const [records, changes] = await Promise.all([
    context.env.DB.prepare(
      `SELECT id, external_id, title, source_url, publisher, terms_status,
         fetched_at, verified_at, expires_at, freshness_state,
         last_error_code, evidence_url, payload_hash, sample_label
       FROM source_records WHERE source_id = ? ORDER BY title LIMIT 100`,
    )
      .bind(sourceId)
      .all<SourceRecordReviewRow>(),
    context.env.DB.prepare(
      `SELECT id, source_id, base_source_version, version, proposed_json,
         reason, evidence_url, status, created_by, created_at, reviewed_by,
         reviewed_at, review_reason
       FROM source_review_changes WHERE source_id = ?
       ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(sourceId)
      .all<ChangeRow>(),
  ]);
  const publicRecords = (records.results ?? []).map((record) => ({
    id: record.id,
    externalId: record.external_id,
    title: record.title,
    sourceUrl: record.source_url,
    publisher: record.publisher,
    termsStatus: record.terms_status,
    fetchedAt: record.fetched_at,
    verifiedAt: record.verified_at,
    expiresAt: record.expires_at,
    freshnessState: record.freshness_state,
    lastErrorCode: record.last_error_code,
    evidenceUrl: record.evidence_url,
    payloadHash: record.payload_hash,
    sampleLabel: record.sample_label,
  }));
  return featureJson(context, {
    apiVersion: API_VERSION,
    source: sourceDto(source),
    records: publicRecords,
    changes: (changes.results ?? []).map(changeDto),
  });
}

async function getChange(
  context: FeatureContext,
  sourceId: string,
  changeId: string,
): Promise<Response> {
  const change = await loadChange(context.env.DB, sourceId, changeId);
  if (!change)
    return featureError(context, "NOT_FOUND", "Source change not found.", 404);
  return featureJson(context, {
    apiVersion: API_VERSION,
    change: changeDto(change),
  });
}

async function proposeChange(
  request: Request,
  url: URL,
  context: FeatureContext,
  actor: AuthenticatedActor,
  sourceId: string,
): Promise<Response> {
  const parsed = await readObject(request);
  if (!parsed)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a JSON body.",
      400,
    );
  const { payload } = parsed;
  const changes = normalizeChanges(payload.changes);
  const reason = shortText(payload.reason, 12, 1200);
  const evidenceUrl = httpsUrl(payload.evidenceUrl);
  const expectedVersion = integer(payload.expectedVersion);
  if (!changes || !reason || !evidenceUrl || expectedVersion === null)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a valid metadata patch, reason, HTTPS evidence URL, and expected version.",
      400,
    );
  const idem = await idempotencyInput(request, url, actor, payload, context);
  if (idem instanceof Response) return idem;
  const source = await loadSource(context.env.DB, sourceId);
  if (!source)
    return featureError(context, "NOT_FOUND", "Source not found.", 404);
  if (source.origin !== "official_external")
    return featureError(
      context,
      "SOURCE_NOT_EDITABLE",
      "Only official registry metadata can be corrected.",
      409,
    );
  if (expectedVersion !== source.version)
    return featureError(
      context,
      "STALE_VERSION",
      "Refresh the source before proposing changes.",
      409,
    );

  const changeId = await stableId("source-change", idem.key);
  const now = new Date().toISOString();
  const response = {
    apiVersion: API_VERSION,
    change: {
      id: changeId,
      sourceId,
      baseSourceVersion: source.version,
      version: 1,
      proposed: changes,
      reason,
      evidenceUrl,
      status: "pending",
      createdBy: actor.subject,
      createdAt: now,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
    },
  };
  const eventId = await stableId("audit", `${idem.key}:proposed`);
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO source_review_changes (
        id, source_id, base_source_version, proposed_json, reason, evidence_url,
        created_by, created_at
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (
        SELECT 1 FROM source_registry WHERE id = ? AND version = ?
          AND origin = 'official_external'
      )`,
    ).bind(
      changeId,
      sourceId,
      source.version,
      JSON.stringify(changes),
      reason,
      evidenceUrl,
      actor.subject,
      now,
      sourceId,
      source.version,
    ),
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO audit_events (
        id, actor_subject, organization_id, action, entity_type, entity_id,
        details_json, created_at
      ) SELECT ?, ?, NULL, 'source_change_proposed', 'source_registry', ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM source_review_changes WHERE id = ? AND created_by = ?)`,
    ).bind(
      eventId,
      actor.subject,
      sourceId,
      JSON.stringify({ changeId, reason, evidenceUrl, changes }),
      now,
      changeId,
      actor.subject,
    ),
    idempotencyStatement(context.env.DB, {
      key: idem.key,
      requestHash: idem.hash,
      aggregateType: "source_review_change",
      aggregateId: changeId,
      response,
      createdAt: now,
    }),
  ]);
  return replayOrRespond(
    context.env.DB,
    idem.key,
    idem.hash,
    context,
    response,
  );
}

async function decideChange(
  request: Request,
  url: URL,
  context: FeatureContext,
  actor: AuthenticatedActor,
  sourceId: string,
  changeId: string,
): Promise<Response> {
  const parsed = await readObject(request);
  if (!parsed)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a JSON body.",
      400,
    );
  const { payload } = parsed;
  const expectedVersion = integer(payload.expectedVersion);
  const decision = payload.decision;
  const reviewReason = shortText(payload.reason, 12, 1200);
  if (
    expectedVersion === null ||
    !["approve", "reject"].includes(String(decision)) ||
    !reviewReason
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a decision, reason, and expected version.",
      400,
    );
  const idem = await idempotencyInput(request, url, actor, payload, context);
  if (idem instanceof Response) return idem;
  const change = await loadChange(context.env.DB, sourceId, changeId);
  if (!change)
    return featureError(context, "NOT_FOUND", "Source change not found.", 404);
  if (change.status !== "pending" || expectedVersion !== change.version)
    return featureError(
      context,
      "STALE_VERSION",
      "This proposal has changed. Refresh before deciding.",
      409,
    );
  const source = await loadSource(context.env.DB, sourceId);
  if (!source)
    return featureError(context, "NOT_FOUND", "Source not found.", 404);
  if (source.version !== change.base_source_version)
    return featureError(
      context,
      "STALE_VERSION",
      "Source metadata changed after this proposal was created.",
      409,
    );

  const approved = decision === "approve";
  const now = new Date().toISOString();
  const proposed = parseProposed(change.proposed_json);
  if (!proposed)
    return featureError(
      context,
      "INVALID_SOURCE_CHANGE",
      "This proposal is invalid.",
      409,
    );
  const update = approved
    ? sourceUpdate(context.env.DB, sourceId, source, change, proposed, now)
    : null;
  const version = change.version + 1;
  const response = {
    apiVersion: API_VERSION,
    change: {
      ...changeDto(change),
      version,
      status: approved ? "approved" : "rejected",
      reviewedBy: actor.subject,
      reviewedAt: now,
      reviewReason,
      sourceVersion: approved ? source.version + 1 : source.version,
    },
  };
  const eventId = await stableId("audit", `${idem.key}:decision`);
  const decisionStatement = context.env.DB.prepare(
    `UPDATE source_review_changes SET status = ?, version = version + 1,
       reviewed_by = ?, reviewed_at = ?, review_reason = ?
     WHERE id = ? AND source_id = ? AND status = 'pending' AND version = ?
       AND EXISTS (SELECT 1 FROM source_registry WHERE id = ? AND version = ?)`,
  ).bind(
    approved ? "approved" : "rejected",
    actor.subject,
    now,
    reviewReason,
    changeId,
    sourceId,
    change.version,
    sourceId,
    approved ? source.version + 1 : source.version,
  );
  const audit = context.env.DB.prepare(
    `INSERT OR IGNORE INTO audit_events (
      id, actor_subject, organization_id, action, entity_type, entity_id,
      details_json, created_at
    ) SELECT ?, ?, NULL, ?, 'source_registry', ?, ?, ? WHERE changes() = 1`,
  ).bind(
    eventId,
    actor.subject,
    approved ? "source_change_approved" : "source_change_rejected",
    sourceId,
    JSON.stringify({ changeId, reason: reviewReason, proposed }),
    now,
  );
  await context.env.DB.batch([
    ...(update ? [update] : []),
    decisionStatement,
    audit,
    idempotencyStatement(context.env.DB, {
      key: idem.key,
      requestHash: idem.hash,
      aggregateType: "source_review_change",
      aggregateId: changeId,
      response,
      createdAt: now,
    }),
  ]);
  return replayOrRespond(
    context.env.DB,
    idem.key,
    idem.hash,
    context,
    response,
  );
}

function sourceUpdate(
  database: D1Database,
  sourceId: string,
  source: SourceRow,
  change: ChangeRow,
  changes: ProposedChanges,
  now: string,
) {
  const overrides = JSON.parse(source.curator_overrides_json ?? "{}") as Record<
    string,
    unknown
  >;
  const fieldColumns: Record<EditableField, string> = {
    name: "name",
    publisher: "publisher",
    sourceUrl: "source_url",
    jurisdictionLevel: "jurisdiction_level",
    jurisdictionCode: "jurisdiction_code",
    jurisdictionName: "jurisdiction_name",
    municipalityCode: "municipality_code",
    municipalityName: "municipality_name",
    licenceName: "licence_name",
    licenceUrl: "licence_url",
    termsUrl: "terms_url",
  };
  const assignments: string[] = [];
  const values: Array<string | number | null> = [];
  for (const [key, value] of Object.entries(changes) as [
    EditableField,
    string | null,
  ][]) {
    assignments.push(`${fieldColumns[key]} = ?`);
    values.push(value);
    overrides[key] = value;
  }
  if (
    ["publisher", "sourceUrl", "licenceName", "licenceUrl", "termsUrl"].some(
      (field) => Object.hasOwn(changes, field),
    )
  ) {
    assignments.push("terms_status = 'unreviewed'");
    overrides.termsStatus = "unreviewed";
  }
  if (Object.hasOwn(changes, "sourceUrl")) {
    assignments.push(
      "fetched_at = NULL",
      "verified_at = NULL",
      "expires_at = NULL",
      "freshness_state = 'unknown'",
      "last_error = NULL",
    );
  }
  assignments.push(
    "curator_overrides_json = ?",
    "version = version + 1",
    "updated_at = ?",
  );
  values.push(
    JSON.stringify(overrides),
    now,
    sourceId,
    source.version,
    change.id,
    change.base_source_version,
  );
  return database
    .prepare(
      `UPDATE source_registry SET ${assignments.join(", ")}
     WHERE id = ? AND version = ? AND EXISTS (
       SELECT 1 FROM source_review_changes
       WHERE id = ? AND status = 'pending' AND base_source_version = ?
     )`,
    )
    .bind(...values);
}

async function loadSource(
  database: D1Database,
  sourceId: string,
): Promise<SourceRow | null> {
  return database
    .prepare(
      `SELECT id, origin, name, publisher, source_url, jurisdiction_level,
       jurisdiction_code, jurisdiction_name, municipality_code, municipality_name,
       licence_name, licence_url, terms_url, terms_status, collection_mode,
       fetched_at, verified_at, expires_at, freshness_state, last_error,
       sample_label, version, curator_overrides_json
     FROM source_registry WHERE id = ?`,
    )
    .bind(sourceId)
    .first<SourceRow>();
}

async function loadChange(
  database: D1Database,
  sourceId: string,
  changeId: string,
): Promise<ChangeRow | null> {
  return database
    .prepare(
      `SELECT id, source_id, base_source_version, version, proposed_json,
       reason, evidence_url, status, created_by, created_at, reviewed_by,
       reviewed_at, review_reason FROM source_review_changes
     WHERE id = ? AND source_id = ?`,
    )
    .bind(changeId, sourceId)
    .first<ChangeRow>();
}

function sourceDto(source: SourceRow) {
  return {
    id: source.id,
    origin: source.origin,
    name: source.name,
    publisher: source.publisher,
    sourceUrl: source.source_url,
    jurisdictionLevel: source.jurisdiction_level,
    jurisdictionCode: source.jurisdiction_code,
    jurisdictionName: source.jurisdiction_name,
    municipalityCode: source.municipality_code,
    municipalityName: source.municipality_name,
    licenceName: source.licence_name,
    licenceUrl: source.licence_url,
    termsUrl: source.terms_url,
    termsStatus: source.terms_status,
    collectionMode: source.collection_mode,
    fetchedAt: source.fetched_at,
    verifiedAt: source.verified_at,
    expiresAt: source.expires_at,
    freshnessState: source.freshness_state,
    lastError: source.last_error,
    sampleLabel: source.sample_label,
    version: source.version,
    recordCount: source.record_count ?? null,
  };
}

function changeDto(change: ChangeRow & { source_name?: string }) {
  return {
    id: change.id,
    sourceId: change.source_id,
    sourceName: change.source_name,
    baseSourceVersion: change.base_source_version,
    version: change.version,
    proposed: parseProposed(change.proposed_json),
    reason: change.reason,
    evidenceUrl: change.evidence_url,
    status: change.status,
    createdBy: change.created_by,
    createdAt: change.created_at,
    reviewedBy: change.reviewed_by,
    reviewedAt: change.reviewed_at,
    reviewReason: change.review_reason,
  };
}

function normalizeChanges(value: unknown): ProposedChanges | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input) as string[];
  if (
    keys.length === 0 ||
    keys.some((key) => !EDITABLE_FIELDS.includes(key as EditableField))
  )
    return null;
  const output: ProposedChanges = {};
  for (const key of keys as EditableField[]) {
    const item = input[key];
    if (
      item === null &&
      [
        "municipalityCode",
        "municipalityName",
        "licenceName",
        "licenceUrl",
        "termsUrl",
      ].includes(key)
    ) {
      output[key] = null;
      continue;
    }
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > 500) return null;
    if (
      ["sourceUrl", "licenceUrl", "termsUrl"].includes(key) &&
      !httpsUrl(trimmed)
    )
      return null;
    if (
      key === "jurisdictionLevel" &&
      !["federal", "provincial", "municipal", "regional", "community"].includes(
        trimmed,
      )
    )
      return null;
    output[key] = trimmed;
  }
  const hasMunicipalityCode = Object.hasOwn(output, "municipalityCode");
  const hasMunicipalityName = Object.hasOwn(output, "municipalityName");
  if (hasMunicipalityCode !== hasMunicipalityName) return null;
  if (
    hasMunicipalityCode &&
    (output.municipalityCode === null) !== (output.municipalityName === null)
  )
    return null;
  return output;
}

function parseProposed(value: string): ProposedChanges | null {
  try {
    return normalizeChanges(JSON.parse(value));
  } catch {
    return null;
  }
}

async function readObject(
  request: Request,
): Promise<{ payload: Record<string, unknown> } | null> {
  const value = await request.json().catch(() => null);
  return value && typeof value === "object" && !Array.isArray(value)
    ? { payload: value as Record<string, unknown> }
    : null;
}

function integer(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function shortText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= min && text.length <= max ? text : null;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
}

async function idempotencyInput(
  request: Request,
  url: URL,
  actor: AuthenticatedActor,
  payload: Record<string, unknown>,
  context: FeatureContext,
): Promise<{ key: string; hash: string } | Response> {
  const raw = request.headers.get("Idempotency-Key");
  if (!raw || raw.length < 16 || raw.length > 128)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a 16–128 character Idempotency-Key.",
      400,
    );
  const key = `source-review:${actor.subject}:${raw}`;
  const hash = await sha256Hex(
    JSON.stringify({ method: request.method, path: url.pathname, payload }),
  );
  const prior = await context.env.DB.prepare(
    "SELECT request_hash, response_json FROM idempotency_records WHERE idempotency_key = ?",
  )
    .bind(key)
    .first<IdempotencyRow>();
  if (prior) {
    if (prior.request_hash !== hash)
      return featureError(
        context,
        "IDEMPOTENCY_CONFLICT",
        "This request key was used for different content.",
        409,
      );
    return featureJson(context, JSON.parse(prior.response_json) as unknown);
  }
  return { key, hash };
}

async function replayOrRespond(
  database: D1Database,
  key: string,
  hash: string,
  context: FeatureContext,
  response: unknown,
): Promise<Response> {
  const saved = await database
    .prepare(
      "SELECT request_hash, response_json FROM idempotency_records WHERE idempotency_key = ?",
    )
    .bind(key)
    .first<IdempotencyRow>();
  if (saved?.request_hash !== hash) {
    if (saved)
      return featureError(
        context,
        "IDEMPOTENCY_CONFLICT",
        "This request key was used for different content.",
        409,
      );
    return featureError(
      context,
      "STALE_VERSION",
      "Source metadata changed during this request. Refresh and retry.",
      409,
    );
  }
  return featureJson(context, JSON.parse(saved.response_json) as unknown);
}

function idempotencyStatement(
  database: D1Database,
  input: {
    key: string;
    requestHash: string;
    aggregateType: string;
    aggregateId: string;
    response: unknown;
    createdAt: string;
  },
) {
  return database
    .prepare(
      `INSERT OR IGNORE INTO idempotency_records (
      idempotency_key, request_hash, aggregate_type, aggregate_id, response_json, created_at
    ) SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
    )
    .bind(
      input.key,
      input.requestHash,
      input.aggregateType,
      input.aggregateId,
      JSON.stringify(input.response),
      input.createdAt,
    );
}
