import { API_VERSION } from "@civicresolve/contracts/v1";
import {
  enqueueOutboxEvent,
  getOutboxEvent,
  IdempotencyConflictError,
  type D1Database,
  type R2Bucket,
} from "@civicresolve/db/d1";
import {
  canPerformGlobalAction,
  canPerformOwnerAction,
  canPerformOrganizationAction,
  isDomainAction,
  isGlobalAction,
  isOwnerAction,
  ORGANIZATION_ACTIONS,
  type DomainAction,
} from "@civicresolve/domain/permissions";
import { authenticateRequest, Auth0TokenError } from "../auth/index.js";
import { handleApplicationRequest } from "../features/application-core/index.js";
import { handleFeedbackRequest } from "../features/feedback-core/index.js";
import { handleProfileRequest } from "../features/profile/index.js";
import { handleSourceRequest } from "../features/sources/index.js";
import {
  handleAnalyticsRequest,
  deliverFeedbackOutbox,
} from "../features/analytics/index.js";
import { handleAgentRequest } from "../features/agents/index.js";
import { handleTaxonomyRequest } from "../features/taxonomy/index.js";
import { handleVoiceRequest } from "../features/voice/index.js";
import { ingestOfficialSources } from "../features/sources/ingest.js";
import { handleEmployerRequest } from "../features/employer/index.js";
import { handleStaffWorkspaceRequest } from "../features/staff-workspace/index.js";
import { handleThemesRequest } from "../features/themes/index.js";
import { handleDiscoveryRequest } from "../features/discovery/index.js";
import { handleNearbyRequest } from "../features/nearby/index.js";
import { handleConsultationRequest } from "../features/consultations/index.js";
import { handleProgramIntakeRequest } from "../features/program-intake/index.js";
import { handleExternalPreparationRequest } from "../features/external-preparation/index.js";
import type { FeatureContext } from "../features/shared.js";

interface Env {
  DB: D1Database;
  PRIVATE_ASSETS: R2Bucket;
  APP_ENV: "development" | "production";
  DEV_AUTH_ENABLED?: string;
  AUTH0_DOMAIN?: string;
  AUTH0_AUDIENCE?: string;
  ALLOWED_ORIGINS?: string;
  FEEDBACK_ABUSE_HMAC_KEY?: string;
  AI?: import("../features/agents/types.js").AiBinding;
  HYPERDRIVE?: { connectionString: string };
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_AGENT_ID?: string;
  ELEVENLABS_WEBHOOK_SECRET?: string;
}

interface SmokeInput {
  value: string;
}

const LOCAL_ORIGINS = ["http://localhost:5173", "http://localhost:8081"];

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    let responseCors = new Headers();

    try {
      const cors = corsHeaders(request, env);
      if (cors instanceof Response) return cors;
      responseCors = cors;
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: cors });

      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/healthz") {
        const database = await env.DB.prepare("SELECT 1 AS ok").first<{
          ok: number;
        }>();
        return json({ ok: database?.ok === 1, requestId }, 200, cors);
      }

      if (url.pathname.startsWith("/api/v1/_local/smoke/")) {
        if (env.APP_ENV !== "development")
          return jsonError(
            "NOT_FOUND",
            "Route not found.",
            requestId,
            404,
            cors,
          );
        if (url.pathname === "/api/v1/_local/smoke/authz") {
          if (env.DEV_AUTH_ENABLED !== "true")
            return jsonError(
              "NOT_FOUND",
              "Route not found.",
              requestId,
              404,
              cors,
            );
          return handleLocalAuthorizationSmoke(request, env, requestId, cors);
        }
        return handleLocalOutboxSmoke(request, url, env, requestId, cors);
      }

      const featureContext: FeatureContext = { env, requestId, cors };
      const agentResponse = await handleAgentRequest(
        request,
        url,
        featureContext,
      );
      if (agentResponse) return agentResponse;
      const taxonomyResponse = await handleTaxonomyRequest(
        request,
        url,
        featureContext,
      );
      if (taxonomyResponse) return taxonomyResponse;
      const voiceResponse = await handleVoiceRequest(
        request,
        url,
        featureContext,
      );
      if (voiceResponse) return voiceResponse;
      const discoveryResponse = await handleDiscoveryRequest(
        request,
        url,
        featureContext,
      );
      if (discoveryResponse) return discoveryResponse;
      const nearbyResponse = await handleNearbyRequest(
        request,
        url,
        featureContext,
      );
      if (nearbyResponse) return nearbyResponse;
      const consultationResponse = await handleConsultationRequest(
        request,
        url,
        featureContext,
      );
      if (consultationResponse) return consultationResponse;
      const programIntakeResponse = await handleProgramIntakeRequest(
        request,
        url,
        featureContext,
      );
      if (programIntakeResponse) return programIntakeResponse;
      const externalPreparationResponse =
        await handleExternalPreparationRequest(request, url, featureContext);
      if (externalPreparationResponse) return externalPreparationResponse;
      const themesResponse = await handleThemesRequest(
        request,
        url,
        featureContext,
      );
      if (themesResponse) return themesResponse;
      const staffWorkspaceResponse = await handleStaffWorkspaceRequest(
        request,
        url,
        featureContext,
      );
      if (staffWorkspaceResponse) return staffWorkspaceResponse;
      const employerResponse = await handleEmployerRequest(
        request,
        url,
        featureContext,
      );
      if (employerResponse) return employerResponse;
      const sourcesResponse = await handleSourceRequest(
        request,
        url,
        featureContext,
      );
      if (sourcesResponse) return sourcesResponse;
      const feedbackResponse = await handleFeedbackRequest(
        request,
        url,
        featureContext,
      );
      if (feedbackResponse) return feedbackResponse;
      const analyticsResponse = await handleAnalyticsRequest(
        request,
        url,
        featureContext,
      );
      if (analyticsResponse) return analyticsResponse;
      const applicationResponse = await handleApplicationRequest(
        request,
        url,
        featureContext,
      );
      if (applicationResponse) return applicationResponse;
      const profileResponse = await handleProfileRequest(
        request,
        url,
        featureContext,
      );
      if (profileResponse) return profileResponse;

      return jsonError("NOT_FOUND", "Route not found.", requestId, 404, cors);
    } catch (error) {
      if (error instanceof Auth0TokenError) {
        return jsonError(
          "UNAUTHENTICATED",
          "A valid access token is required.",
          requestId,
          401,
          responseCors,
        );
      }
      if (error instanceof IdempotencyConflictError) {
        return jsonError(
          "IDEMPOTENCY_CONFLICT",
          error.message,
          requestId,
          409,
          responseCors,
        );
      }
      return jsonError(
        "INTERNAL_ERROR",
        "The request could not be completed.",
        requestId,
        500,
        responseCors,
      );
    }
  },
  scheduled(
    event: { cron?: string },
    env: Env,
    context: { waitUntil(promise: Promise<unknown>): void },
  ): void {
    // An operator can invoke this cron only in a Wrangler remote preview with
    // --test-scheduled; production config does not register this schedule.
    if (event.cron === "0 0 1 1 *") {
      context.waitUntil(
        ingestOfficialSources(env.DB, fetch, new Date(), "vacancies"),
      );
      return;
    }
    context.waitUntil(deliverFeedbackOutbox(env));
    context.waitUntil(refreshOfficialSourcesWhenDue(env.DB));
  },
};

async function refreshOfficialSourcesWhenDue(
  database: D1Database,
): Promise<void> {
  const state = await database
    .prepare(
      "SELECT fetched_at, updated_at, last_error FROM source_registry WHERE id = ?",
    )
    .bind("service-bc-office-locations")
    .first<{
      fetched_at: string | null;
      updated_at: string;
      last_error: string | null;
    }>();
  const lastAttempt =
    state?.fetched_at ?? (state?.last_error ? state.updated_at : null);
  const retryAfter = state?.last_error ? 15 * 60_000 : 86_400_000;
  if (!lastAttempt || Date.now() - Date.parse(lastAttempt) >= retryAfter)
    await ingestOfficialSources(database);
}

async function handleLocalOutboxSmoke(
  request: Request,
  url: URL,
  env: Env,
  requestId: string,
  cors: Headers,
): Promise<Response> {
  const collectionPath = "/api/v1/_local/smoke/outbox";
  if (request.method === "POST" && url.pathname === collectionPath) {
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (
      !idempotencyKey ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 128
    ) {
      return jsonError(
        "INVALID_IDEMPOTENCY_KEY",
        "Provide a 16–128 character Idempotency-Key.",
        requestId,
        400,
        cors,
      );
    }

    const body = (await request.json().catch(() => null)) as SmokeInput | null;
    if (!body || typeof body.value !== "string" || body.value.length > 256) {
      return jsonError(
        "INVALID_REQUEST",
        "Provide a short smoke-test value.",
        requestId,
        400,
        cors,
      );
    }

    const saved = await enqueueOutboxEvent(env.DB, {
      eventType: "local.smoke",
      schemaVersion: "1.0",
      occurredAt: new Date().toISOString(),
      actorKind: "system",
      actorSubject: null,
      organizationId: null,
      aggregateType: "local_smoke",
      aggregateId: idempotencyKey,
      idempotencyKey,
      payload: { value: body.value },
    });
    return json(
      {
        apiVersion: API_VERSION,
        eventId: saved.eventId,
        replayed: saved.replayed,
        requestId,
      },
      saved.replayed ? 200 : 201,
      cors,
    );
  }

  const eventMatch = url.pathname.match(
    /^\/api\/v1\/_local\/smoke\/outbox\/([0-9a-f-]{36})$/i,
  );
  if (request.method === "GET" && eventMatch) {
    const event = await getOutboxEvent(env.DB, eventMatch[1]!);
    if (!event || event.event_type !== "local.smoke") {
      return jsonError(
        "NOT_FOUND",
        "Smoke event not found.",
        requestId,
        404,
        cors,
      );
    }
    return json(
      {
        apiVersion: API_VERSION,
        event: {
          id: event.event_id,
          type: event.event_type,
          aggregateId: event.aggregate_id,
          payload: JSON.parse(event.payload_json) as unknown,
        },
        requestId,
      },
      200,
      cors,
    );
  }

  return jsonError("NOT_FOUND", "Route not found.", requestId, 404, cors);
}

async function handleLocalAuthorizationSmoke(
  request: Request,
  env: Env,
  requestId: string,
  cors: Headers,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "Use POST.", requestId, 405, cors);
  }
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    targetOrganizationId?: unknown;
  } | null;
  if (
    !body ||
    !isDomainAction(body.action) ||
    (isOrganizationAction(body.action) &&
      (typeof body.targetOrganizationId !== "string" ||
        body.targetOrganizationId.length === 0))
  ) {
    return jsonError(
      "INVALID_REQUEST",
      "Provide a valid action and target organization.",
      requestId,
      400,
      cors,
    );
  }

  const actor = await authenticateRequest(request, env);
  if (!actor) {
    return jsonError(
      "UNAUTHENTICATED",
      "A local test identity is required.",
      requestId,
      401,
      cors,
    );
  }
  const allowed = isOrganizationAction(body.action)
    ? canPerformOrganizationAction(
        actor,
        body.action,
        body.targetOrganizationId as string,
      )
    : isGlobalAction(body.action)
      ? canPerformGlobalAction(actor, body.action)
      : isOwnerAction(body.action)
        ? canPerformOwnerAction(actor, body.action, actor.subject)
        : false;
  return json(
    { apiVersion: API_VERSION, allowed, requestId },
    allowed ? 200 : 403,
    cors,
  );
}

function isOrganizationAction(
  action: DomainAction,
): action is (typeof ORGANIZATION_ACTIONS)[number] {
  return (ORGANIZATION_ACTIONS as readonly string[]).includes(action);
}

function corsHeaders(request: Request, env: Env): Headers | Response {
  const origin = request.headers.get("Origin");
  const configured = env.ALLOWED_ORIGINS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed =
    configured ?? (env.APP_ENV === "development" ? LOCAL_ORIGINS : []);
  if (origin && !allowed.includes(origin)) {
    return jsonError(
      "ORIGIN_NOT_ALLOWED",
      "This origin is not allowed.",
      crypto.randomUUID(),
      403,
    );
  }

  const headers = new Headers({
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Idempotency-Key, X-Receipt-Token, X-Conversation-Token",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(
  value: unknown,
  status: number,
  headers = new Headers(),
): Response {
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value), { status, headers });
}

function jsonError(
  code: string,
  message: string,
  requestId: string,
  status: number,
  headers = new Headers(),
): Response {
  return json(
    { apiVersion: API_VERSION, error: { code, message, requestId } },
    status,
    headers,
  );
}

export default worker;
