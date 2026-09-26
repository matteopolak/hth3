import type { D1Database } from "@civicresolve/db/d1";
import type {
  FeedbackMessageRow,
  FeedbackRow,
  PrivateAssetRow,
} from "./types.js";

const FEEDBACK_SELECT = `
  SELECT f.id, f.original_text, f.constructive_follow_up, f.category,
    f.municipality_csd_uid, m.name AS municipality_name,
    m.province_name, f.status, f.receipt_token_hash,
    COALESCE(d.routing_label, f.department_name) AS department_name,
    f.outcome, f.sample, f.created_at, f.updated_at, f.organization_id
  FROM feedback_submissions AS f
  LEFT JOIN municipality_geographies AS m
    ON m.csd_uid = f.municipality_csd_uid
  LEFT JOIN feedback_destinations AS d
    ON d.organization_id = f.organization_id
   AND d.municipality_csd_uid = f.municipality_csd_uid`;

export async function loadFeedbackForReceipt(
  database: D1Database,
  submissionId: string,
  tokenHash: string,
): Promise<(FeedbackRow & { organization_id: string | null }) | null> {
  return database
    .prepare(
      `${FEEDBACK_SELECT}
       WHERE f.id = ? AND f.receipt_token_hash = ?`,
    )
    .bind(submissionId, tokenHash)
    .first<FeedbackRow & { organization_id: string | null }>();
}

export async function loadFeedbackForOrganization(
  database: D1Database,
  submissionId: string,
  organizationId: string,
): Promise<(FeedbackRow & { organization_id: string }) | null> {
  return database
    .prepare(
      `${FEEDBACK_SELECT}
       WHERE f.id = ? AND f.organization_id = ?`,
    )
    .bind(submissionId, organizationId)
    .first<FeedbackRow & { organization_id: string }>();
}

export async function loadMessages(
  database: D1Database,
  submissionId: string,
): Promise<FeedbackMessageRow[]> {
  const result = await database
    .prepare(
      `SELECT id, author_kind, body, created_at FROM feedback_messages
       WHERE submission_id = ? ORDER BY created_at, id`,
    )
    .bind(submissionId)
    .all<FeedbackMessageRow>();
  return result.results ?? [];
}

export async function loadMessage(
  database: D1Database,
  submissionId: string,
  messageId: string,
): Promise<FeedbackMessageRow | null> {
  return database
    .prepare(
      `SELECT id, author_kind, body, created_at FROM feedback_messages
       WHERE submission_id = ? AND id = ?`,
    )
    .bind(submissionId, messageId)
    .first<FeedbackMessageRow>();
}

export async function loadReceiptEvidence(
  database: D1Database,
  submissionId: string,
): Promise<PrivateAssetRow[]> {
  const result = await database
    .prepare(
      `SELECT id, organization_id, owner_subject, purpose, record_id,
        object_key, filename, content_type, byte_size, created_at
       FROM private_assets WHERE purpose = 'feedback_attachment' AND record_id = ?
       ORDER BY created_at, id`,
    )
    .bind(submissionId)
    .all<PrivateAssetRow>();
  return result.results ?? [];
}
