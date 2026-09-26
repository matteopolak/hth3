import { API_VERSION } from "@civicresolve/contracts/v1";
import {
  IdempotencyConflictError,
  type D1Database,
  type D1PreparedStatement,
} from "@civicresolve/db/d1";
import type { AuthEnvironment } from "../auth/identity.js";

export interface FeatureContext {
  env: AuthEnvironment;
  requestId: string;
  cors: Headers;
}

export interface StoredIdempotencyRecord {
  request_hash: string;
  response_json: string;
}

export interface TransactionalOutboxEvent {
  eventId: string;
  eventType: string;
  occurredAt: string;
  actorKind: string;
  actorSubject: string | null;
  organizationId: string | null;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  payload: unknown;
}

export function featureJson(
  context: FeatureContext,
  value: unknown,
  status = 200,
): Response {
  const headers = new Headers(context.cors);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value), { status, headers });
}

export function featureError(
  context: FeatureContext,
  code: string,
  message: string,
  status: number,
): Response {
  return featureJson(
    context,
    {
      apiVersion: API_VERSION,
      error: { code, message, requestId: context.requestId },
    },
    status,
  );
}

export function parseIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("Idempotency-Key");
  return key && key.length >= 16 && key.length <= 128 ? key : null;
}

export function scopedIdempotencyKey(
  namespace: string,
  subject: string | null,
  key: string,
): string {
  return `${namespace}:${subject ?? "guest"}:${key}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function stableId(prefix: string, value: string): Promise<string> {
  return `${prefix}_${(await sha256Hex(value)).slice(0, 32)}`;
}

export async function findIdempotentResponse(
  database: D1Database,
  key: string,
  requestHash: string,
): Promise<unknown | null> {
  const record = await database
    .prepare(
      "SELECT request_hash, response_json FROM idempotency_records WHERE idempotency_key = ?",
    )
    .bind(key)
    .first<StoredIdempotencyRecord>();
  if (!record) return null;
  if (record.request_hash !== requestHash) throw new IdempotencyConflictError();
  return JSON.parse(record.response_json) as unknown;
}

export function idempotencyStatement(
  database: D1Database,
  input: {
    key: string;
    requestHash: string;
    aggregateType: string;
    aggregateId: string;
    response: unknown;
    createdAt: string;
  },
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT OR IGNORE INTO idempotency_records (
        idempotency_key, request_hash, aggregate_type, aggregate_id,
        response_json, created_at
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

export function outboxStatement(
  database: D1Database,
  event: TransactionalOutboxEvent,
): D1PreparedStatement {
  const payloadJson = JSON.stringify(event.payload);
  if (payloadJson === undefined)
    throw new TypeError("Outbox payload must be JSON serializable.");
  return database
    .prepare(
      `INSERT OR IGNORE INTO outbox_events (
        event_id, event_type, schema_version, occurred_at, actor_kind,
        actor_subject, organization_id, aggregate_type, aggregate_id,
        idempotency_key, payload_json, attempts, next_attempt_at
      ) SELECT ?, ?, '1.0', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?
        WHERE changes() = 1`,
    )
    .bind(
      event.eventId,
      event.eventType,
      event.occurredAt,
      event.actorKind,
      event.actorSubject,
      event.organizationId,
      event.aggregateType,
      event.aggregateId,
      event.idempotencyKey,
      payloadJson,
      event.occurredAt,
    );
}
