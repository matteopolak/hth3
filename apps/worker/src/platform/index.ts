import { API_VERSION } from "@civicresolve/contracts/v1";
import {
  enqueueOutboxEvent,
  getOutboxEvent,
  IdempotencyConflictError,
  type D1Database,
  type R2Bucket,
} from "@civicresolve/db/d1";

interface Env {
  DB: D1Database;
  PRIVATE_ASSETS: R2Bucket;
  APP_ENV: "development" | "production";
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
        return handleLocalOutboxSmoke(request, url, env, requestId, cors);
      }

      return jsonError("NOT_FOUND", "Route not found.", requestId, 404, cors);
    } catch (error) {
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
