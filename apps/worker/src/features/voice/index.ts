import { API_VERSION } from "@civicresolve/contracts/v1";
import { featureError, featureJson, type FeatureContext } from "../shared.js";

export type VoiceContext = FeatureContext & {
  env: FeatureContext["env"] & {
    ELEVENLABS_API_KEY?: string;
    ELEVENLABS_AGENT_ID?: string;
  };
};

const ONE_HOUR_MS = 60 * 60 * 1_000;
const SESSION_LIMIT_PER_HOUR = 4;
const SIGNED_URL_LIFETIME_SECONDS = 15 * 60;

export async function handleVoiceRequest(
  request: Request,
  url: URL,
  context: VoiceContext,
): Promise<Response | null> {
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
        typeof providerStatus === "string" && /^[a-z_]{1,80}$/.test(providerStatus)
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

  return featureJson(context, {
    apiVersion: API_VERSION,
    signedUrl,
    expiresInSeconds: SIGNED_URL_LIFETIME_SECONDS,
    locale: body.locale,
  });
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
