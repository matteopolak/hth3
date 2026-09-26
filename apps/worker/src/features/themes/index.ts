import { API_VERSION } from "@civicresolve/contracts/v1";
import { canPerformOrganizationAction } from "@civicresolve/domain/permissions";
import {
  canDescribeThemeSources,
  isSensitiveThemeCategory,
  proposeThemeMembershipReviews,
  type ThemeMembershipSuggestion,
} from "@civicresolve/domain/themes";
import { authenticateRequest } from "../../auth/identity.js";
import {
  embedThemeSources,
  redactThemeText,
  summarizeGroundedTheme,
  type ThemeAiBinding,
} from "../../integrations/workers-ai/grounded-themes.js";
import {
  findThemeCandidates,
  type ThemeVectorIndex,
} from "../../integrations/vectorize/themes.js";
import {
  featureError,
  featureJson,
  outboxStatement,
  stableId,
  type FeatureContext,
} from "../shared.js";

const THEMES_PATH =
  /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/themes(?:\/(refresh|candidates|theme_[a-f0-9]{32})(?:\/(memberships))?)?$/;

interface GroundedEnvironment {
  AI?: ThemeAiBinding;
  THEME_VECTORS?: ThemeVectorIndex;
  THEME_AI_ENABLED?: string;
  THEME_AI_NO_CHARGE_CONFIRMED?: string;
}

type GroundingStatus =
  | "disabled"
  | "capacity_limit"
  | "provider_unavailable"
  | "grounded";

interface SubmissionRow {
  id: string;
  category_id: string;
  original_text: string;
  constructive_follow_up: string | null;
  status: string;
  intent: string | null;
  sample: number;
  created_at: string;
}

interface ThemeRow {
  id: string;
  category_id: string;
  topic_key: string;
  title_en: string;
  title_fr: string;
  summary_en: string;
  summary_fr: string;
  summary_source_ids_json: string;
  summary_source_count: number;
  summary_generated_at: string | null;
  summary_method: string;
  updated_at: string;
  count: number;
  previous_count: number;
  real_count: number;
  latest_source_updated_at: string | null;
}

interface CountRow {
  key: string;
  count: number;
}

interface TotalRow {
  total: number;
  unanswered: number;
}

interface CategoryNames {
  [categoryId: string]: { en: string; fr: string };
}

export async function handleThemesRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  const match = url.pathname.match(THEMES_PATH);
  if (!match) return null;
  const organizationId = match[1]!;
  const action = match[2];
  const subAction = match[3];
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to view themes.",
      401,
    );
  const permission =
    request.method === "POST"
      ? "feedback:respond_organization"
      : "feedback:read_organization";
  if (!canPerformOrganizationAction(actor, permission, organizationId))
    return featureError(
      context,
      "FORBIDDEN",
      "This organization is unavailable.",
      403,
    );

  if (request.method === "GET" && !action)
    return listThemes(url, organizationId, context);
  if (request.method === "GET" && action?.startsWith("theme_") && !subAction)
    return getTheme(url, organizationId, action, context);
  if (request.method === "POST" && action === "candidates")
    return listThemeCandidates(organizationId, context);
  if (
    request.method === "POST" &&
    action?.startsWith("theme_") &&
    subAction === "memberships"
  )
    return reviewThemeMembership(
      request,
      organizationId,
      action,
      actor.subject,
      context,
    );
  if (request.method === "POST" && action === "refresh") {
    const result = await refreshThemesForOrganization(organizationId, context);
    return featureJson(context, { apiVersion: API_VERSION, ...result });
  }
  return featureError(
    context,
    "METHOD_NOT_ALLOWED",
    "Unsupported themes action.",
    405,
  );
}

async function listThemes(
  url: URL,
  organizationId: string,
  context: FeatureContext,
): Promise<Response> {
  await ensureThemesCurrent(organizationId, context);
  const days = parseDays(url.searchParams.get("days"));
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const previousSince = new Date(
    now.getTime() - 2 * days * 86_400_000,
  ).toISOString();
  const category = safeFilter(url.searchParams.get("category"));
  const department = safeFilter(url.searchParams.get("department"));
  const status = safeFilter(url.searchParams.get("status"));
  const filters = filterClause(category, department, status);
  const params = [organizationId, since, ...filters.values];
  const database = context.env.DB;
  const [
    totals,
    previousTotals,
    categories,
    intents,
    statuses,
    daily,
    themes,
    analytics,
  ] = await Promise.all([
    database
      .prepare(
        `SELECT COUNT(*) AS total,
        SUM(CASE WHEN f.status NOT IN ('outcome_recorded', 'closed')
          AND NOT EXISTS (
            SELECT 1 FROM feedback_messages AS m
            WHERE m.submission_id = f.id AND m.author_kind = 'staff'
          ) THEN 1 ELSE 0 END) AS unanswered
       FROM feedback_submissions AS f
       LEFT JOIN feedback_assignments AS a ON a.submission_id = f.id
       WHERE f.organization_id = ? AND f.created_at >= ? ${filters.sql}`,
      )
      .bind(...params)
      .first<TotalRow>(),
    database
      .prepare(
        `SELECT COUNT(*) AS total FROM feedback_submissions AS f
       LEFT JOIN feedback_assignments AS a ON a.submission_id = f.id
       WHERE f.organization_id = ? AND f.created_at >= ? AND f.created_at < ? ${filters.sql}`,
      )
      .bind(organizationId, previousSince, since, ...filters.values)
      .first<{ total: number }>(),
    groupedCount(
      database,
      "COALESCE(f.category_id, f.category)",
      params,
      filters.sql,
    ),
    groupedCount(
      database,
      "COALESCE(f.intent, 'unclassified')",
      params,
      filters.sql,
    ),
    groupedCount(database, "f.status", params, filters.sql),
    database
      .prepare(
        `SELECT substr(f.created_at, 1, 10) AS day, COUNT(*) AS count
       FROM feedback_submissions AS f
       LEFT JOIN feedback_assignments AS a ON a.submission_id = f.id
       WHERE f.organization_id = ? AND f.created_at >= ? ${filters.sql}
       GROUP BY day ORDER BY day`,
      )
      .bind(...params)
      .all<{ day: string; count: number }>(),
    database
      .prepare(
        `SELECT t.*,
        COUNT(CASE WHEN f.created_at >= ? AND f.created_at < ? THEN 1 END) AS count,
        COUNT(CASE WHEN f.created_at >= ? AND f.created_at < ? THEN 1 END) AS previous_count,
        SUM(CASE WHEN f.sample = 0 THEN 1 ELSE 0 END) AS real_count,
        MAX(f.updated_at) AS latest_source_updated_at
       FROM feedback_themes AS t
       LEFT JOIN feedback_theme_memberships AS m ON m.theme_id = t.id
       LEFT JOIN feedback_submissions AS f ON f.id = m.submission_id
       LEFT JOIN feedback_assignments AS a ON a.submission_id = f.id
       WHERE t.organization_id = ?
         AND (? IS NULL OR t.category_id = ?)
         AND (? IS NULL OR a.department_id = ?)
         AND (? IS NULL OR f.status = ?)
       GROUP BY t.id HAVING count > 0 OR previous_count > 0
       ORDER BY count DESC, previous_count DESC, t.title_en ASC`,
      )
      .bind(
        since,
        now.toISOString(),
        previousSince,
        since,
        organizationId,
        category,
        category,
        department,
        department,
        status,
        status,
      )
      .all<ThemeRow>(),
    database
      .prepare(
        `SELECT MAX(CASE WHEN delivered_at IS NOT NULL THEN occurred_at END) AS analytics_as_of,
          SUM(CASE WHEN delivered_at IS NULL THEN 1 ELSE 0 END) AS pending_events
         FROM outbox_events WHERE organization_id = ? AND event_type LIKE 'feedback.%'`,
      )
      .bind(organizationId)
      .first<{
        analytics_as_of: string | null;
        pending_events: number | null;
      }>(),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    metric: "submissions",
    windowDays: days,
    generatedAt: now.toISOString(),
    analyticsAsOf: analytics?.analytics_as_of ?? null,
    analyticsPendingEvents: analytics?.pending_events ?? 0,
    filters: { category, department, status },
    totalSubmissions: totals?.total ?? 0,
    previousTotalSubmissions: previousTotals?.total ?? 0,
    unansweredSubmissions: totals?.unanswered ?? 0,
    categories: categories.results ?? [],
    intents: intents.results ?? [],
    statuses: statuses.results ?? [],
    daily: daily.results ?? [],
    themes: (themes.results ?? []).map((row) => themeView(row, organizationId)),
  });
}

async function getTheme(
  url: URL,
  organizationId: string,
  themeId: string,
  context: FeatureContext,
): Promise<Response> {
  await ensureThemesCurrent(organizationId, context);
  const theme = await context.env.DB.prepare(
    `SELECT * FROM feedback_themes WHERE id = ? AND organization_id = ?`,
  )
    .bind(themeId, organizationId)
    .first<ThemeRow>();
  if (!theme)
    return featureError(context, "NOT_FOUND", "Theme not found.", 404);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit")) || 50),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const [total, sources] = await Promise.all([
    context.env.DB.prepare(
      `SELECT COUNT(*) AS count,
        SUM(CASE WHEN f.sample = 0 THEN 1 ELSE 0 END) AS real_count,
        MAX(f.updated_at) AS latest_source_updated_at
       FROM feedback_theme_memberships AS m
       JOIN feedback_submissions AS f ON f.id = m.submission_id
       WHERE m.theme_id = ? AND m.organization_id = ? AND f.organization_id = ?`,
    )
      .bind(themeId, organizationId, organizationId)
      .first<{
        count: number;
        real_count: number;
        latest_source_updated_at: string | null;
      }>(),
    context.env.DB.prepare(
      `SELECT f.id, f.status, f.intent, f.sample, f.created_at,
        COALESCE(f.category_id, f.category) AS category_id,
        f.original_text, f.constructive_follow_up
       FROM feedback_theme_memberships AS m
       JOIN feedback_submissions AS f ON f.id = m.submission_id
       WHERE m.theme_id = ? AND m.organization_id = ? AND f.organization_id = ?
       ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(themeId, organizationId, organizationId, limit, offset)
      .all<SubmissionRow>(),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    theme: themeView(
      {
        ...theme,
        count: total?.count ?? 0,
        previous_count: 0,
        real_count: total?.real_count ?? 0,
        latest_source_updated_at: total?.latest_source_updated_at ?? null,
      },
      organizationId,
    ),
    totalSubmissions: total?.count ?? 0,
    offset,
    sources: (sources.results ?? []).map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      intent: row.intent,
      status: row.status,
      sample: row.sample === 1,
      createdAt: row.created_at,
      originalText: row.original_text,
      constructiveFollowUp: row.constructive_follow_up,
      href: `/api/v1/staff/organizations/${organizationId}/feedback/${row.id}`,
    })),
  });
}

export async function refreshThemesForOrganization(
  organizationId: string,
  context: FeatureContext,
): Promise<{
  refreshedAt: string;
  themes: number;
  membershipsAdded: number;
  membershipsMoved: number;
  grounding: {
    status: GroundingStatus;
    manualReview: true;
    candidateSuggestions: ThemeMembershipSuggestion[];
  };
}> {
  const database = context.env.DB;
  const now = new Date().toISOString();
  const names = await categoryNames(database, organizationId);
  const submissions = await loadOrganizationSubmissions(
    organizationId,
    context,
  );
  const groups = groupSubmissions(submissions);
  const existing = await database
    .prepare(
      `SELECT m.submission_id, m.theme_id, m.source, t.category_id AS theme_category_id
       FROM feedback_theme_memberships AS m
       JOIN feedback_themes AS t ON t.id = m.theme_id
       WHERE m.organization_id = ?`,
    )
    .bind(organizationId)
    .all<{
      submission_id: string;
      theme_id: string;
      source: string;
      theme_category_id: string;
    }>();
  const memberships = new Map(
    (existing.results ?? []).map((row) => [row.submission_id, row]),
  );
  let added = 0;
  let moved = 0;
  const reviewedSummaryIds = new Set<string>();
  for (const [groupKey, submissions] of groups) {
    const [categoryId, topicKey] = groupKey.split(":", 2) as [string, string];
    const themeId = await stableId("theme", `${organizationId}:${groupKey}`);
    const categoryName = names[categoryId] ?? {
      en: humanize(categoryId),
      fr: humanize(categoryId),
    };
    const title =
      topicKey === "general"
        ? categoryName
        : topicKey.startsWith("semantic_")
          ? {
              en: `${commonTerms(submissions)[0] ? humanize(commonTerms(submissions)[0]!) : "Shared concern"} · ${categoryName.en}`,
              fr: `${categoryName.fr} · préoccupation commune`,
            }
          : {
              en: `${humanize(topicKey)} · ${categoryName.en}`,
              fr: `${categoryName.fr} · ${topicKey}`,
            };
    let sourceIds = canDescribeThemeSources(categoryId, submissions.length)
      ? submissions.slice(0, 5).map((row) => row.id)
      : [];
    let summary = summarize(title, submissions, categoryId);
    let summaryMethod = "deterministic";
    if (
      aiEnabled(context) &&
      canDescribeThemeSources(categoryId, submissions.length)
    ) {
      try {
        const result = await summarizeGroundedTheme(
          context.env.AI!,
          submissions.slice(0, 5).map((row) => ({
            id: row.id,
            originalText: row.original_text,
            constructiveFollowUp: row.constructive_follow_up,
          })),
        );
        summary = { en: result.en, fr: result.fr };
        sourceIds = result.sourceIds;
        summaryMethod = "workers_ai_grounded";
      } catch {
        summaryMethod = "deterministic";
      }
    }
    await database
      .prepare(
        `INSERT INTO feedback_themes (
        id, organization_id, category_id, topic_key, title_en, title_fr, summary_en, summary_fr,
        summary_source_ids_json, summary_source_count, summary_generated_at,
        summary_method, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, category_id, topic_key) DO UPDATE SET
        title_en = excluded.title_en, title_fr = excluded.title_fr,
        summary_en = excluded.summary_en, summary_fr = excluded.summary_fr,
        summary_source_ids_json = excluded.summary_source_ids_json,
        summary_source_count = excluded.summary_source_count,
        summary_generated_at = excluded.summary_generated_at,
        summary_method = excluded.summary_method,
        updated_at = excluded.updated_at`,
      )
      .bind(
        themeId,
        organizationId,
        categoryId,
        topicKey,
        title.en,
        title.fr,
        summary.en,
        summary.fr,
        JSON.stringify(sourceIds),
        submissions.length,
        now,
        summaryMethod,
        now,
        now,
      )
      .run();
    for (const submission of submissions) {
      const previous = memberships.get(submission.id);
      if (
        previous?.source === "staff" &&
        previous.theme_category_id === submission.category_id
      ) {
        reviewedSummaryIds.add(previous.theme_id);
        if (previous.theme_id !== themeId) reviewedSummaryIds.add(themeId);
        continue;
      }
      const previousTheme = previous?.theme_id;
      if (previousTheme === themeId) continue;
      if (previousTheme) {
        await database
          .prepare(
            `UPDATE feedback_theme_memberships SET theme_id = ?, source = 'automatic', created_at = ?
           WHERE submission_id = ? AND organization_id = ?`,
          )
          .bind(themeId, now, submission.id, organizationId)
          .run();
        moved++;
      } else {
        await database
          .prepare(
            `INSERT INTO feedback_theme_memberships
           (submission_id, theme_id, organization_id, source, created_at)
           VALUES (?, ?, ?, 'automatic', ?)`,
          )
          .bind(submission.id, themeId, organizationId, now)
          .run();
        added++;
      }
      const eventType = previousTheme
        ? "feedback.theme_membership_moved"
        : "feedback.theme_membership_added";
      await outboxStatement(database, {
        eventId: crypto.randomUUID(),
        eventType,
        occurredAt: now,
        actorKind: "system",
        actorSubject: null,
        organizationId,
        aggregateType: "feedback_submission",
        aggregateId: submission.id,
        idempotencyKey: `${eventType}:${submission.id}:${themeId}:${now}`,
        payload: {
          themeId,
          previousThemeId: previousTheme ?? null,
          categoryId,
          topicKey,
        },
      }).run();
    }
  }
  const reviewedThemes = await database
    .prepare(
      `SELECT DISTINCT theme_id FROM feedback_theme_memberships
     WHERE organization_id = ? AND source = 'staff'`,
    )
    .bind(organizationId)
    .all<{ theme_id: string }>();
  for (const row of reviewedThemes.results ?? [])
    reviewedSummaryIds.add(row.theme_id);
  for (const themeId of reviewedSummaryIds)
    await refreshReviewedThemeSummary(database, organizationId, themeId, now);
  const candidates = await buildThemeCandidates(
    submissions,
    organizationId,
    context,
  );
  return {
    refreshedAt: now,
    themes: groups.size,
    membershipsAdded: added,
    membershipsMoved: moved,
    grounding: {
      status: candidates.status,
      manualReview: true,
      candidateSuggestions: candidates.suggestions,
    },
  };
}

async function loadOrganizationSubmissions(
  organizationId: string,
  context: FeatureContext,
): Promise<SubmissionRow[]> {
  const rows = await context.env.DB.prepare(
    `SELECT f.id, COALESCE(f.category_id, f.category) AS category_id,
      f.original_text, f.constructive_follow_up, f.status, f.intent, f.sample, f.created_at
     FROM feedback_submissions AS f WHERE f.organization_id = ? ORDER BY f.created_at DESC`,
  )
    .bind(organizationId)
    .all<SubmissionRow>();
  return rows.results ?? [];
}

async function listThemeCandidates(
  organizationId: string,
  context: FeatureContext,
): Promise<Response> {
  await ensureThemesCurrent(organizationId, context);
  const rows = await loadOrganizationSubmissions(organizationId, context);
  const result = await buildThemeCandidates(rows, organizationId, context);
  return featureJson(context, {
    apiVersion: API_VERSION,
    generatedAt: new Date().toISOString(),
    metric: "submissions",
    groundingStatus: result.status,
    reviewRequired: true,
    suggestions: result.suggestions,
  });
}

function aiEnabled(context: FeatureContext): boolean {
  const env = context.env as typeof context.env & GroundedEnvironment;
  return (
    env.THEME_AI_ENABLED === "true" &&
    env.THEME_AI_NO_CHARGE_CONFIRMED === "true" &&
    !!env.AI
  );
}

async function buildThemeCandidates(
  rows: SubmissionRow[],
  organizationId: string,
  context: FeatureContext,
): Promise<{
  status: GroundingStatus;
  suggestions: ThemeMembershipSuggestion[];
}> {
  const env = context.env as typeof context.env & GroundedEnvironment;
  if (!aiEnabled(context) || !env.THEME_VECTORS)
    return { status: "disabled", suggestions: [] };
  const eligible = rows.filter(
    (row) => !isSensitiveThemeCategory(row.category_id),
  );
  if (eligible.length < 2 || eligible.length > 24)
    return { status: "capacity_limit", suggestions: [] };
  try {
    const vectors = await embedThemeSources(
      env.AI!,
      eligible.map((row) => ({
        id: row.id,
        originalText: row.original_text,
        constructiveFollowUp: row.constructive_follow_up,
      })),
    );
    const pairs = await findThemeCandidates(
      env.THEME_VECTORS,
      organizationId,
      eligible.map((row, index) => ({
        id: row.id,
        categoryId: row.category_id,
        values: vectors[index]!,
      })),
    );
    const memberships = await context.env.DB.prepare(
      `SELECT m.submission_id, m.theme_id, m.source,
        COALESCE(f.category_id, f.category) AS category_id, f.created_at
       FROM feedback_theme_memberships AS m
       JOIN feedback_submissions AS f ON f.id = m.submission_id
       WHERE m.organization_id = ? AND f.organization_id = ?`,
    )
      .bind(organizationId, organizationId)
      .all<{
        submission_id: string;
        theme_id: string;
        source: "automatic" | "staff";
        category_id: string;
        created_at: string;
      }>();
    return {
      status: "grounded",
      suggestions: proposeThemeMembershipReviews(
        pairs,
        (memberships.results ?? []).map((row) => ({
          submissionId: row.submission_id,
          themeId: row.theme_id,
          source: row.source,
          categoryId: row.category_id,
          createdAt: row.created_at,
        })),
      ),
    };
  } catch {
    return { status: "provider_unavailable", suggestions: [] };
  }
}

async function reviewThemeMembership(
  request: Request,
  organizationId: string,
  themeId: string,
  actorSubject: string,
  context: FeatureContext,
): Promise<Response> {
  const input = (await request.json().catch(() => null)) as {
    submissionId?: unknown;
  } | null;
  const submissionId = input?.submissionId;
  if (
    typeof submissionId !== "string" ||
    !/^fb_[a-f0-9]{32}$/.test(submissionId)
  )
    return featureError(
      context,
      "VALIDATION_ERROR",
      "A valid submissionId is required.",
      400,
    );
  const database = context.env.DB;
  const [theme, submission, current] = await Promise.all([
    database
      .prepare(
        "SELECT category_id FROM feedback_themes WHERE id = ? AND organization_id = ?",
      )
      .bind(themeId, organizationId)
      .first<{ category_id: string }>(),
    database
      .prepare(
        "SELECT COALESCE(category_id, category) AS category_id FROM feedback_submissions WHERE id = ? AND organization_id = ?",
      )
      .bind(submissionId, organizationId)
      .first<{ category_id: string }>(),
    database
      .prepare(
        "SELECT theme_id, source FROM feedback_theme_memberships WHERE submission_id = ? AND organization_id = ?",
      )
      .bind(submissionId, organizationId)
      .first<{ theme_id: string; source: string }>(),
  ]);
  if (!theme || !submission)
    return featureError(
      context,
      "NOT_FOUND",
      "Theme or submission not found.",
      404,
    );
  if (theme.category_id !== submission.category_id)
    return featureError(
      context,
      "CATEGORY_MISMATCH",
      "The submission and theme must share a category.",
      409,
    );
  if (current?.theme_id === themeId && current.source === "staff")
    return featureJson(context, {
      apiVersion: API_VERSION,
      submissionId,
      themeId,
      source: "staff",
    });
  const now = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO feedback_theme_memberships (submission_id, theme_id, organization_id, source, created_at)
     VALUES (?, ?, ?, 'staff', ?)
     ON CONFLICT (submission_id) DO UPDATE SET
       theme_id = excluded.theme_id, source = 'staff', created_at = excluded.created_at`,
    )
    .bind(submissionId, themeId, organizationId, now)
    .run();
  await database
    .prepare(
      `INSERT INTO audit_events (
      id, actor_subject, organization_id, action, entity_type, entity_id,
      details_json, created_at
     ) VALUES (?, ?, ?, 'feedback_theme_membership_reviewed',
       'feedback_submission', ?, ?, ?)`,
    )
    .bind(
      `audit_${crypto.randomUUID().replaceAll("-", "")}`,
      actorSubject,
      organizationId,
      submissionId,
      JSON.stringify({ previousThemeId: current?.theme_id ?? null, themeId }),
      now,
    )
    .run();
  if (current?.theme_id !== themeId) {
    await refreshReviewedThemeSummary(database, organizationId, themeId, now);
    if (current?.theme_id)
      await refreshReviewedThemeSummary(
        database,
        organizationId,
        current.theme_id,
        now,
      );
    await outboxStatement(database, {
      eventId: crypto.randomUUID(),
      eventType: current
        ? "feedback.theme_membership_moved"
        : "feedback.theme_membership_added",
      occurredAt: now,
      actorKind: "staff",
      actorSubject,
      organizationId,
      aggregateType: "feedback_submission",
      aggregateId: submissionId,
      idempotencyKey: `theme-review:${submissionId}:${themeId}:${now}`,
      payload: {
        themeId,
        previousThemeId: current?.theme_id ?? null,
        categoryId: theme.category_id,
        source: "staff",
      },
    }).run();
  }
  return featureJson(context, {
    apiVersion: API_VERSION,
    submissionId,
    themeId,
    source: "staff",
  });
}

async function refreshReviewedThemeSummary(
  database: FeatureContext["env"]["DB"],
  organizationId: string,
  themeId: string,
  now: string,
): Promise<void> {
  const theme = await database
    .prepare(
      "SELECT title_en, title_fr, category_id FROM feedback_themes WHERE id = ? AND organization_id = ?",
    )
    .bind(themeId, organizationId)
    .first<{ title_en: string; title_fr: string; category_id: string }>();
  if (!theme) return;
  const linked = await database
    .prepare(
      `SELECT f.id, COALESCE(f.category_id, f.category) AS category_id,
      f.original_text, f.constructive_follow_up, f.status, f.intent, f.sample, f.created_at
     FROM feedback_theme_memberships AS m
     JOIN feedback_submissions AS f ON f.id = m.submission_id
     WHERE m.theme_id = ? AND m.organization_id = ? AND f.organization_id = ?
     ORDER BY f.created_at DESC`,
    )
    .bind(themeId, organizationId, organizationId)
    .all<SubmissionRow>();
  const rows = linked.results ?? [];
  const summary = summarize(
    { en: theme.title_en, fr: theme.title_fr },
    rows,
    theme.category_id,
  );
  await database
    .prepare(
      `UPDATE feedback_themes SET summary_en = ?, summary_fr = ?,
      summary_source_ids_json = ?, summary_source_count = ?,
      summary_generated_at = ?, summary_method = 'reviewed_deterministic',
      updated_at = ? WHERE id = ? AND organization_id = ?`,
    )
    .bind(
      summary.en,
      summary.fr,
      JSON.stringify(
        canDescribeThemeSources(theme.category_id, rows.length)
          ? rows.slice(0, 5).map((row) => row.id)
          : [],
      ),
      rows.length,
      now,
      now,
      themeId,
      organizationId,
    )
    .run();
}

async function ensureThemesCurrent(
  organizationId: string,
  context: FeatureContext,
): Promise<void> {
  const stale = await context.env.DB.prepare(
    `SELECT f.id FROM feedback_submissions AS f
     LEFT JOIN feedback_theme_memberships AS m ON m.submission_id = f.id
     LEFT JOIN feedback_themes AS t ON t.id = m.theme_id
     WHERE f.organization_id = ? AND (
       m.submission_id IS NULL OR m.organization_id != f.organization_id
       OR t.category_id != COALESCE(f.category_id, f.category)
     ) LIMIT 1`,
  )
    .bind(organizationId)
    .first<{ id: string }>();
  if (stale) await refreshThemesForOrganization(organizationId, context);
}

async function categoryNames(
  database: FeatureContext["env"]["DB"],
  organizationId: string,
): Promise<CategoryNames> {
  const row = await database
    .prepare(
      `SELECT document_json FROM taxonomy_versions
     WHERE organization_id = ? AND status = 'published'`,
    )
    .bind(organizationId)
    .first<{ document_json: string }>();
  if (!row) return {};
  const document = JSON.parse(row.document_json) as {
    categories?: Array<{ id: string; name?: { en?: string; fr?: string } }>;
  };
  return Object.fromEntries(
    (document.categories ?? []).map((category) => [
      category.id,
      {
        en: category.name?.en ?? humanize(category.id),
        fr: category.name?.fr ?? humanize(category.id),
      },
    ]),
  );
}

function summarize(
  title: { en: string; fr: string },
  rows: SubmissionRow[],
  categoryId: string,
): { en: string; fr: string } {
  const count = rows.length;
  if (!canDescribeThemeSources(categoryId, count))
    return {
      en: `${count} ${count === 1 ? "submission concerns" : "submissions concern"} ${title.en.toLowerCase()}. Open the linked feedback to review details and requested changes.`,
      fr: `${count} ${count === 1 ? "signalement concerne" : "signalements concernent"} ${title.fr.toLowerCase()}. Ouvrez les commentaires liés pour examiner les détails et les changements demandés.`,
    };
  const terms = commonTerms(rows);
  const suffixEn = terms.length
    ? ` Common topics include ${terms.join(", ")}.`
    : "";
  const suffixFr = terms.length
    ? ` Sujets récurrents : ${terms.join(", ")}.`
    : "";
  return {
    en: `${count} submissions concern ${title.en.toLowerCase()}.${suffixEn} Open the linked feedback to review requested changes.`,
    fr: `${count} signalements concernent ${title.fr.toLowerCase()}.${suffixFr} Ouvrez les commentaires liés pour examiner les changements demandés.`,
  };
}

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "been",
  "could",
  "does",
  "from",
  "have",
  "here",
  "into",
  "just",
  "more",
  "need",
  "please",
  "really",
  "should",
  "some",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "very",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your",
  "because",
  "make",
  "them",
  "were",
  "what",
  "want",
  "pour",
  "avec",
  "dans",
  "nous",
  "vous",
  "cette",
  "cela",
  "plus",
  "sont",
  "être",
  "avoir",
  "faire",
  "elle",
  "comme",
  "mais",
  "tout",
  "tous",
  "chez",
  "sans",
  "même",
  "depuis",
  "encore",
  "donc",
  "leurs",
  "notre",
  "votre",
  "elles",
  "après",
  "avant",
  "civicresolve",
  "envoy",
  "service",
  "services",
  "problem",
  "problems",
  "issue",
  "issues",
  "report",
  "reports",
  "feedback",
  "public",
  "city",
  "toronto",
  "request",
  "requests",
  "resident",
  "residents",
  "repair",
  "fixed",
  "help",
]);

function groupSubmissions(rows: SubmissionRow[]): Map<string, SubmissionRow[]> {
  const byCategory = new Map<string, SubmissionRow[]>();
  for (const row of rows) {
    const category = byCategory.get(row.category_id) ?? [];
    category.push(row);
    byCategory.set(row.category_id, category);
  }
  const groups = new Map<string, SubmissionRow[]>();
  for (const [categoryId, submissions] of byCategory) {
    if (isSensitiveThemeCategory(categoryId)) {
      groups.set(`${categoryId}:general`, submissions);
      continue;
    }
    const frequencies = new Map<string, number>();
    for (const row of submissions) {
      for (const term of termsFor(row))
        frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    }
    for (const row of submissions) {
      const topic =
        [...termsFor(row)]
          .filter((term) => (frequencies.get(term) ?? 0) >= 3)
          .sort(
            (left, right) =>
              (frequencies.get(right) ?? 0) - (frequencies.get(left) ?? 0) ||
              right.length - left.length ||
              left.localeCompare(right),
          )[0] ?? "general";
      const key = `${categoryId}:${topic}`;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
  }
  return groups;
}

function commonTerms(rows: SubmissionRow[]): string[] {
  const counts = new Map<string, number>();
  for (const row of rows.slice(0, 100)) {
    for (const term of termsFor(row))
      counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([term]) => term);
}

function termsFor(row: SubmissionRow): Set<string> {
  const text = redactThemeText(
    `${row.original_text} ${row.constructive_follow_up ?? ""}`,
  ).replace(/\[(?:email|phone|link|postal code|address|name)\]/g, " ");
  return new Set(
    (text.toLocaleLowerCase("en-CA").match(/\p{L}{4,}/gu) ?? []).filter(
      (word) => !STOPWORDS.has(word),
    ),
  );
}

function themeView(row: ThemeRow, organizationId: string) {
  const sourceIds = JSON.parse(row.summary_source_ids_json) as string[];
  return {
    id: row.id,
    categoryId: row.category_id,
    topicKey: row.topic_key,
    title: { en: row.title_en, fr: row.title_fr },
    summary: { en: row.summary_en, fr: row.summary_fr },
    count: row.count,
    previousCount: row.previous_count,
    change: row.count - row.previous_count,
    metric: "submissions",
    sample: row.real_count === 0,
    summaryMethod: row.summary_method,
    summarySourceCount: row.summary_source_count,
    summaryEvidenceRestricted: !canDescribeThemeSources(
      row.category_id,
      row.summary_source_count,
    ),
    summaryGeneratedAt: row.summary_generated_at,
    summaryStale:
      !row.summary_generated_at ||
      (row.latest_source_updated_at !== null &&
        row.latest_source_updated_at > row.summary_generated_at),
    sourceIds,
    sourceHrefs: sourceIds.map(
      (id) => `/api/v1/staff/organizations/${organizationId}/feedback/${id}`,
    ),
    href: `/api/v1/staff/organizations/${organizationId}/themes/${row.id}`,
  };
}

function parseDays(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? Math.min(90, Math.max(1, parsed)) : 30;
}

function safeFilter(raw: string | null): string | null {
  return raw && /^[A-Za-z0-9_-]{1,80}$/.test(raw) ? raw : null;
}

function filterClause(
  category: string | null,
  department: string | null,
  status: string | null,
) {
  let sql = "";
  const values: Array<string> = [];
  if (category) {
    sql += " AND COALESCE(f.category_id, f.category) = ?";
    values.push(category);
  }
  if (department) {
    sql += " AND a.department_id = ?";
    values.push(department);
  }
  if (status) {
    sql += " AND f.status = ?";
    values.push(status);
  }
  return { sql, values };
}

async function groupedCount(
  database: FeatureContext["env"]["DB"],
  expression: string,
  params: Array<string>,
  filterSql: string,
) {
  return database
    .prepare(
      `SELECT ${expression} AS key, COUNT(*) AS count
     FROM feedback_submissions AS f
     LEFT JOIN feedback_assignments AS a ON a.submission_id = f.id
     WHERE f.organization_id = ? AND f.created_at >= ? ${filterSql}
     GROUP BY ${expression} ORDER BY count DESC, key`,
    )
    .bind(...params)
    .all<CountRow>();
}

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
