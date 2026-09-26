import { API_VERSION } from "@civicresolve/contracts/v1";
import { handleGuestFeedback } from "../feedback-core/guest.js";
import {
  featureError,
  featureJson,
  sha256Hex,
  type FeatureContext,
} from "../shared.js";

export type VoiceContext = FeatureContext & {
  env: FeatureContext["env"] & {
    ELEVENLABS_API_KEY?: string;
    ELEVENLABS_AGENT_ID?: string;
    ELEVENLABS_WEBHOOK_SECRET?: string;
  };
};

const ONE_HOUR_MS = 60 * 60 * 1_000;
const SESSION_LIMIT_PER_HOUR = 4;
const SIGNED_URL_LIFETIME_SECONDS = 15 * 60;
const SESSION_RETENTION_MS = 24 * 60 * 60 * 1_000;
const MAX_WEBHOOK_BYTES = 256 * 1_024;
const TORONTO_CSDUID = "3520005";

interface VoiceSessionRow {
  token_hash: string;
  locale: "en" | "fr";
  conversation_id: string | null;
  status: "pending" | "not_submitted" | "duplicate" | "submitted";
  submission_id: string | null;
  created_at: number;
}

export async function handleVoiceRequest(
  request: Request,
  url: URL,
  context: VoiceContext,
): Promise<Response | null> {
  if (url.pathname === "/api/v1/voice/webhook")
    return handlePostCallWebhook(request, context);
  if (url.pathname === "/api/v1/voice/session/status")
    return getVoiceSubmissionStatus(request, context);
  if (url.pathname !== "/api/v1/voice/session") return null;
  if (request.method !== "POST")
    return featureError(context, "METHOD_NOT_ALLOWED", "Use POST.", 405);

  const body = (await request.json().catch(() => null)) as {
    locale?: unknown;
  } | null;
  if (!body || (body.locale !== "en" && body.locale !== "fr"))
    return featureError(context, "INVALID_REQUEST", "Choose en or fr.", 400);

  const apiKey = context.env.ELEVENLABS_API_KEY;
  const agentId = context.env.ELEVENLABS_AGENT_ID;
  const abuseSecret = context.env.FEEDBACK_ABUSE_HMAC_KEY;
  if (!apiKey || !agentId || !abuseSecret || abuseSecret.length < 32) {
    console.warn("voice_session_unavailable", {
      stage: "configuration",
      apiKeyConfigured: Boolean(apiKey),
      agentIdConfigured: Boolean(agentId),
      abuseKeyConfigured: Boolean(abuseSecret && abuseSecret.length >= 32),
    });
    return featureError(
      context,
      "VOICE_UNAVAILABLE",
      "Voice intake is unavailable. You can type your feedback instead.",
      503,
    );
  }

  const limited = await consumeSessionAllowance(request, context, abuseSecret);
  if (limited)
    return featureError(
      context,
      "RATE_LIMITED",
      "Please wait before starting another voice session.",
      429,
    );

  const endpoint = new URL(
    "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
  );
  endpoint.searchParams.set("agent_id", agentId);
  const response = await fetch(endpoint, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) {
    const errorPayload = (await response?.json().catch(() => null)) as {
      detail?: { code?: unknown; status?: unknown; type?: unknown };
    } | null;
    const providerStatus = errorPayload?.detail?.status;
    const providerCode = errorPayload?.detail?.code;
    console.warn("voice_session_unavailable", {
      stage: "upstream",
      status: response?.status ?? "network_error",
      providerStatus:
        typeof providerStatus === "string" &&
        /^[a-z_]{1,80}$/.test(providerStatus)
          ? providerStatus
          : undefined,
      providerCode:
        typeof providerCode === "string" && /^[a-z_]{1,80}$/.test(providerCode)
          ? providerCode
          : undefined,
    });
    return featureError(
      context,
      "VOICE_UNAVAILABLE",
      "Voice intake is unavailable. You can type your feedback instead.",
      503,
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    signed_url?: unknown;
  } | null;
  const signedUrl = payload?.signed_url;
  if (typeof signedUrl !== "string" || !validSignedUrl(signedUrl)) {
    console.warn("voice_session_unavailable", { stage: "invalid_response" });
    return featureError(
      context,
      "VOICE_UNAVAILABLE",
      "Voice intake is unavailable. You can type your feedback instead.",
      503,
    );
  }

  const voiceSessionToken = randomHex(32);
  const now = Date.now();
  await context.env.DB.prepare(
    `DELETE FROM voice_sessions WHERE created_at < ?`,
  )
    .bind(now - SESSION_RETENTION_MS)
    .run();
  await context.env.DB.prepare(
    `INSERT INTO voice_sessions (token_hash, locale, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(await sha256Hex(voiceSessionToken), body.locale, now, now)
    .run();

  return featureJson(context, {
    apiVersion: API_VERSION,
    signedUrl,
    expiresInSeconds: SIGNED_URL_LIFETIME_SECONDS,
    locale: body.locale,
    voiceSessionToken,
  });
}

async function getVoiceSubmissionStatus(
  request: Request,
  context: VoiceContext,
): Promise<Response> {
  if (request.method !== "GET")
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);
  const token = request.headers.get("X-Voice-Session-Token")?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/i.test(token))
    return featureError(
      context,
      "INVALID_REQUEST",
      "Missing voice session token.",
      400,
    );
  const row = await context.env.DB.prepare(
    `SELECT token_hash, locale, conversation_id, status, submission_id, created_at
     FROM voice_sessions WHERE token_hash = ?`,
  )
    .bind(await sha256Hex(token))
    .first<VoiceSessionRow>();
  if (!row || Date.now() - row.created_at > SESSION_RETENTION_MS)
    return featureError(context, "NOT_FOUND", "Voice session not found.", 404);
  return featureJson(context, {
    apiVersion: API_VERSION,
    status: row.status,
    ...(row.status === "submitted" && row.submission_id && row.conversation_id
      ? {
          submissionId: row.submission_id,
          receiptToken: await receiptTokenForConversation(
            context.env.FEEDBACK_ABUSE_HMAC_KEY!,
            row.conversation_id,
          ),
        }
      : {}),
  });
}

async function handlePostCallWebhook(
  request: Request,
  context: VoiceContext,
): Promise<Response> {
  if (request.method !== "POST")
    return featureError(context, "METHOD_NOT_ALLOWED", "Use POST.", 405);
  const secret = context.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret || !context.env.FEEDBACK_ABUSE_HMAC_KEY)
    return featureError(
      context,
      "VOICE_UNAVAILABLE",
      "Webhook unavailable.",
      503,
    );
  if (Number(request.headers.get("content-length") ?? 0) > MAX_WEBHOOK_BYTES)
    return featureError(context, "INVALID_REQUEST", "Webhook too large.", 413);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES)
    return featureError(context, "INVALID_REQUEST", "Webhook too large.", 413);
  if (
    !(await verifyWebhookSignature(
      rawBody,
      request.headers.get("ElevenLabs-Signature"),
      secret,
    ))
  )
    return featureError(
      context,
      "UNAUTHORIZED",
      "Invalid webhook signature.",
      401,
    );

  const event = (await Promise.resolve()
    .then(() => JSON.parse(rawBody))
    .catch(() => null)) as {
    type?: unknown;
    data?: {
      agent_id?: unknown;
      conversation_id?: unknown;
      status?: unknown;
      transcript?: unknown;
      conversation_initiation_client_data?: {
        dynamic_variables?: { secret__envoy_voice_token?: unknown };
      };
    };
  } | null;
  if (!event)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Invalid webhook JSON.",
      400,
    );
  if (event.type !== "post_call_transcription")
    return featureJson(context, { ok: true, ignored: true });
  const data = event.data;
  if (
    !data ||
    data.agent_id !== context.env.ELEVENLABS_AGENT_ID ||
    typeof data.conversation_id !== "string" ||
    !/^[A-Za-z0-9_-]{4,128}$/.test(data.conversation_id)
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Unknown conversation.",
      400,
    );
  const token =
    data.conversation_initiation_client_data?.dynamic_variables
      ?.secret__envoy_voice_token;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token))
    return featureError(
      context,
      "INVALID_REQUEST",
      "Unknown voice session.",
      400,
    );
  const tokenHash = await sha256Hex(token);
  const row = await context.env.DB.prepare(
    `SELECT token_hash, locale, conversation_id, status, submission_id, created_at
     FROM voice_sessions WHERE token_hash = ?`,
  )
    .bind(tokenHash)
    .first<VoiceSessionRow>();
  if (!row || Date.now() - row.created_at > SESSION_RETENTION_MS)
    return featureError(context, "NOT_FOUND", "Voice session not found.", 404);
  if (row.conversation_id && row.conversation_id !== data.conversation_id)
    return featureError(
      context,
      "IDEMPOTENCY_CONFLICT",
      "Conversation mismatch.",
      409,
    );
  if (!row.conversation_id) {
    const linked = await context.env.DB.prepare(
      `UPDATE voice_sessions SET conversation_id = ?, updated_at = ?
       WHERE token_hash = ? AND conversation_id IS NULL`,
    )
      .bind(data.conversation_id, Date.now(), tokenHash)
      .run();
    if (linked.meta.changes !== 1)
      return featureError(
        context,
        "IDEMPOTENCY_CONFLICT",
        "Conversation mismatch.",
        409,
      );
  }
  if (row.status !== "pending") return featureJson(context, { ok: true });

  const transcript = parseTranscript(data.transcript);
  const message = confirmedFeedbackMessage(transcript);
  if (!message || data.status !== "done") {
    await setVoiceStatus(context, tokenHash, "not_submitted", null);
    return featureJson(context, { ok: true, submitted: false });
  }

  const receiptToken = await receiptTokenForConversation(
    context.env.FEEDBACK_ABUSE_HMAC_KEY!,
    data.conversation_id,
  );
  const feedbackUrl = new URL("/api/v1/feedback", request.url);
  const feedbackRequest = new Request(feedbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Receipt-Token": receiptToken,
      "Idempotency-Key": `voice:${data.conversation_id}`,
      "CF-Connecting-IP": `voice:${tokenHash}`,
    },
    body: JSON.stringify({
      message,
      municipalityId: TORONTO_CSDUID,
      sandboxAcknowledged: true,
      locale: row.locale,
    }),
  });
  const feedbackResponse = await handleGuestFeedback(
    feedbackRequest,
    feedbackUrl,
    context,
  );
  const result = (await feedbackResponse?.json().catch(() => null)) as {
    submission?: { id?: string };
    duplicate?: unknown;
  } | null;
  if (feedbackResponse?.ok && result?.submission?.id) {
    await setVoiceStatus(context, tokenHash, "submitted", result.submission.id);
    return featureJson(context, { ok: true, submitted: true });
  }
  if (feedbackResponse?.ok && result?.duplicate) {
    await setVoiceStatus(context, tokenHash, "duplicate", null);
    return featureJson(context, { ok: true, submitted: false });
  }
  return featureError(
    context,
    "VOICE_SUBMISSION_RETRY",
    "Retry voice submission.",
    503,
  );
}

async function setVoiceStatus(
  context: VoiceContext,
  tokenHash: string,
  status: VoiceSessionRow["status"],
  submissionId: string | null,
): Promise<void> {
  await context.env.DB.prepare(
    `UPDATE voice_sessions SET status = ?, submission_id = ?, updated_at = ?
     WHERE token_hash = ? AND status = 'pending'`,
  )
    .bind(status, submissionId, Date.now(), tokenHash)
    .run();
}

function parseTranscript(
  value: unknown,
): Array<{ role: "user" | "agent"; message: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((turn) => {
    if (
      !turn ||
      (turn.role !== "user" && turn.role !== "agent") ||
      typeof turn.message !== "string"
    )
      return [];
    const message = turn.message.trim();
    return message ? [{ role: turn.role, message }] : [];
  });
}

function confirmedFeedbackMessage(
  turns: Array<{ role: "user" | "agent"; message: string }>,
): string | null {
  const last = turns.at(-1);
  if (
    !last ||
    last.role !== "user" ||
    !/^(?:yes[, ]+submit(?: it)?|oui[, ]+envoyez(?:-le)?)[.!]?$/i.test(
      last.message,
    )
  )
    return null;
  const disclosure = turns.at(-2);
  if (
    !disclosure ||
    disclosure.role !== "agent" ||
    !/toronto/i.test(disclosure.message) ||
    !/practice queue|file d'essai/i.test(disclosure.message) ||
    !/submit|send|envoyer/i.test(disclosure.message)
  )
    return null;
  const message = turns
    .slice(0, -2)
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.message)
    .join("\n")
    .trim();
  return message.length >= 20 && message.length <= 5_000 ? message : null;
}

async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  const match = /^t=(\d+),v0=([a-f0-9]{64})$/i.exec(signature ?? "");
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Date.now() - timestamp * 1_000) > 30 * 60 * 1_000
  )
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const digest = Uint8Array.from(match[2]!.match(/../g)!, (part) =>
    parseInt(part, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    digest,
    new TextEncoder().encode(`${match[1]}.${rawBody}`),
  );
}

async function receiptTokenForConversation(
  secret: string,
  id: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`voice-receipt:v1:${id}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function randomHex(bytes: number): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function consumeSessionAllowance(
  request: Request,
  context: VoiceContext,
  secret: string,
): Promise<boolean> {
  const address = request.headers.get("CF-Connecting-IP")?.trim() || "unknown";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`voice-session:v1:${address}`),
  );
  const bucketHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const windowStart = Math.floor(Date.now() / ONE_HOUR_MS) * ONE_HOUR_MS;
  const updated = await context.env.DB.prepare(
    `INSERT INTO feedback_abuse_counters (
       bucket_hash, scope, window_started_at, request_count
     ) VALUES (?, 'create', ?, 1)
     ON CONFLICT (bucket_hash, scope) DO UPDATE SET
       window_started_at = excluded.window_started_at,
       request_count = CASE
         WHEN feedback_abuse_counters.window_started_at = excluded.window_started_at
           THEN feedback_abuse_counters.request_count + 1
         ELSE 1
       END
     WHERE feedback_abuse_counters.window_started_at != excluded.window_started_at
        OR feedback_abuse_counters.request_count < ?
     RETURNING request_count`,
  )
    .bind(bucketHash, windowStart, SESSION_LIMIT_PER_HOUR)
    .first<{ request_count: number }>();
  return updated === null;
}

function validSignedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "wss:" &&
      url.hostname === "api.elevenlabs.io" &&
      url.pathname === "/v1/convai/conversation" &&
      url.searchParams.has("conversation_signature")
    );
  } catch {
    return false;
  }
}
