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

interface Env {
  DB: D1Database;
  PRIVATE_ASSETS: R2Bucket;
  APP_ENV: "development" | "production";
  DEV_AUTH_ENABLED?: string;
  AUTH0_DOMAIN?: string;
  AUTH0_AUDIENCE?: string;
  ALLOWED_ORIGINS?: string;
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
};

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
      "Authorization, Content-Type, Idempotency-Key, X-Receipt-Token",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
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
