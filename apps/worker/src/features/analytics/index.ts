import { API_VERSION } from "@civicresolve/contracts/v1";
import { canPerformOrganizationAction } from "@civicresolve/domain/permissions";
import postgres from "postgres";
import { authenticateRequest } from "../../auth/identity.js";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

type AnalyticsEnvironment = FeatureContext["env"] & {
  HYPERDRIVE?: { connectionString: string };
};

export interface AnalyticsContext extends Omit<FeatureContext, "env"> {
  env: AnalyticsEnvironment;
}

interface OutboxRow {
  event_id: string;
  event_type: string;
  occurred_at: string;
  organization_id: string | null;
  aggregate_id: string;
  payload_json: string;
  attempts: number;
}

interface DailyRow {
  day: Date | string;
  category: string;
  intent: string;
  sample: boolean;
  count: string;
}

interface FeedbackMetadata {
  sample: number;
  category: string;
  municipality_csd_uid: string | null;
}

const MAX_BATCH = 50;

export async function handleAnalyticsRequest(
  request: Request,
  url: URL,
  context: AnalyticsContext,
): Promise<Response | null> {
  const match = url.pathname.match(
    /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/analytics$/,
  );
  if (!match) return null;
  if (request.method !== "GET")
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);

  const organizationId = match[1]!;
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to view analytics.",
      401,
    );
  if (
    !canPerformOrganizationAction(
      actor,
      "feedback:read_organization",
      organizationId,
    )
  )
    return featureError(
      context,
      "FORBIDDEN",
      "This organization is unavailable.",
      403,
    );
  if (!context.env.HYPERDRIVE)
    return featureError(
      context,
      "ANALYTICS_UNAVAILABLE",
      "Analytics is not connected.",
      503,
    );

  const days = Math.max(
    1,
    Math.min(90, Number(url.searchParams.get("days")) || 30),
  );
  const since = new Date(Date.now() - days * 86_400_000);
  const sql = openTiger(context.env.HYPERDRIVE.connectionString);
  try {
    const [daily, totals, sync, lag, operational] = await Promise.all([
      sql<DailyRow[]>`
        SELECT day, category, intent, sample, SUM(event_count)::text AS count
        FROM feedback_daily
        WHERE organization_id = ${organizationId}
          AND event_type = 'feedback.submitted'
          AND day >= ${since}
        GROUP BY day, category, intent, sample ORDER BY day ASC, category, intent`,
      sql<
        { category: string; intent: string; sample: boolean; count: string }[]
      >`
        SELECT category, intent, sample, SUM(event_count)::text AS count
        FROM feedback_daily
        WHERE organization_id = ${organizationId}
          AND event_type = 'feedback.submitted'
          AND day >= ${since}
        GROUP BY category, intent, sample ORDER BY count DESC`,
      sql<{ latest: Date | null }[]>`
        SELECT MAX(occurred_at) AS latest FROM feedback_events
        WHERE organization_id = ${organizationId}`,
      context.env.DB.prepare(
        `SELECT COUNT(*) AS pending FROM outbox_events
         WHERE organization_id = ? AND event_type LIKE 'feedback.%' AND delivered_at IS NULL`,
      )
        .bind(organizationId)
        .first<{ pending: number }>(),
      sql<{ event_type: string; count: string }[]>`
        SELECT event_type, SUM(event_count)::text AS count
        FROM feedback_daily
        WHERE organization_id = ${organizationId}
          AND event_type IN ('feedback.status_changed', 'feedback.message_added')
          AND day >= ${since}
        GROUP BY event_type`,
    ]);
    return featureJson(context, {
      apiVersion: API_VERSION,
      windowDays: days,
      generatedAt: new Date().toISOString(),
      synchronizedThrough: sync[0]?.latest
        ? new Date(sync[0].latest).toISOString()
        : null,
      pendingEvents: lag?.pending ?? 0,
      daily: daily.map((row) => ({
        day: new Date(row.day).toISOString().slice(0, 10),
        category: row.category,
        intent: row.intent,
        sample: row.sample,
        count: Number(row.count),
      })),
      categories: totals.map((row) => ({
        category: row.category,
        intent: row.intent,
        sample: row.sample,
        count: Number(row.count),
      })),
      operational: Object.fromEntries(
        operational.map((row) => [row.event_type, Number(row.count)]),
      ),
    });
  } catch {
    return featureError(
      context,
      "ANALYTICS_UNAVAILABLE",
      "Analytics is temporarily unavailable.",
      503,
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function deliverFeedbackOutbox(
  env: AnalyticsEnvironment,
): Promise<{ delivered: number; failed: number }> {
  if (!env.HYPERDRIVE) return { delivered: 0, failed: 0 };
  const pending = await env.DB.prepare(
    `SELECT event_id, event_type, occurred_at, organization_id, aggregate_id,
            payload_json, attempts
     FROM outbox_events
     WHERE delivered_at IS NULL AND next_attempt_at <= ?
       AND event_type LIKE 'feedback.%'
     ORDER BY occurred_at ASC LIMIT ?`,
  )
    .bind(new Date().toISOString(), MAX_BATCH)
    .all<OutboxRow>();
  const sql = openTiger(env.HYPERDRIVE.connectionString);
  let delivered = 0;
  let failed = 0;
  try {
    for (const event of pending.results ?? []) {
      try {
        const payload = JSON.parse(event.payload_json) as Record<
          string,
          unknown
        >;
        const feedback = await env.DB.prepare(
          `SELECT sample, category, municipality_csd_uid
           FROM feedback_submissions WHERE id = ? AND organization_id = ?`,
        )
          .bind(event.aggregate_id, event.organization_id)
          .first<FeedbackMetadata>();
        if (!feedback) throw new Error("Feedback metadata is unavailable.");
        const category = stringValue(payload.category, feedback.category);
        const intent = stringValue(payload.intent, "unclassified");
        const municipality = stringValue(
          payload.municipalityCsdUid,
          feedback.municipality_csd_uid,
        );
        const status = stringValue(payload.status, null);
        const sample = feedback.sample === 1;
        await sql`
          INSERT INTO feedback_events (
            event_id, occurred_at, organization_id, submission_id, event_type,
            category, intent, municipality_csd_uid, status, sample
          ) VALUES (
            ${event.event_id}, ${event.occurred_at}, ${event.organization_id},
            ${event.aggregate_id}, ${event.event_type}, ${category}, ${intent},
            ${municipality}, ${status}, ${sample}
          ) ON CONFLICT (occurred_at, event_id) DO NOTHING`;
        await env.DB.prepare(
          `UPDATE outbox_events SET delivered_at = ?, last_error = NULL
           WHERE event_id = ? AND delivered_at IS NULL`,
        )
          .bind(new Date().toISOString(), event.event_id)
          .run();
        delivered++;
      } catch {
        failed++;
        const delay = Math.min(
          3_600_000,
          2 ** Math.min(event.attempts, 10) * 30_000,
        );
        await env.DB.prepare(
          `UPDATE outbox_events
           SET attempts = attempts + 1, next_attempt_at = ?, last_error = ?
           WHERE event_id = ? AND delivered_at IS NULL`,
        )
          .bind(
            new Date(Date.now() + delay).toISOString(),
            "Tiger delivery failed",
            event.event_id,
          )
          .run();
      }
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
  return { delivered, failed };
}

function openTiger(connectionString: string) {
  return postgres(connectionString, {
    max: 2,
    fetch_types: false,
    prepare: true,
  });
}

function stringValue(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" && value.length <= 80 ? value : fallback;
}
