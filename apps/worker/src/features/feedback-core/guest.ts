import { API_VERSION, type FeedbackStatus } from "@civicresolve/contracts/v1";
import type { D1Database } from "@civicresolve/db/d1";
import {
  areStrongFeedbackDuplicates,
  canResidentReopenFeedback,
  canTransitionFeedback,
  isFeedbackCategory,
  normalizeFeedbackDuplicateText,
} from "@civicresolve/domain/feedback";
import type { FeedbackCategory } from "@civicresolve/domain/feedback";
import { authenticateRequest } from "../../auth/identity.js";
import { classifyFeedbackSubmission } from "../taxonomy/classification.js";
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
import { enforceGuestAbuseLimit } from "./abuse.js";
import {
  insertAudit,
  insertMessage,
  jsonBody,
  messageView,
  normalizedMessage,
  optionalFeedbackText,
  receiptTokenHash,
  validLocale,
} from "./common.js";
import {
  agentEvidenceOwner,
  deleteStoredEvidence,
  downloadEvidence,
  evidenceInsertStatements,
  evidenceView,
  deletePromotedSourceObjects,
  InvalidEvidenceError,
  listEvidence,
  promoteStagedEvidence,
  storeEvidence,
  validateEvidence,
} from "./evidence.js";
import {
  loadFeedbackForReceipt,
  loadMessage,
  loadMessages,
} from "./repository.js";
import type {
  EvidenceMetadata,
  FeedbackDuplicateCandidateRow,
  FeedbackContext,
  FeedbackMessageBody,
  FeedbackRow,
  GuestFeedbackCreateBody,
  GuestFeedbackDuplicateCheckBody,
  IdempotentFeedbackResponse,
} from "./types.js";
import {
  MAX_FOLLOW_UP_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_TOTAL_EVIDENCE_BYTES,
  RECEIPT_TOKEN_PATTERN,
  TORONTO_CSDUID,
} from "./types.js";

interface DestinationRow {
  organization_id: string;
  routing_label: string;
  sample: number;
  municipality_csd_uid: string;
  municipality_name: string;
  province_name: string;
}

const GUEST_DUPLICATE_CANDIDATE_LIMIT = 500;

export async function handleGuestFeedback(
  request: Request,
  url: URL,
  context: FeedbackContext,
): Promise<Response | null> {
  if (url.pathname === "/api/v1/feedback/duplicate-check") {
    if (request.method === "POST")
      return checkGuestFeedbackDuplicate(request, context);
    return featureError(context, "METHOD_NOT_ALLOWED", "Use POST.", 405);
  }
  if (url.pathname === "/api/v1/feedback") {
    if (request.method === "POST") return createGuestFeedback(request, context);
    return featureError(context, "METHOD_NOT_ALLOWED", "Use POST.", 405);
  }

  const attachment = url.pathname.match(
    /^\/api\/v1\/feedback\/receipts\/(fb_[a-f0-9]{32})\/attachments\/(asset_[a-f0-9]{32})$/,
  );
  if (attachment) {
    if (request.method !== "GET")
      return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);
    return getGuestEvidence(request, attachment[1]!, attachment[2]!, context);
  }

  const receiptMatch = url.pathname.match(
    /^\/api\/v1\/feedback\/receipts\/(fb_[a-f0-9]{32})(?:\/(messages|reopen))?$/,
  );
  if (!receiptMatch) return null;
  const submissionId = receiptMatch[1]!;
  const action = receiptMatch[2];
  if (!action && request.method === "GET")
    return getGuestReceipt(request, submissionId, context);
  if (action === "messages" && request.method === "POST")
    return addGuestMessage(request, submissionId, context);
  if (action === "reopen" && request.method === "POST")
    return reopenGuestFeedback(request, submissionId, context);
  return featureError(
    context,
    "METHOD_NOT_ALLOWED",
    action ? "Use POST." : "Use GET.",
    405,
  );
}

async function findRecentGuestDuplicate(
  database: D1Database,
  input: {
    message: string;
    category?: FeedbackCategory;
    destination: DestinationRow;
  },
): Promise<FeedbackDuplicateCandidateRow | null> {
  if (!normalizeFeedbackDuplicateText(input.message)) return null;
  const categoryFilter = input.category === undefined ? "" : "AND category = ?";
  const values: string[] = [
    input.destination.organization_id,
    input.destination.municipality_csd_uid,
  ];
  if (input.category !== undefined) values.push(input.category);
  const candidates = await database
    .prepare(
      `SELECT original_text, status
       FROM feedback_submissions
       WHERE organization_id = ? AND municipality_csd_uid = ?
         ${categoryFilter}
       ORDER BY CASE
         WHEN status IN ('closed', 'outcome_recorded') THEN 1
         ELSE 0
       END, created_at DESC
       LIMIT ${GUEST_DUPLICATE_CANDIDATE_LIMIT}`,
    )
    .bind(...values)
    .all<FeedbackDuplicateCandidateRow>();
  return (
    candidates.results?.find((candidate) =>
      areStrongFeedbackDuplicates(input.message, candidate.original_text),
    ) ?? null
  );
}

function duplicateCreateResponse(
  context: FeedbackContext,
  status: FeedbackStatus,
): Response {
  return featureJson(context, {
    apiVersion: API_VERSION,
    result: "duplicate",
    created: false,
    duplicate: { status },
  });
}

async function checkGuestFeedbackDuplicate(
  request: Request,
  context: FeedbackContext,
): Promise<Response> {
  const body = await jsonBody<GuestFeedbackDuplicateCheckBody>(request);
  const message = normalizedMessage(body?.message);
  if (
    !body ||
    !message ||
    typeof body.municipalityId !== "string" ||
    body.municipalityId.length !== 7 ||
    (body.category !== undefined && !isFeedbackCategory(body.category))
  ) {
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a message, supported municipality, and optional supported category.",
      400,
    );
  }
  const limited = await enforceGuestAbuseLimit(request, context, "create", {
    bucketNamespace: "duplicate-check",
  });
  if (limited) return limited;
  const destination = await resolveDestination(
    context.env.DB,
    body.municipalityId,
  );
  if (!destination) {
    return featureError(
      context,
      "DESTINATION_NOT_SUPPORTED",
      body.municipalityId === TORONTO_CSDUID
        ? "The fictional sandbox route is temporarily unavailable."
        : "This municipality is not supported by the feedback prototype. No report was sent to another municipality.",
      body.municipalityId === TORONTO_CSDUID ? 503 : 422,
    );
  }
  const duplicate = await findRecentGuestDuplicate(context.env.DB, {
    message,
    ...(body.category === undefined
      ? {}
      : { category: body.category as FeedbackCategory }),
    destination,
  });
  return featureJson(context, {
    apiVersion: API_VERSION,
    duplicate: duplicate ? { status: duplicate.status } : null,
  });
}

async function createGuestFeedback(
  request: Request,
  context: FeedbackContext,
): Promise<Response> {
  const body = await jsonBody<GuestFeedbackCreateBody>(request);
  if (!body)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a valid JSON request.",
      400,
    );
  const locale = validLocale(body.locale, request);
  if (body.emergency === true) return emergencyRedirect(context, locale);
  if (body.emergency !== undefined && body.emergency !== false)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Emergency must be true or false.",
      400,
    );

  if (
    typeof body.municipalityId !== "string" ||
    body.municipalityId.length !== 7
  ) {
    return featureError(
      context,
      "DESTINATION_NOT_SUPPORTED",
      "Choose a supported municipality to continue.",
      422,
    );
  }
  if (body.sandboxAcknowledged !== true) {
    return featureError(
      context,
      "SANDBOX_ACK_REQUIRED",
      locale === "fr"
        ? "Confirmez que ce message sera envoyé uniquement à la boîte d'essai d'Envoy à Toronto."
        : "Confirm that this message will go only to Envoy's practice queue in Toronto.",
      409,
    );
  }

  const message = normalizedMessage(body.message);
  const followUp = optionalFeedbackText(
    body.whatWouldImprove,
    MAX_FOLLOW_UP_LENGTH,
  );
  const category =
    body.category === undefined ? "other_or_unsure" : body.category;
  const duplicateOverride = body.duplicateOverride === true;
  const token = request.headers.get("X-Receipt-Token")?.toLowerCase();
  const clientKey = parseIdempotencyKey(request);
  if (
    !message ||
    (body.whatWouldImprove !== undefined &&
      body.whatWouldImprove !== null &&
      body.whatWouldImprove !== "" &&
      !followUp) ||
    !isFeedbackCategory(category) ||
    (body.duplicateOverride !== undefined &&
      typeof body.duplicateOverride !== "boolean") ||
    !token ||
    !RECEIPT_TOKEN_PATTERN.test(token) ||
    !clientKey
  ) {
    return featureError(
      context,
      "INVALID_REQUEST",
      `Provide a message up to ${MAX_MESSAGE_LENGTH} characters, an optional improvement note up to ${MAX_FOLLOW_UP_LENGTH} characters, a supported category, a 32-byte receipt token, and an Idempotency-Key.`,
      400,
    );
  }

  const stagedAssetIds = parseStagedEvidenceIds(body.feedbackEvidenceAssetIds);
  if (stagedAssetIds === null)
    return featureError(
      context,
      "INVALID_EVIDENCE",
      "Evidence must be attached to the resident's feedback proposal.",
      400,
    );
  const evidenceConversationId = stagedAssetIds.length
    ? await authorizedEvidenceConversation(request, context)
    : null;
  if (stagedAssetIds.length && !evidenceConversationId)
    return featureError(context, "NOT_FOUND", "Evidence not found.", 404);

  let files;
  try {
    files = await validateEvidence(body.evidence);
  } catch (error) {
    if (error instanceof InvalidEvidenceError)
      return featureError(context, "INVALID_EVIDENCE", error.message, 400);
    throw error;
  }

  const tokenHash = await sha256Hex(token);
  const idempotencyKey = scopedIdempotencyKey(
    "feedback:create",
    null,
    clientKey,
  );
  const evidenceHashes = files.map(({ digest }) => digest);
  const hashBody = {
    message,
    followUp,
    category,
    municipalityId: body.municipalityId,
    sandboxAcknowledged: body.sandboxAcknowledged,
    tokenHash,
    evidenceHashes,
    stagedAssetIds,
    ...(duplicateOverride ? { duplicateOverride: true } : {}),
  };
  const requestHash = await sha256Hex(JSON.stringify(hashBody));
  const database = context.env.DB;
  const replay = await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  );
  if (replay) {
    const id = (replay as IdempotentFeedbackResponse).submissionId;
    const receipt = id
      ? await getReceiptByToken(database, id, tokenHash)
      : null;
    if (!receipt)
      return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
    return featureJson(context, {
      apiVersion: API_VERSION,
      submission: receipt,
      receiptToken: token,
    });
  }

  const destination = await resolveDestination(database, body.municipalityId);
  if (!destination) {
    return featureError(
      context,
      "DESTINATION_NOT_SUPPORTED",
      body.municipalityId === TORONTO_CSDUID
        ? "The fictional sandbox route is temporarily unavailable."
        : "This municipality is not supported by the feedback prototype. No report was sent to another municipality.",
      body.municipalityId === TORONTO_CSDUID ? 503 : 422,
    );
  }

  const alreadyUsedToken = await database
    .prepare("SELECT id FROM feedback_submissions WHERE receipt_token_hash = ?")
    .bind(tokenHash)
    .first<{ id: string }>();
  if (alreadyUsedToken)
    return featureError(
      context,
      "IDEMPOTENCY_CONFLICT",
      "Use a new private receipt token for a new report.",
      409,
    );

  const limited = await enforceGuestAbuseLimit(request, context, "create");
  if (limited) return limited;

  if (!duplicateOverride) {
    const duplicate = await findRecentGuestDuplicate(database, {
      message,
      ...(body.category === undefined ? {} : { category }),
      destination,
    });
    if (duplicate) return duplicateCreateResponse(context, duplicate.status);
  }

  const now = new Date().toISOString();
  const submissionId = await stableId("fb", idempotencyKey);
  const messageId = await stableId("fbm", `${idempotencyKey}:initial`);
  const auditId = await stableId("audit", `${idempotencyKey}:created`);
  const eventKey = `feedback.submitted:${idempotencyKey}`;
  const eventId = await stableId("evt", eventKey);
  const evidence = await storeEvidence(context, {
    submissionId,
    organizationId: destination.organization_id,
    files,
    createdAt: now,
  }).catch((error: unknown) => {
    if (
      error instanceof Error &&
      error.name === "EvidenceStorageUnavailableError"
    )
      return null;
    throw error;
  });
  if (evidence === null) {
    return featureError(
      context,
      "EVIDENCE_STORAGE_UNAVAILABLE",
      "Private evidence storage is unavailable.",
      503,
    );
  }

  let stagedEvidence: Awaited<ReturnType<typeof promoteStagedEvidence>> = [];
  if (stagedAssetIds.length && evidenceConversationId) {
    try {
      stagedEvidence = await promoteStagedEvidence(context, {
        conversationId: evidenceConversationId,
        stagedAssetIds,
        submissionId,
        organizationId: destination.organization_id,
        createdAt: now,
      });
      evidence.push(...stagedEvidence);
      const inlineBytes = files.reduce(
        (total, file) => total + file.data.byteLength,
        0,
      );
      const stagedBytes = stagedEvidence.reduce(
        (total, item) => total + item.metadata.byteSize,
        0,
      );
      if (inlineBytes + stagedBytes > MAX_TOTAL_EVIDENCE_BYTES) {
        const bucket = context.env.PRIVATE_ASSETS;
        if (bucket) await deleteStoredEvidence(bucket, evidence);
        return featureError(
          context,
          "INVALID_EVIDENCE",
          "Evidence must total 10 MiB or less.",
          400,
        );
      }
    } catch (error) {
      const bucket = context.env.PRIVATE_ASSETS;
      if (bucket) await deleteStoredEvidence(bucket, evidence);
      if (error instanceof InvalidEvidenceError)
        return featureError(context, "INVALID_EVIDENCE", error.message, 400);
      if (
        error instanceof Error &&
        error.name === "EvidenceStorageUnavailableError"
      )
        return featureError(
          context,
          "EVIDENCE_STORAGE_UNAVAILABLE",
          "Private evidence storage is unavailable.",
          503,
        );
      throw error;
    }
  }

  try {
    const insertGuards: string[] = [];
    const insertGuardValues: Array<string> = [];
    if (!duplicateOverride && normalizeFeedbackDuplicateText(message)) {
      const categoryFilter =
        body.category === undefined ? "" : "AND category = ?";
      insertGuards.push(`NOT EXISTS (
        SELECT 1 FROM feedback_submissions
        WHERE organization_id = ? AND municipality_csd_uid = ?
          ${categoryFilter}
          AND lower(trim(original_text)) = lower(trim(?))
      )`);
      insertGuardValues.push(
        destination.organization_id,
        destination.municipality_csd_uid,
      );
      if (body.category !== undefined) insertGuardValues.push(category);
      insertGuardValues.push(message);
    }
    for (const assetId of stagedAssetIds) {
      insertGuards.push(`EXISTS (
        SELECT 1 FROM private_assets
        WHERE id = ? AND organization_id IS NULL
          AND purpose = 'feedback_attachment' AND record_id = ?
          AND owner_subject = ?
      )`);
      insertGuardValues.push(
        assetId,
        evidenceConversationId!,
        agentEvidenceOwner(evidenceConversationId!),
      );
    }
    const insertGuard = insertGuards.length
      ? `WHERE ${insertGuards.join(" AND ")}`
      : "";
    const submissionInsert = database
      .prepare(
        `INSERT OR IGNORE INTO feedback_submissions (
          id, organization_id, original_text, status, receipt_token_hash,
          department_name, outcome, sample, created_at, updated_at,
          municipality_csd_uid, category, constructive_follow_up
        ) SELECT ?, ?, ?, 'submitted', ?, ?, NULL, ?, ?, ?, ?, ?, ?
          ${insertGuard}`,
      )
      .bind(
        submissionId,
        destination.organization_id,
        message,
        tokenHash,
        destination.routing_label,
        destination.sample,
        now,
        now,
        destination.municipality_csd_uid,
        category,
        followUp,
        ...insertGuardValues,
      );
    const batchResults = await database.batch([
      submissionInsert,
      insertMessage(database, {
        id: messageId,
        submissionId,
        authorKind: "resident",
        authorSubject: null,
        organizationId: destination.organization_id,
        body: message,
        createdAt: now,
        onlyIfPreviousChange: true,
      }),
      insertAudit(database, {
        id: auditId,
        subject: "guest",
        organizationId: destination.organization_id,
        action: "feedback_submitted",
        entityId: submissionId,
        details: {
          status: "submitted",
          sample: true,
          category,
          municipalityCsdUid: destination.municipality_csd_uid,
          messageLength: message.length,
          followUpLength: followUp?.length ?? 0,
          evidenceCount: evidence.length,
        },
        createdAt: now,
        onlyIfPreviousChange: true,
      }),
      outboxStatement(database, {
        eventId,
        eventType: "feedback.submitted",
        occurredAt: now,
        actorKind: "guest",
        actorSubject: null,
        organizationId: destination.organization_id,
        aggregateType: "feedback_submission",
        aggregateId: submissionId,
        idempotencyKey: eventKey,
        payload: {
          status: "submitted",
          messageLength: message.length,
          category,
          municipalityCsdUid: destination.municipality_csd_uid,
          followUpProvided: followUp !== null,
          evidenceCount: evidence.length,
          sample: true,
        },
      }),
      ...evidenceInsertStatements(database, evidence, true),
      idempotencyStatement(database, {
        key: idempotencyKey,
        requestHash,
        aggregateType: "feedback_submission",
        aggregateId: submissionId,
        response: { submissionId },
        createdAt: now,
      }),
    ]);

    if (batchResults[0]?.meta.changes === 0) {
      const persisted = await findIdempotentResponse(
        database,
        idempotencyKey,
        requestHash,
      );
      if (!persisted) {
        const bucket = context.env.PRIVATE_ASSETS;
        if (bucket && evidence.length)
          await deleteStoredEvidence(bucket, evidence);
        const duplicate = await findRecentGuestDuplicate(database, {
          message,
          ...(body.category === undefined ? {} : { category }),
          destination,
        });
        if (duplicate)
          return duplicateCreateResponse(context, duplicate.status);
        return featureError(
          context,
          "SUBMISSION_NOT_CREATED",
          "The report was not created. Please check the message and try again.",
          409,
        );
      }
      if (stagedEvidence.length > 0) {
        const bucket = context.env.PRIVATE_ASSETS;
        if (bucket) await deleteStoredEvidence(bucket, stagedEvidence);
        const id = (persisted as IdempotentFeedbackResponse).submissionId;
        const receipt = id
          ? await getReceiptByToken(database, id, tokenHash)
          : null;
        if (!receipt)
          return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
        return featureJson(context, {
          apiVersion: API_VERSION,
          submission: receipt,
          receiptToken: token,
        });
      }
    } else if (stagedEvidence.length > 0) {
      const bucket = context.env.PRIVATE_ASSETS;
      if (bucket) await deletePromotedSourceObjects(bucket, stagedEvidence);
    }
  } catch (error) {
    const bucket = context.env.PRIVATE_ASSETS;
    if (bucket) await deleteStoredEvidence(bucket, evidence);
    throw error;
  }

  const persisted = await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  );
  const savedId = (persisted as IdempotentFeedbackResponse | null)
    ?.submissionId;
  if (savedId)
    await classifyFeedbackSubmission(database, context.env.AI, savedId).catch(
      () => null,
    );
  const receipt = savedId
    ? await getReceiptByToken(database, savedId, tokenHash)
    : null;
  if (!receipt) {
    return featureError(
      context,
      "IDEMPOTENCY_CONFLICT",
      "The request key could not be applied to this submission.",
      409,
    );
  }
  return featureJson(
    context,
    { apiVersion: API_VERSION, submission: receipt, receiptToken: token },
    201,
  );
}

function parseStagedEvidenceIds(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 3 ||
    value.some(
      (id) => typeof id !== "string" || !/^asset_[a-f0-9]{32}$/.test(id),
    ) ||
    new Set(value).size !== value.length
  ) {
    return null;
  }
  return value as string[];
}

async function authorizedEvidenceConversation(
  request: Request,
  context: FeedbackContext,
): Promise<string | null> {
  const id = request.headers.get("X-Agent-Conversation-Id");
  if (!id || !/^conv_[a-f0-9]{32}$/.test(id)) return null;
  const conversation = await context.env.DB.prepare(
    `SELECT id, mode, owner_subject, guest_token_hash
     FROM agent_conversations WHERE id = ?`,
  )
    .bind(id)
    .first<{
      id: string;
      mode: string;
      owner_subject: string | null;
      guest_token_hash: string | null;
    }>();
  if (!conversation || conversation.mode !== "resident") return null;
  if (conversation.owner_subject) {
    try {
      const actor = await authenticateRequest(request, context.env);
      return actor?.subject === conversation.owner_subject ? id : null;
    } catch {
      return null;
    }
  }
  const token = request.headers.get("X-Conversation-Token");
  if (!token || !conversation.guest_token_hash) return null;
  return (await sha256Hex(token)) === conversation.guest_token_hash ? id : null;
}

async function getGuestReceipt(
  request: Request,
  submissionId: string,
  context: FeedbackContext,
): Promise<Response> {
  const tokenHash = await receiptTokenHash(request);
  if (!tokenHash)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  const receipt = await getReceiptByToken(
    context.env.DB,
    submissionId,
    tokenHash,
  );
  if (!receipt)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  return featureJson(context, { apiVersion: API_VERSION, submission: receipt });
}

async function addGuestMessage(
  request: Request,
  submissionId: string,
  context: FeedbackContext,
): Promise<Response> {
  const tokenHash = await receiptTokenHash(request);
  if (!tokenHash)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  const current = await loadFeedbackForReceipt(
    context.env.DB,
    submissionId,
    tokenHash,
  );
  if (!current)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  const body = await jsonBody<FeedbackMessageBody>(request);
  const message = normalizedMessage(body?.message);
  const clientKey = parseIdempotencyKey(request);
  if (!message || !clientKey)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a message and an Idempotency-Key.",
      400,
    );

  const database = context.env.DB;
  const idempotencyKey = scopedIdempotencyKey(
    `feedback:resident-message:${submissionId}`,
    null,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ submissionId, tokenHash, message }),
  );
  const replay = await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  );
  const messageId =
    (replay as IdempotentFeedbackResponse | null)?.messageId ??
    (await stableId("fbm", idempotencyKey));
  if (!replay) {
    if (current.status === "closed" || current.status === "outcome_recorded")
      return featureError(
        context,
        "REOPEN_REQUIRED",
        "Reopen this receipt with more information before sending another reply.",
        409,
      );
    const limited = await enforceGuestAbuseLimit(request, context, "reply");
    if (limited) return limited;
    const now = new Date().toISOString();
    const auditId = await stableId("audit", `${idempotencyKey}:message`);
    const eventKey = `feedback.message_added:${idempotencyKey}`;
    const eventId = await stableId("evt", eventKey);
    const waitingForResident = current.status === "waiting_on_resident";
    const statusIdempotencyKey = `feedback.status_changed:${idempotencyKey}`;
    const statusAuditId = await stableId(
      "audit",
      `${idempotencyKey}:status-resumed`,
    );
    const statusEventId = await stableId("evt", statusIdempotencyKey);
    await database.batch([
      ...(waitingForResident
        ? [
            database
              .prepare(
                `UPDATE feedback_submissions SET status = 'in_review', updated_at = ?
                 WHERE id = ? AND receipt_token_hash = ?
                   AND status = 'waiting_on_resident'`,
              )
              .bind(now, submissionId, tokenHash),
            insertAudit(database, {
              id: statusAuditId,
              subject: "guest",
              organizationId: current.organization_id,
              action: "feedback_status_changed",
              entityId: submissionId,
              details: {
                previousStatus: "waiting_on_resident",
                status: "in_review",
                resumedByResident: true,
              },
              createdAt: now,
              onlyIfPreviousChange: true,
            }),
            outboxStatement(database, {
              eventId: statusEventId,
              eventType: "feedback.status_changed",
              occurredAt: now,
              actorKind: "guest",
              actorSubject: null,
              organizationId: current.organization_id,
              aggregateType: "feedback_submission",
              aggregateId: submissionId,
              idempotencyKey: statusIdempotencyKey,
              payload: {
                previousStatus: "waiting_on_resident",
                status: "in_review",
              },
            }),
          ]
        : []),
      insertMessage(database, {
        id: messageId,
        submissionId,
        authorKind: "resident",
        authorSubject: null,
        body: message,
        createdAt: now,
        receiptHash: tokenHash,
      }),
      insertAudit(database, {
        id: auditId,
        subject: "guest",
        organizationId: current.organization_id,
        action: "feedback_message_added",
        entityId: submissionId,
        details: { author: "resident", messageLength: message.length },
        createdAt: now,
        onlyIfPreviousChange: true,
      }),
      outboxStatement(database, {
        eventId,
        eventType: "feedback.message_added",
        occurredAt: now,
        actorKind: "guest",
        actorSubject: null,
        organizationId: current.organization_id,
        aggregateType: "feedback_submission",
        aggregateId: submissionId,
        idempotencyKey: eventKey,
        payload: { author: "resident", messageLength: message.length },
      }),
      idempotencyStatement(database, {
        key: idempotencyKey,
        requestHash,
        aggregateType: "feedback_message",
        aggregateId: messageId,
        response: { submissionId, messageId },
        createdAt: now,
      }),
    ]);
  }

  const saved = await loadMessage(database, submissionId, messageId);
  if (!saved)
    return featureError(
      context,
      "REOPEN_REQUIRED",
      "This feedback thread is no longer open.",
      409,
    );
  return featureJson(context, {
    apiVersion: API_VERSION,
    message: messageView(saved),
  });
}

async function reopenGuestFeedback(
  request: Request,
  submissionId: string,
  context: FeedbackContext,
): Promise<Response> {
  const tokenHash = await receiptTokenHash(request);
  if (!tokenHash)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  const current = await loadFeedbackForReceipt(
    context.env.DB,
    submissionId,
    tokenHash,
  );
  if (!current)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);

  const body = await jsonBody<FeedbackMessageBody>(request);
  const message = normalizedMessage(body?.message);
  const clientKey = parseIdempotencyKey(request);
  if (!message || !clientKey)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide the additional information and an Idempotency-Key to reopen this receipt.",
      400,
    );
  const database = context.env.DB;
  const idempotencyKey = scopedIdempotencyKey(
    `feedback:resident-reopen:${submissionId}`,
    null,
    clientKey,
  );
  const requestHash = await sha256Hex(
    JSON.stringify({ submissionId, tokenHash, message }),
  );
  const replay = await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  );
  if (replay) {
    const receipt = await getReceiptByToken(database, submissionId, tokenHash);
    if (!receipt)
      return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
    return featureJson(context, {
      apiVersion: API_VERSION,
      submission: receipt,
    });
  }

  if (!canResidentReopenFeedback(current.status))
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "Only an outcome or closed receipt can be reopened by its resident.",
      409,
    );

  const limited = await enforceGuestAbuseLimit(request, context, "reopen");
  if (limited) return limited;
  const nextStatus: FeedbackStatus = "reopened";
  if (!canTransitionFeedback(current.status, nextStatus))
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "This feedback cannot be reopened.",
      409,
    );
  const now = new Date().toISOString();
  const messageId = await stableId("fbm", `${idempotencyKey}:message`);
  const statusAuditId = await stableId("audit", `${idempotencyKey}:status`);
  const messageAuditId = await stableId("audit", `${idempotencyKey}:message`);
  const statusEventKey = `feedback.status_changed:${idempotencyKey}`;
  const messageEventKey = `feedback.message_added:${idempotencyKey}`;
  await database.batch([
    database
      .prepare(
        `UPDATE feedback_submissions SET status = 'reopened', updated_at = ?
         WHERE id = ? AND receipt_token_hash = ? AND status = ?`,
      )
      .bind(now, submissionId, tokenHash, current.status),
    insertAudit(database, {
      id: statusAuditId,
      subject: "guest",
      organizationId: current.organization_id,
      action: "feedback_reopened_by_resident",
      entityId: submissionId,
      details: { previousStatus: current.status, status: nextStatus },
      createdAt: now,
      onlyIfPreviousChange: true,
    }),
    outboxStatement(database, {
      eventId: await stableId("evt", statusEventKey),
      eventType: "feedback.status_changed",
      occurredAt: now,
      actorKind: "guest",
      actorSubject: null,
      organizationId: current.organization_id,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: statusEventKey,
      payload: { previousStatus: current.status, status: nextStatus },
    }),
    insertMessage(database, {
      id: messageId,
      submissionId,
      authorKind: "resident",
      authorSubject: null,
      body: message,
      createdAt: now,
      receiptHash: tokenHash,
    }),
    insertAudit(database, {
      id: messageAuditId,
      subject: "guest",
      organizationId: current.organization_id,
      action: "feedback_message_added",
      entityId: submissionId,
      details: {
        author: "resident",
        messageLength: message.length,
        reopened: true,
      },
      createdAt: now,
      onlyIfPreviousChange: true,
    }),
    outboxStatement(database, {
      eventId: await stableId("evt", messageEventKey),
      eventType: "feedback.message_added",
      occurredAt: now,
      actorKind: "guest",
      actorSubject: null,
      organizationId: current.organization_id,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: messageEventKey,
      payload: { author: "resident", messageLength: message.length },
    }),
    idempotencyStatement(database, {
      key: idempotencyKey,
      requestHash,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      response: { submissionId, status: nextStatus, messageId },
      createdAt: now,
    }),
  ]);

  const saved = await findIdempotentResponse(
    database,
    idempotencyKey,
    requestHash,
  );
  if (!saved)
    return featureError(
      context,
      "INVALID_STATE_TRANSITION",
      "This feedback changed before it could be reopened.",
      409,
    );
  const receipt = await getReceiptByToken(database, submissionId, tokenHash);
  if (!receipt)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  return featureJson(context, { apiVersion: API_VERSION, submission: receipt });
}

async function getGuestEvidence(
  request: Request,
  submissionId: string,
  assetId: string,
  context: FeedbackContext,
): Promise<Response> {
  const tokenHash = await receiptTokenHash(request);
  if (!tokenHash)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  const feedback = await loadFeedbackForReceipt(
    context.env.DB,
    submissionId,
    tokenHash,
  );
  if (!feedback || !feedback.organization_id)
    return featureError(context, "NOT_FOUND", "Receipt not found.", 404);
  const response = await downloadEvidence(context, {
    submissionId,
    assetId,
    organizationId: feedback.organization_id,
    tokenHash,
  });
  return (
    response ?? featureError(context, "NOT_FOUND", "Evidence not found.", 404)
  );
}

async function getReceiptByToken(
  database: D1Database,
  submissionId: string,
  tokenHash: string,
) {
  const feedback = await loadFeedbackForReceipt(
    database,
    submissionId,
    tokenHash,
  );
  if (!feedback) return null;
  const messages = await loadMessages(database, submissionId);
  const evidence = await listEvidence(database, submissionId);
  return guestReceiptView(feedback, messages, evidence.map(evidenceView));
}

function guestReceiptView(
  feedback: FeedbackRow,
  messages: Array<{
    id: string;
    author_kind: "resident" | "staff";
    body: string;
    created_at: string;
  }>,
  evidence: EvidenceMetadata[],
) {
  return {
    id: feedback.id,
    originalText: feedback.original_text ?? "",
    constructiveFollowUp: feedback.constructive_follow_up ?? null,
    category: feedback.category ?? "other_or_unsure",
    intent: feedback.intent ?? null,
    classificationReviewStatus: feedback.classification_review_status ?? null,
    municipality: feedback.municipality_csd_uid
      ? {
          id: feedback.municipality_csd_uid,
          name: feedback.municipality_name ?? "Toronto",
          province: feedback.province_name ?? "Ontario",
        }
      : null,
    sample: feedback.sample === 1,
    destinationLabel: feedback.department_name,
    status: feedback.status,
    departmentName: feedback.department_name,
    messages: messages.map(messageView),
    evidence: evidence.map((item) => ({
      ...item,
      downloadPath: `/api/v1/feedback/receipts/${feedback.id}/attachments/${item.id}`,
    })),
    outcome: feedback.outcome,
    createdAt: feedback.created_at,
    updatedAt: feedback.updated_at,
  };
}

async function resolveDestination(
  database: D1Database,
  municipalityCsdUid: string,
): Promise<DestinationRow | null> {
  return database
    .prepare(
      `SELECT d.organization_id, d.routing_label, d.sample,
        m.csd_uid AS municipality_csd_uid, m.name AS municipality_name,
        m.province_name
       FROM feedback_destinations AS d
       JOIN municipality_geographies AS m ON m.csd_uid = d.municipality_csd_uid
       JOIN organizations AS o ON o.id = d.organization_id
       WHERE d.municipality_csd_uid = ? AND d.sample = 1 AND o.sample = 1`,
    )
    .bind(municipalityCsdUid)
    .first<DestinationRow>();
}

function emergencyRedirect(
  context: FeedbackContext,
  locale: "en" | "fr",
): Response {
  return featureJson(
    context,
    {
      apiVersion: API_VERSION,
      accepted: false,
      emergencyRedirect: {
        number: "911",
        message:
          locale === "fr"
            ? "Si une personne est en danger immédiat, appelez le 911 maintenant. Ce service de commentaires n’est pas surveillé pour les urgences et n’envoie pas d’intervenants. Aucun signalement n’a été transmis."
            : "If anyone is in immediate danger, call 911 now. This feedback service is not monitored for emergencies and does not dispatch responders. Nothing was submitted.",
      },
    },
    422,
  );
}
