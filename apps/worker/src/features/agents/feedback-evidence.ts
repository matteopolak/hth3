import { privateAssetKey, type D1Database } from "@civicresolve/db/d1";
import { featureError, featureJson } from "../shared.js";
import { enforceGuestAbuseLimit } from "../feedback-core/abuse.js";
import {
  agentEvidenceOwner,
  STAGED_EVIDENCE_RETENTION_MS,
  validateEvidenceFile,
  InvalidEvidenceError,
} from "../feedback-core/evidence.js";
import type {
  FeedbackContext,
  PrivateAssetRow,
} from "../feedback-core/types.js";
import {
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_FILES,
  MAX_TOTAL_EVIDENCE_BYTES,
} from "../feedback-core/types.js";
import type { AgentContext, ConversationRow, ProposalRow } from "./types.js";

const ASSET_ID = /^asset_[a-f0-9]{32}$/;
const MAX_MULTIPART_BYTES = MAX_EVIDENCE_BYTES + 256 * 1024;

interface StagedAssetRow extends PrivateAssetRow {}

export async function uploadFeedbackEvidence(
  request: Request,
  conversation: ConversationRow,
  context: AgentContext,
): Promise<Response> {
  if (conversation.mode !== "resident")
    return featureError(
      context,
      "FORBIDDEN",
      "Resident access is required.",
      403,
    );
  const limited = await enforceGuestAbuseLimit(
    request,
    context as FeedbackContext,
    "create",
    { bucketNamespace: "agent-evidence-upload" },
  );
  if (limited) return limited;
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES)
    return invalidEvidence(context);
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("multipart/form-data;")
  ) {
    return invalidEvidence(context);
  }

  const formData = await boundedFormData(request, MAX_MULTIPART_BYTES);
  if (formData?.getAll("file").length !== 1) return invalidEvidence(context);
  const file = formData?.get("file") ?? null;
  if (!file || typeof file === "string" || file.size > MAX_EVIDENCE_BYTES)
    return invalidEvidence(context);

  let validated;
  try {
    validated = await validateEvidenceFile({
      fileName: file.name,
      contentType: file.type,
      data: new Uint8Array(await file.arrayBuffer()),
    });
  } catch (error) {
    if (error instanceof InvalidEvidenceError) return invalidEvidence(context);
    throw error;
  }

  const feedbackContext = context as FeedbackContext;
  const bucket = feedbackContext.env.PRIVATE_ASSETS;
  if (!bucket)
    return featureError(
      context,
      "EVIDENCE_STORAGE_UNAVAILABLE",
      "Private evidence storage is unavailable.",
      503,
    );
  const database = context.env.DB;
  await removeExpiredStagedAssets(database, bucket, conversation.id);
  const current = await database
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(byte_size), 0) AS byte_size
       FROM private_assets
       WHERE purpose = 'feedback_attachment' AND organization_id IS NULL
         AND record_id = ? AND owner_subject = ?`,
    )
    .bind(conversation.id, agentEvidenceOwner(conversation.id))
    .first<{ count: number; byte_size: number }>();
  if (
    (current?.count ?? 0) >= MAX_EVIDENCE_FILES ||
    (current?.byte_size ?? 0) + validated.data.byteLength >
      MAX_TOTAL_EVIDENCE_BYTES
  ) {
    return featureError(
      context,
      "EVIDENCE_LIMIT_REACHED",
      "This conversation can stage up to three files and 10 MiB of evidence.",
      409,
    );
  }

  const assetId = `asset_${randomHex(16)}`;
  const ownerSubject = agentEvidenceOwner(conversation.id);
  const objectKey = privateAssetKey(
    {
      purpose: "feedback_attachment",
      organizationId: null,
      ownerSubject,
      recordId: conversation.id,
    },
    assetId,
  );
  const createdAt = new Date().toISOString();
  try {
    const result = await database
      .prepare(
        `INSERT INTO private_assets (
          id, organization_id, owner_subject, purpose, record_id, object_key,
          filename, content_type, byte_size, created_at
        ) SELECT ?, NULL, ?, 'feedback_attachment', ?, ?, ?, ?, ?, ?
        WHERE (
          SELECT COUNT(*) FROM private_assets
          WHERE purpose = 'feedback_attachment' AND organization_id IS NULL
            AND record_id = ? AND owner_subject = ?
        ) < ? AND (
          SELECT COALESCE(SUM(byte_size), 0) FROM private_assets
          WHERE purpose = 'feedback_attachment' AND organization_id IS NULL
            AND record_id = ? AND owner_subject = ?
        ) + ? <= ?`,
      )
      .bind(
        assetId,
        ownerSubject,
        conversation.id,
        objectKey,
        validated.fileName,
        validated.contentType,
        validated.data.byteLength,
        createdAt,
        conversation.id,
        ownerSubject,
        MAX_EVIDENCE_FILES,
        conversation.id,
        ownerSubject,
        validated.data.byteLength,
        MAX_TOTAL_EVIDENCE_BYTES,
      )
      .run();
    if (result.meta.changes !== 1) return evidenceLimit(context);
    try {
      await bucket.put(objectKey, validated.data, {
        httpMetadata: { contentType: validated.contentType },
      });
    } catch {
      await database
        .prepare(
          `DELETE FROM private_assets WHERE id = ? AND object_key = ?
             AND organization_id IS NULL AND record_id = ? AND owner_subject = ?`,
        )
        .bind(assetId, objectKey, conversation.id, ownerSubject)
        .run()
        .catch(() => undefined);
      return featureError(
        context,
        "EVIDENCE_STORAGE_UNAVAILABLE",
        "Private evidence storage is unavailable.",
        503,
      );
    }
  } catch (error) {
    await bucket.delete(objectKey).catch(() => undefined);
    return featureError(
      context,
      "EVIDENCE_STORAGE_UNAVAILABLE",
      "Private evidence storage is unavailable.",
      503,
    );
  }

  return featureJson(
    context,
    {
      apiVersion: "v1",
      asset: {
        id: assetId,
        fileName: validated.fileName,
        contentType: validated.contentType,
        byteSize: validated.data.byteLength,
      },
    },
    201,
  );
}

export async function attachFeedbackEvidence(
  request: Request,
  conversation: ConversationRow,
  proposalId: string,
  context: AgentContext,
): Promise<Response> {
  if (conversation.mode !== "resident")
    return featureError(
      context,
      "FORBIDDEN",
      "Resident access is required.",
      403,
    );
  let body: { assetId?: unknown } | null;
  try {
    body = (await request.json()) as { assetId?: unknown };
  } catch {
    body = null;
  }
  const assetId = body?.assetId;
  if (typeof assetId !== "string" || !ASSET_ID.test(assetId))
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a staged evidence asset ID.",
      400,
    );

  const database = context.env.DB;
  const proposal = await database
    .prepare(
      `SELECT id, conversation_id, tool_name, args_json, preview_json, status,
         result_json, created_at, expires_at, decided_at
       FROM agent_proposals WHERE id = ? AND conversation_id = ?`,
    )
    .bind(proposalId, conversation.id)
    .first<ProposalRow>();
  if (!proposal)
    return featureError(context, "NOT_FOUND", "Proposal not found.", 404);
  if (
    proposal.status !== "pending" ||
    proposal.tool_name !== "create_feedback" ||
    new Date(proposal.expires_at).getTime() < Date.now()
  ) {
    return featureError(
      context,
      "PROPOSAL_UNAVAILABLE",
      "Evidence can be attached only to a pending feedback proposal.",
      409,
    );
  }

  const args = JSON.parse(proposal.args_json) as Record<string, unknown>;
  const existingIds = Array.isArray(args.feedbackEvidenceAssetIds)
    ? args.feedbackEvidenceAssetIds.filter(
        (value): value is string =>
          typeof value === "string" && ASSET_ID.test(value),
      )
    : [];
  if (existingIds.includes(assetId))
    return featureError(
      context,
      "EVIDENCE_ALREADY_ATTACHED",
      "This file is already attached to the proposal.",
      409,
    );
  if (existingIds.length >= MAX_EVIDENCE_FILES) return evidenceLimit(context);

  const row = await database
    .prepare(
      `SELECT id, organization_id, owner_subject, purpose, record_id,
         object_key, filename, content_type, byte_size, created_at
       FROM private_assets
       WHERE id = ? AND organization_id IS NULL
         AND purpose = 'feedback_attachment' AND record_id = ? AND owner_subject = ?`,
    )
    .bind(assetId, conversation.id, agentEvidenceOwner(conversation.id))
    .first<StagedAssetRow>();
  if (!row || isExpired(row.created_at))
    return featureError(context, "NOT_FOUND", "Evidence not found.", 404);
  if (row.byte_size <= 0 || row.byte_size > MAX_EVIDENCE_BYTES) {
    return evidenceLimit(context);
  }

  const otherProposals = await database
    .prepare(
      `SELECT id, args_json FROM agent_proposals
       WHERE conversation_id = ? AND status = 'pending' AND tool_name = 'create_feedback'
         AND id != ?`,
    )
    .bind(conversation.id, proposal.id)
    .all<{ id: string; args_json: string }>();
  if (
    (otherProposals.results ?? []).some((candidate) => {
      const candidateArgs = JSON.parse(candidate.args_json) as Record<
        string,
        unknown
      >;
      return (
        Array.isArray(candidateArgs.feedbackEvidenceAssetIds) &&
        candidateArgs.feedbackEvidenceAssetIds.includes(assetId)
      );
    })
  ) {
    return featureError(
      context,
      "EVIDENCE_ALREADY_ATTACHED",
      "This file is already attached to another pending proposal.",
      409,
    );
  }

  const argsNext = {
    ...args,
    feedbackEvidenceAssetIds: [...existingIds, assetId],
  };
  const preview = JSON.parse(proposal.preview_json) as Record<string, unknown>;
  const evidence = await database
    .prepare(
      `SELECT id, filename, content_type, byte_size FROM private_assets
       WHERE id IN (${[...existingIds, assetId].map(() => "?").join(", ")})
         AND organization_id IS NULL AND purpose = 'feedback_attachment'
         AND record_id = ? AND owner_subject = ? ORDER BY created_at, id`,
    )
    .bind(
      ...[...existingIds, assetId],
      conversation.id,
      agentEvidenceOwner(conversation.id),
    )
    .all<
      Pick<PrivateAssetRow, "id" | "filename" | "content_type" | "byte_size">
    >();
  const previewNext = {
    ...preview,
    feedbackEvidence: (evidence.results ?? []).map((item) => ({
      id: item.id,
      fileName: item.filename,
      contentType: item.content_type,
      byteSize: item.byte_size,
    })),
  };
  if (
    (evidence.results?.length ?? 0) !== existingIds.length + 1 ||
    (evidence.results ?? []).reduce((sum, item) => sum + item.byte_size, 0) >
      MAX_TOTAL_EVIDENCE_BYTES
  ) {
    return evidenceLimit(context);
  }
  const updated = await database
    .prepare(
      `UPDATE agent_proposals SET args_json = ?, preview_json = ?
       WHERE id = ? AND conversation_id = ? AND status = 'pending'
         AND args_json = ? AND preview_json = ?`,
    )
    .bind(
      JSON.stringify(argsNext),
      JSON.stringify(previewNext),
      proposal.id,
      conversation.id,
      proposal.args_json,
      proposal.preview_json,
    )
    .run();
  if (updated.meta.changes !== 1)
    return featureError(
      context,
      "PROPOSAL_CHANGED",
      "Refresh the proposal before attaching evidence.",
      409,
    );
  return featureJson(context, {
    apiVersion: "v1",
    proposal: { id: proposal.id, status: "pending", preview: previewNext },
  });
}

async function removeExpiredStagedAssets(
  database: D1Database,
  bucket: NonNullable<FeedbackContext["env"]["PRIVATE_ASSETS"]>,
  conversationId: string,
): Promise<void> {
  const cutoff = new Date(
    Date.now() - STAGED_EVIDENCE_RETENTION_MS,
  ).toISOString();
  const result = await database
    .prepare(
      `SELECT id, object_key FROM private_assets
       WHERE organization_id IS NULL AND purpose = 'feedback_attachment'
         AND record_id = ? AND owner_subject = ? AND created_at < ?`,
    )
    .bind(conversationId, agentEvidenceOwner(conversationId), cutoff)
    .all<Pick<PrivateAssetRow, "id" | "object_key">>();
  for (const row of result.results ?? []) {
    try {
      await bucket.delete(row.object_key);
      await database
        .prepare(
          `DELETE FROM private_assets WHERE id = ? AND object_key = ?
             AND organization_id IS NULL AND purpose = 'feedback_attachment'
             AND record_id = ?`,
        )
        .bind(row.id, row.object_key, conversationId)
        .run();
    } catch {
      // Expired staged evidence remains private if cleanup is temporarily unavailable.
    }
  }
}

async function boundedFormData(
  request: Request,
  maximumBytes: number,
): Promise<FormData | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: bytes,
    }).formData();
  } catch {
    return null;
  }
}

function isExpired(createdAt: string): boolean {
  const age = Date.now() - new Date(createdAt).getTime();
  return !Number.isFinite(age) || age < 0 || age > STAGED_EVIDENCE_RETENTION_MS;
}

function invalidEvidence(context: AgentContext): Response {
  return featureError(
    context,
    "INVALID_EVIDENCE",
    "Choose a PDF, PNG, or JPEG file up to 5 MiB.",
    400,
  );
}

function evidenceLimit(context: AgentContext): Response {
  return featureError(
    context,
    "EVIDENCE_LIMIT_REACHED",
    "A feedback proposal can include up to three files and 10 MiB of evidence.",
    409,
  );
}

function randomHex(bytesLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
