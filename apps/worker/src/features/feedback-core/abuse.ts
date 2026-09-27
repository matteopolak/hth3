import { featureError } from "../shared.js";
import type { FeedbackContext } from "./types.js";

const ONE_HOUR_MS = 60 * 60 * 1_000;
const RETENTION_MS = 24 * ONE_HOUR_MS;
const DUPLICATE_REPEAT_LIMIT = 16;
const LIMITS = {
  create: 8,
  reply: 16,
  reopen: 4,
} as const;

export type AbuseScope = keyof typeof LIMITS;

export async function enforceGuestAbuseLimit(
  request: Request,
  context: FeedbackContext,
  scope: AbuseScope,
  options: { bucketNamespace?: string; repeatKey?: string } = {},
): Promise<Response | null> {
  const secret = context.env.FEEDBACK_ABUSE_HMAC_KEY;
  if (!secret || secret.length < 32) {
    return featureError(
      context,
      "ABUSE_CONTROL_UNAVAILABLE",
      "Guest feedback is temporarily unavailable.",
      503,
    );
  }

  const address = request.headers.get("CF-Connecting-IP")?.trim() || "unknown";
  const bucketNamespace = options.bucketNamespace
    ? `${options.bucketNamespace}:`
    : "";
  const bucketHash = await hmacHex(
    secret,
    `feedback-abuse:v1:${bucketNamespace}${address}`,
  );
  const windowStart = Math.floor(Date.now() / ONE_HOUR_MS) * ONE_HOUR_MS;
  await context.env.DB.prepare(
    "DELETE FROM feedback_abuse_counters WHERE window_started_at < ?",
  )
    .bind(windowStart - RETENTION_MS)
    .run();

  // One unchanged duplicate preview can be retried without consuming all of
  // the IP's distinct-query budget. Both budgets remain HMAC scoped and capped.
  if (options.repeatKey) {
    const repeatHash = await hmacHex(
      secret,
      `feedback-abuse:v1:${bucketNamespace}repeat:${address}:${options.repeatKey}`,
    );
    const previous = await context.env.DB.prepare(
      "SELECT window_started_at, request_count FROM feedback_abuse_counters WHERE bucket_hash = ? AND scope = ?",
    )
      .bind(repeatHash, scope)
      .first<{ window_started_at: number; request_count: number }>();
    if (!previous || previous.window_started_at !== windowStart) {
      const distinct = await incrementCounter(
        context,
        bucketHash,
        scope,
        windowStart,
        LIMITS[scope],
      );
      if (!distinct) return limited(context);
    }
    const repeat = await incrementCounter(
      context,
      repeatHash,
      scope,
      windowStart,
      DUPLICATE_REPEAT_LIMIT,
    );
    return repeat ? null : limited(context);
  }

  const updated = await incrementCounter(
    context,
    bucketHash,
    scope,
    windowStart,
    LIMITS[scope],
  );
  return updated ? null : limited(context);
}

async function incrementCounter(
  context: FeedbackContext,
  bucketHash: string,
  scope: AbuseScope,
  windowStart: number,
  limit: number,
): Promise<boolean> {
  const updated = await context.env.DB.prepare(
    `INSERT INTO feedback_abuse_counters (
       bucket_hash, scope, window_started_at, request_count
     ) VALUES (?, ?, ?, 1)
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
    .bind(bucketHash, scope, windowStart, limit)
    .first<{ request_count: number }>();
  return !!updated;
}

function limited(context: FeedbackContext): Response {
  return featureError(
    context,
    "RATE_LIMITED",
    "Please wait before trying this guest feedback action again.",
    429,
  );
}

async function hmacHex(secret: string, value: string): Promise<string> {
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
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
