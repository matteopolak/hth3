import type { D1Database } from "./types.js";

export interface OutboxEventInput {
  eventId?: string;
  eventType: string;
  schemaVersion: string;
  occurredAt: string;
  actorKind: string;
  actorSubject: string | null;
  organizationId: string | null;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  payload: unknown;
}

interface StoredOutboxEvent {
  event_id: string;
  event_type: string;
  schema_version: string;
  actor_kind: string;
  actor_subject: string | null;
  organization_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  payload_json: string;
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was already used for a different request.");
    this.name = "IdempotencyConflictError";
  }
}

export async function enqueueOutboxEvent(
  db: D1Database,
  input: OutboxEventInput,
): Promise<{ eventId: string; replayed: boolean }> {
  const payloadJson = JSON.stringify(input.payload);
  if (payloadJson === undefined)
    throw new TypeError("Outbox payload must be JSON serializable.");

  const existing = await findByIdempotencyKey(db, input.idempotencyKey);
  if (existing) {
    assertSameRequest(existing, input, payloadJson);
    return { eventId: existing.event_id, replayed: true };
  }

  const eventId = input.eventId ?? crypto.randomUUID();
  await db
    .prepare(
      `INSERT OR IGNORE INTO outbox_events (
        event_id, event_type, schema_version, occurred_at, actor_kind, actor_subject,
        organization_id, aggregate_type, aggregate_id, idempotency_key, payload_json,
        attempts, next_attempt_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(
      eventId,
      input.eventType,
      input.schemaVersion,
      input.occurredAt,
      input.actorKind,
      input.actorSubject,
      input.organizationId,
      input.aggregateType,
      input.aggregateId,
      input.idempotencyKey,
      payloadJson,
      input.occurredAt,
    )
    .run();

  const persisted = await findByIdempotencyKey(db, input.idempotencyKey);
  if (!persisted) throw new Error("The outbox event could not be persisted.");
  assertSameRequest(persisted, input, payloadJson);
  return {
    eventId: persisted.event_id,
    replayed: persisted.event_id !== eventId,
  };
}

export async function getOutboxEvent(
  db: D1Database,
  eventId: string,
): Promise<StoredOutboxEvent | null> {
  return db
    .prepare(
      `SELECT event_id, event_type, schema_version, actor_kind, actor_subject,
        organization_id, aggregate_type, aggregate_id, payload_json
       FROM outbox_events WHERE event_id = ?`,
    )
    .bind(eventId)
    .first<StoredOutboxEvent>();
}

async function findByIdempotencyKey(
  db: D1Database,
  idempotencyKey: string,
): Promise<StoredOutboxEvent | null> {
  return db
    .prepare(
      `SELECT event_id, event_type, schema_version, actor_kind, actor_subject,
        organization_id, aggregate_type, aggregate_id, payload_json
       FROM outbox_events WHERE idempotency_key = ?`,
    )
    .bind(idempotencyKey)
    .first<StoredOutboxEvent>();
}

function assertSameRequest(
  existing: StoredOutboxEvent,
  input: OutboxEventInput,
  payloadJson: string,
): void {
  const same =
    existing.event_type === input.eventType &&
    existing.schema_version === input.schemaVersion &&
    existing.actor_kind === input.actorKind &&
    existing.actor_subject === input.actorSubject &&
    existing.organization_id === input.organizationId &&
    existing.aggregate_type === input.aggregateType &&
    existing.aggregate_id === input.aggregateId &&
    existing.payload_json === payloadJson;
  if (!same) throw new IdempotencyConflictError();
}
