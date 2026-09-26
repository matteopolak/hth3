import { API_VERSION } from "@civicresolve/contracts/v1";
import {
  validateClassificationProposal,
  validateTaxonomyDocument,
  type TaxonomyDocument,
  type TaxonomyIntent,
} from "@civicresolve/domain/taxonomy";
import {
  canPerformGlobalAction,
  canPerformOrganizationAction,
  type AuthorizationActor,
} from "@civicresolve/domain/permissions";
import { authenticateRequest } from "../../auth/identity.js";
import {
  featureError,
  featureJson,
  outboxStatement,
  type FeatureContext,
} from "../shared.js";
import { classifyText, type TaxonomyAI } from "./classification.js";
import {
  isActiveOrganizationMember,
  loadDepartments,
  loadVersion,
  organizationExists,
  versionView,
} from "./store.js";

const TAXONOMY_PATH =
  /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/taxonomy(?:\/(draft|preview|publish))?$/;
const TAXONOMY_VERSIONS_PATH =
  /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/taxonomy\/versions(?:\/(taxv_[A-Za-z0-9_-]+))?$/;
const CLASSIFICATION_PATH =
  /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/feedback\/(fb_[a-f0-9]{32})\/classification$/;

interface DraftBody {
  document?: unknown;
}
interface PreviewBody {
  text?: unknown;
}
interface CorrectionBody {
  categoryId?: unknown;
  intent?: unknown;
  reason?: unknown;
}

export async function handleTaxonomyRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  const taxonomyMatch = url.pathname.match(TAXONOMY_PATH);
  const versionsMatch = url.pathname.match(TAXONOMY_VERSIONS_PATH);
  const correctionMatch = url.pathname.match(CLASSIFICATION_PATH);
  if (!taxonomyMatch && !versionsMatch && !correctionMatch) return null;
  const organizationId = (taxonomyMatch ??
    versionsMatch ??
    correctionMatch)![1]!;
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "A valid access token is required.",
      401,
    );
  const canManage = await canManageTaxonomy(context, actor, organizationId);
  const canReview = await canReviewFeedback(context, actor, organizationId);
  if (versionsMatch) {
    if (!canManage && !canReview)
      return featureError(
        context,
        "FORBIDDEN",
        "Taxonomy access is required.",
        403,
      );
    if (request.method !== "GET")
      return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);
    return getVersions(context, organizationId, versionsMatch[2], canManage);
  }
  if (correctionMatch) {
    if (!canReview)
      return featureError(
        context,
        "FORBIDDEN",
        "Feedback review access is required.",
        403,
      );
    if (request.method === "GET")
      return getClassification(context, organizationId, correctionMatch[2]!);
    if (request.method === "POST")
      return correctClassification(
        request,
        context,
        actor,
        organizationId,
        correctionMatch[2]!,
      );
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET or POST.", 405);
  }
  const action = taxonomyMatch![2];
  if (!canManage && !(request.method === "GET" && !action && canReview))
    return featureError(
      context,
      "FORBIDDEN",
      "Taxonomy access is required.",
      403,
    );
  if (!(await organizationExists(context.env.DB, organizationId)))
    return featureError(context, "NOT_FOUND", "Organization not found.", 404);
  if (!action && request.method === "GET")
    return getTaxonomy(context, organizationId, canManage);
  if (action === "draft" && request.method === "POST")
    return createDraft(context, actor, organizationId);
  if (action === "draft" && request.method === "PATCH")
    return editDraft(request, context, actor, organizationId);
  if (action === "preview" && request.method === "POST")
    return previewDraft(request, context, organizationId);
  if (action === "publish" && request.method === "POST")
    return publishDraft(context, actor, organizationId);
  return featureError(
    context,
    "METHOD_NOT_ALLOWED",
    "Unsupported taxonomy action.",
    405,
  );
}

async function getVersions(
  context: FeatureContext,
  organizationId: string,
  versionId: string | undefined,
  canManage: boolean,
) {
  if (versionId) {
    const row = await context.env.DB.prepare(
      `SELECT * FROM taxonomy_versions
      WHERE id = ? AND organization_id = ? AND (status != 'draft' OR ? = 1)`,
    )
      .bind(versionId, organizationId, canManage ? 1 : 0)
      .first<import("./store.js").TaxonomyVersionRow>();
    if (!row)
      return featureError(
        context,
        "NOT_FOUND",
        "Taxonomy version not found.",
        404,
      );
    return featureJson(context, {
      apiVersion: API_VERSION,
      version: versionView(row),
      requestId: context.requestId,
    });
  }
  const result = await context.env.DB.prepare(
    `SELECT id, version, status, created_at, published_at
    FROM taxonomy_versions WHERE organization_id = ? AND (status != 'draft' OR ? = 1)
    ORDER BY version DESC LIMIT 50`,
  )
    .bind(organizationId, canManage ? 1 : 0)
    .all<{
      id: string;
      version: number;
      status: string;
      created_at: string;
      published_at: string | null;
    }>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    versions: (result.results ?? []).map((row) => ({
      id: row.id,
      version: row.version,
      status: row.status,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    })),
    requestId: context.requestId,
  });
}

async function canManageTaxonomy(
  context: FeatureContext,
  actor: AuthorizationActor,
  organizationId: string,
) {
  if (canPerformGlobalAction(actor, "taxonomy:manage")) return true;
  return (
    canPerformOrganizationAction(
      actor,
      "organization:manage_own",
      organizationId,
    ) &&
    isActiveOrganizationMember(context.env.DB, actor.subject, organizationId, [
      "organization_admin",
    ])
  );
}

async function canReviewFeedback(
  context: FeatureContext,
  actor: AuthorizationActor,
  organizationId: string,
) {
  return (
    canPerformOrganizationAction(
      actor,
      "feedback:read_organization",
      organizationId,
    ) &&
    isActiveOrganizationMember(context.env.DB, actor.subject, organizationId, [
      "civic_staff",
      "organization_admin",
    ])
  );
}

async function getTaxonomy(
  context: FeatureContext,
  organizationId: string,
  includeDraft: boolean,
) {
  const [published, draft, departments] = await Promise.all([
    loadVersion(context.env.DB, organizationId, "published"),
    includeDraft
      ? loadVersion(context.env.DB, organizationId, "draft")
      : Promise.resolve(null),
    loadDepartments(context.env.DB, organizationId),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    published: versionView(published),
    draft: versionView(draft),
    departments,
    requestId: context.requestId,
  });
}

async function createDraft(
  context: FeatureContext,
  actor: AuthorizationActor,
  organizationId: string,
) {
  const existing = await loadVersion(context.env.DB, organizationId, "draft");
  if (existing)
    return featureJson(context, {
      apiVersion: API_VERSION,
      draft: versionView(existing),
      requestId: context.requestId,
    });
  const current = await loadVersion(
    context.env.DB,
    organizationId,
    "published",
  );
  if (!current)
    return featureError(
      context,
      "NO_PUBLISHED_TAXONOMY",
      "A published taxonomy is required.",
      409,
    );
  const row = await context.env.DB.prepare(
    `SELECT COALESCE(MAX(version), 0) AS version FROM taxonomy_versions WHERE organization_id = ?`,
  )
    .bind(organizationId)
    .first<{ version: number }>();
  const next = (row?.version ?? 0) + 1;
  const id = `taxv_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO taxonomy_versions (id, organization_id, version, status,
    document_json, created_by, created_at) VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
  )
    .bind(id, organizationId, next, current.document_json, actor.subject, now)
    .run();
  return featureJson(
    context,
    {
      apiVersion: API_VERSION,
      draft: {
        id,
        version: next,
        status: "draft",
        document: JSON.parse(current.document_json),
        createdAt: now,
        publishedAt: null,
      },
      requestId: context.requestId,
    },
    201,
  );
}

async function editDraft(
  request: Request,
  context: FeatureContext,
  actor: AuthorizationActor,
  organizationId: string,
) {
  const draft = await loadVersion(context.env.DB, organizationId, "draft");
  if (!draft)
    return featureError(context, "NO_DRAFT", "Create a draft first.", 404);
  const body = await boundedJson<DraftBody>(request);
  if (!body)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a bounded JSON document.",
      400,
    );
  const departments = await loadDepartments(context.env.DB, organizationId);
  const destinations = new Map(
    departments
      .filter((row) => row.active === 1)
      .map((row) => [row.id, row.jurisdiction_level] as const),
  );
  const checked = validateTaxonomyDocument(body.document, destinations);
  if (!checked.valid)
    return featureError(context, "INVALID_TAXONOMY", checked.reason, 422);
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE taxonomy_versions SET document_json = ? WHERE id = ? AND status = 'draft'`,
    ).bind(JSON.stringify(checked.document), draft.id),
    audit(
      context,
      actor.subject,
      organizationId,
      "taxonomy_draft_edited",
      draft.id,
      {
        version: draft.version,
        categoryCount: checked.document.categories.length,
      },
      now,
    ),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    draft: { ...versionView(draft), document: checked.document },
    requestId: context.requestId,
  });
}

async function previewDraft(
  request: Request,
  context: FeatureContext,
  organizationId: string,
) {
  const draft = await loadVersion(context.env.DB, organizationId, "draft");
  const published = await loadVersion(
    context.env.DB,
    organizationId,
    "published",
  );
  if (!draft || !published)
    return featureError(context, "NO_DRAFT", "Create a draft first.", 404);
  const body = await boundedJson<PreviewBody>(request);
  if (
    !body ||
    typeof body.text !== "string" ||
    !body.text.trim() ||
    body.text.length > 5000
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide text up to 5,000 characters.",
      400,
    );
  const currentDoc = JSON.parse(published.document_json) as TaxonomyDocument;
  const draftDoc = JSON.parse(draft.document_json) as TaxonomyDocument;
  const ai = (context.env as typeof context.env & { AI?: TaxonomyAI }).AI;
  const [current, proposed] = await Promise.all([
    classifyText(body.text, currentDoc, ai),
    classifyText(body.text, draftDoc, ai),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    current: { version: published.version, ...current },
    proposed: { version: draft.version, ...proposed },
    requestId: context.requestId,
  });
}

async function publishDraft(
  context: FeatureContext,
  actor: AuthorizationActor,
  organizationId: string,
) {
  const draft = await loadVersion(context.env.DB, organizationId, "draft");
  if (!draft)
    return featureError(context, "NO_DRAFT", "Create a draft first.", 404);
  const departments = await loadDepartments(context.env.DB, organizationId);
  const destinations = new Map(
    departments
      .filter((row) => row.active === 1)
      .map((row) => [row.id, row.jurisdiction_level] as const),
  );
  const checked = validateTaxonomyDocument(
    JSON.parse(draft.document_json) as unknown,
    destinations,
  );
  if (!checked.valid)
    return featureError(context, "INVALID_TAXONOMY", checked.reason, 422);
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE taxonomy_versions SET status = 'superseded'
      WHERE organization_id = ? AND status = 'published'`,
    ).bind(organizationId),
    context.env.DB.prepare(
      `UPDATE taxonomy_versions SET status = 'published', published_by = ?, published_at = ?
      WHERE id = ? AND status = 'draft'`,
    ).bind(actor.subject, now, draft.id),
    audit(
      context,
      actor.subject,
      organizationId,
      "taxonomy_published",
      draft.id,
      {
        version: draft.version,
        categoryCount: checked.document.categories.length,
      },
      now,
    ),
    outboxStatement(context.env.DB, {
      eventId,
      eventType: "taxonomy.published",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "taxonomy_version",
      aggregateId: draft.id,
      idempotencyKey: `taxonomy.published:${draft.id}`,
      payload: {
        version: draft.version,
        categoryCount: checked.document.categories.length,
      },
    }),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    published: { ...versionView(draft), status: "published", publishedAt: now },
    requestId: context.requestId,
  });
}

async function getClassification(
  context: FeatureContext,
  organizationId: string,
  submissionId: string,
) {
  const row = await context.env.DB.prepare(
    `SELECT c.id, c.intent, c.category_id, c.confidence,
    c.alternatives_json, c.provider, c.model_id, c.review_outcome, c.review_reason,
    c.created_at, v.version, a.department_id
    FROM feedback_classifications AS c
    JOIN taxonomy_versions AS v ON v.id = c.taxonomy_version_id
    LEFT JOIN feedback_assignments AS a ON a.classification_id = c.id
    WHERE c.organization_id = ? AND c.submission_id = ? AND c.current = 1`,
  )
    .bind(organizationId, submissionId)
    .first<Record<string, unknown>>();
  if (!row)
    return featureError(context, "NOT_FOUND", "Classification not found.", 404);
  return featureJson(context, {
    apiVersion: API_VERSION,
    classification: {
      id: row.id,
      intent: row.intent,
      categoryId: row.category_id,
      confidence: row.confidence,
      alternatives: JSON.parse(row.alternatives_json as string),
      provider: row.provider,
      modelId: row.model_id,
      reviewOutcome: row.review_outcome,
      reviewReason: row.review_reason,
      taxonomyVersion: row.version,
      departmentId: row.department_id,
      createdAt: row.created_at,
    },
    requestId: context.requestId,
  });
}

async function correctClassification(
  request: Request,
  context: FeatureContext,
  actor: AuthorizationActor,
  organizationId: string,
  submissionId: string,
) {
  if (
    !canPerformOrganizationAction(
      actor,
      "feedback:respond_organization",
      organizationId,
    )
  )
    return featureError(
      context,
      "FORBIDDEN",
      "Feedback response access is required.",
      403,
    );
  const submission = await context.env.DB.prepare(
    `SELECT id FROM feedback_submissions WHERE id = ? AND organization_id = ?`,
  )
    .bind(submissionId, organizationId)
    .first();
  if (!submission)
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  const body = await boundedJson<CorrectionBody>(request);
  if (
    !body ||
    typeof body.categoryId !== "string" ||
    !["complaint", "suggestion", "question", "positive"].includes(
      body.intent as string,
    ) ||
    typeof body.reason !== "string" ||
    body.reason.trim().length < 5 ||
    body.reason.length > 500
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide categoryId, intent, and a reason of 5–500 characters.",
      400,
    );
  const version = await loadVersion(
    context.env.DB,
    organizationId,
    "published",
  );
  if (!version)
    return featureError(
      context,
      "NO_PUBLISHED_TAXONOMY",
      "No published taxonomy is available.",
      409,
    );
  const document = JSON.parse(version.document_json) as TaxonomyDocument;
  const checked = validateClassificationProposal(
    {
      intent: body.intent,
      categoryId: body.categoryId,
      confidence: 1,
      alternatives: [],
    },
    document,
  );
  if (checked.reason === "unknown_category")
    return featureError(
      context,
      "INVALID_CATEGORY",
      "Choose an active published category.",
      422,
    );
  const category = document.categories.find(
    (item) => item.id === body.categoryId,
  )!;
  const now = new Date().toISOString();
  const id = `fc_${crypto.randomUUID().replaceAll("-", "")}`;
  const eventId = crypto.randomUUID();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE feedback_classifications SET current = 0 WHERE submission_id = ? AND current = 1`,
    ).bind(submissionId),
    context.env.DB.prepare(
      `INSERT INTO feedback_classifications (
      id, submission_id, organization_id, taxonomy_version_id, intent, category_id,
      confidence, alternatives_json, provider, model_id, review_outcome, review_reason,
      actor_subject, current, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, '[]', 'staff', NULL, 'corrected', ?, ?, 1, ?)`,
    ).bind(
      id,
      submissionId,
      organizationId,
      version.id,
      body.intent as TaxonomyIntent,
      category.id,
      body.reason.trim(),
      actor.subject,
      now,
    ),
    context.env.DB.prepare(
      `UPDATE feedback_submissions SET taxonomy_version_id = ?, category_id = ?,
      intent = ?, classification_review_status = 'corrected', updated_at = ? WHERE id = ? AND organization_id = ?`,
    ).bind(
      version.id,
      category.id,
      body.intent as TaxonomyIntent,
      now,
      submissionId,
      organizationId,
    ),
    context.env.DB.prepare(
      `INSERT INTO feedback_assignments (
      submission_id, organization_id, classification_id, department_id, updated_at
    ) VALUES (?, ?, ?, ?, ?) ON CONFLICT(submission_id) DO UPDATE SET
      classification_id = excluded.classification_id, department_id = excluded.department_id,
      updated_at = excluded.updated_at`,
    ).bind(
      submissionId,
      organizationId,
      id,
      category.destinationDepartmentId,
      now,
    ),
    audit(
      context,
      actor.subject,
      organizationId,
      "feedback_recategorized",
      submissionId,
      {
        classificationId: id,
        taxonomyVersion: version.version,
        categoryId: category.id,
        intent: body.intent,
        reason: body.reason.trim(),
      },
      now,
    ),
    outboxStatement(context.env.DB, {
      eventId,
      eventType: "feedback.classification_corrected",
      occurredAt: now,
      actorKind: "staff",
      actorSubject: actor.subject,
      organizationId,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: `feedback.classification_corrected:${id}`,
      payload: {
        classificationId: id,
        categoryId: category.id,
        intent: body.intent,
        taxonomyVersion: version.version,
      },
    }),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    classificationId: id,
    categoryId: category.id,
    taxonomyVersion: version.version,
    requestId: context.requestId,
  });
}

function audit(
  context: FeatureContext,
  subject: string,
  organizationId: string,
  action: string,
  entityId: string,
  details: unknown,
  at: string,
) {
  return context.env.DB.prepare(
    `INSERT INTO audit_events (
    id, actor_subject, organization_id, action, entity_type, entity_id, details_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    `audit_${crypto.randomUUID().replaceAll("-", "")}`,
    subject,
    organizationId,
    action,
    action.startsWith("taxonomy") ? "taxonomy_version" : "feedback_submission",
    entityId,
    JSON.stringify(details),
    at,
  );
}

async function boundedJson<T>(request: Request): Promise<T | null> {
  const size = Number(request.headers.get("Content-Length") ?? 0);
  if (size > 100_000) return null;
  try {
    const body = await request.text();
    if (body.length > 100_000) return null;
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}
