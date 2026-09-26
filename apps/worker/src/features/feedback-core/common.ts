import { preserveFeedbackText } from "@civicresolve/domain/feedback";
import type { D1Database, D1PreparedStatement } from "@civicresolve/db/d1";
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
} from "../shared.js";
import type {
  FeedbackContext,
  FeedbackMessageRow,
  FeedbackRow,
} from "./types.js";
import { MAX_MESSAGE_LENGTH } from "./types.js";
import { MAX_JSON_REQUEST_BYTES } from "./types.js";

export {
  featureError,
  featureJson,
  findIdempotentResponse,
  idempotencyStatement,
  outboxStatement,
  parseIdempotencyKey,
  scopedIdempotencyKey,
  sha256Hex,
  stableId,
};

export function normalizedMessage(value: unknown): string | null {
  return preserveFeedbackText(value, MAX_MESSAGE_LENGTH);
}

export function optionalFeedbackText(
  value: unknown,
  maximumLength: number,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return preserveFeedbackText(value, maximumLength);
}

export async function jsonBody<T>(request: Request): Promise<T | null> {
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_REQUEST_BYTES)
    return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_JSON_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

export function validLocale(value: unknown, request: Request): "en" | "fr" {
  if (value === "fr" || value === "en") return value;
  return request.headers.get("Accept-Language")?.toLowerCase().startsWith("fr")
    ? "fr"
    : "en";
}

export async function receiptTokenHash(
  request: Request,
): Promise<string | null> {
  const token = request.headers.get("X-Receipt-Token")?.toLowerCase();
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return sha256Hex(token);
}

export function messageView(message: FeedbackMessageRow) {
  return {
    id: message.id,
    author: message.author_kind,
    body: message.body,
    createdAt: message.created_at,
  } as const;
}

export function insertMessage(
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

export function insertAudit(
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

export function statusView(
  context: FeedbackContext,
  row: FeedbackRow,
  messages: FeedbackMessageRow[],
  evidence: Array<{
    id: string;
    fileName: string;
    contentType: string;
    byteSize: number;
  }>,
) {
  return {
    id: row.id,
    originalText: row.original_text ?? "",
    constructiveFollowUp: row.constructive_follow_up ?? null,
    category: row.category ?? "other_or_unsure",
    municipality: row.municipality_csd_uid
      ? {
          id: row.municipality_csd_uid,
          name: row.municipality_name ?? "Toronto",
          province: row.province_name ?? "Ontario",
        }
      : null,
    sample: row.sample === 1,
    destinationLabel: row.department_name,
    status: row.status,
    departmentName: row.department_name,
    messages: messages.map(messageView),
    evidence: evidence.map((item) => ({
      ...item,
      downloadPath: `/api/v1/feedback/receipts/${row.id}/attachments/${item.id}`,
    })),
    outcome: row.outcome,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
