# ElevenLabs voice intake

## What it is

The guest feedback form can start a short, conversational ElevenLabs voice session. The guide asks what happened and what would improve the situation. A resident can explicitly confirm submission by voice, or stop and review the editable transcript on the website.

Live status (2026-09-26): a seven-day ElevenAgents Write API key with a 5,000-credit cap is installed as a production Worker secret and expires on October 3. A production signed session and a short, fictional PCM voice conversation succeeded: ElevenLabs transcribed the streetlight report and asked for the nearest intersection. The signed webhook, browser microphone, review screen, and final feedback submission still need live acceptance. Typed feedback remains available.

## How it works

`POST /api/v1/voice/session` accepts `{ "locale": "en" | "fr" }` and returns a temporary private-agent `signedUrl` plus a random `voiceSessionToken`. The Worker stores only the token hash in `voice_sessions`. The browser starts `Conversation.startSession({ signedUrl, connectionType: "websocket", dynamicVariables: { secret__envoy_voice_token: voiceSessionToken }, onMessage })` from `@elevenlabs/client`, then fills the editable feedback fields from finalized user transcript turns. Typed intake remains available if the microphone is denied, the session limit is reached, or ElevenLabs is unavailable.

The live agent is named `envoy feedback intake` and has ID `agent_5801m3fcxxsfez68g5v7gr22fzky`. Its reproducible nonsecret settings are in `apps/worker/src/features/voice/agent-config.json`: private access, a 180-second maximum, one concurrent call, 20 daily calls, and no paid concurrency bursting. It has no direct submission tool. Voice sessions do not upload audio recordings to envoy. A submitted transcript follows the same receipt, audit, and retention rules as typed feedback.

The Worker limits signed URL requests to four per IP each hour using a keyed HMAC bucket in `feedback_abuse_counters`. It never stores the raw IP. ElevenLabs' signed URL expires after approximately 15 minutes. The agent's daily limit and the workspace's disabled overage setting cap use if a public visitor bypasses the Worker and reuses a signed URL.

The guide reads a summary aloud, discloses that the destination is envoy's Toronto practice queue rather than a government office, and asks for the exact spoken phrase “yes, submit it.” When the call ends, ElevenLabs sends a `post_call_transcription` webhook with an HMAC signature over the timestamp and raw JSON body. The Worker verifies that signature and freshness, matches the session token and agent ID, and requires the disclosure immediately before the resident's confirmation turn. It builds the feedback text from the resident's prior turns and sends it through the existing guest feedback handler with a conversation-based idempotency key. Retries therefore return the same submission. Duplicate reports are not silently sent. A session without that confirmation stays as an editable draft for the website's normal review and duplicate check.

The browser can poll `GET /api/v1/voice/session/status` with the token in `X-Voice-Session-Token`. `submitted` includes the private receipt credentials; `duplicate` and `not_submitted` leave the transcript editable. Neither the webhook nor the status endpoint returns the raw conversation transcript. The webhook never accepts audio events as feedback submissions.

Example:

```http
POST /api/v1/voice/session
Content-Type: application/json

{"locale":"en"}
```

```json
{
  "apiVersion": "v1",
  "signedUrl": "wss://api.elevenlabs.io/v1/convai/conversation?...",
  "expiresInSeconds": 900,
  "locale": "en",
  "voiceSessionToken": "64 random hexadecimal characters"
}
```

## How to change it

Edit the Worker route in `apps/worker/src/features/voice/index.ts` for session policy, signature checks, or provider response handling. Change the agent prompt/config file and apply it with the ElevenLabs CLI when changing dialogue. Keep its final disclosure question aligned with `confirmedFeedbackMessage`; the Worker accepts a literal resident confirmation turn, never a model-generated consent statement. Enable `user_transcript` and `agent_response` client events on the agent if the UI stops receiving transcripts. Apply `packages/db/migrations/0024_voice_sessions.sql` before deploying the new route.

The current agent speaks English. The route accepts `fr` so the client can retain its locale and use translated form copy, but a French voice configuration still requires a separate multilingual agent or approved language override. Keep the typed French form working meanwhile.

## Configuration

- `ELEVENLABS_AGENT_ID`: `agent_5801m3fcxxsfez68g5v7gr22fzky` for the current workspace.
- `ELEVENLABS_API_KEY`: server-side secret with permission to issue signed URLs; never expose it to the browser, source tree, or logs.
- `ELEVENLABS_WEBHOOK_SECRET`: HMAC secret returned once by the ElevenLabs workspace webhook creation API. Store it as a Worker secret; never print or commit it.
- `FEEDBACK_ABUSE_HMAC_KEY`: existing Worker secret, at least 32 characters, used for privacy-preserving rate buckets.
- `DB`: D1 database with feedback migration `0005_feedback.sql` applied.
- `ALLOWED_ORIGINS`: includes the public web origin for the browser request.

The production API key is present. The provider returned `missing_permissions` for ElevenAgents Read; the existing key needed ElevenAgents Write to issue signed URLs. All unrelated scopes remain No Access. Rotate the key with `wrangler secret put ELEVENLABS_API_KEY --env production` if it expires or is disabled. Do not place it in `wrangler.toml` or `.dev.vars` in Git. The current CLI OAuth token can manage the agent but cannot mint a service-account key on this Creator workspace.

Use `elevenlabs webhooks create` to register `https://civicresolve-api-production.matteopolak.workers.dev/api/v1/voice/webhook` with HMAC authentication, then select its ID as the agent's post-call transcript webhook with JSON transcript format, audio off, and retries on. Configure the Worker secret from the one-time CLI response before activating it. The webhook is workspace-scoped, so it must filter for this agent ID; the handler does that. The agent's transcript events and signature details follow the [ElevenLabs post-call webhook documentation](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks).

## Verification

On September 26, the deployed Worker returned HTTP 200 for a signed session. A bounded WebSocket session streamed a locally synthesized fictional streetlight report as `pcm_16000` audio. ElevenLabs returned the exact spoken transcript and asked for the streetlight's address or nearest intersection. The signed URL and key were kept out of output. This proves the deployed signing path, provider speech recognition, and conversational response; it does not prove the new post-call webhook, browser microphone permission, visible transcript review, or feedback submission through the UI.

## Dependencies

- [ElevenLabs signed URL API](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url) and [JavaScript client](https://elevenlabs.io/docs/eleven-agents/libraries/java-script).
- Cloudflare Worker Fetch API and D1.
- Existing guest feedback endpoint and receipt flow.
