# ElevenLabs voice intake

## What it is

The guest feedback form can start a short, conversational ElevenLabs voice session. The guide asks what happened and what would improve the situation; the resident reviews the captured words before the existing feedback API submits anything.

## How it works

`POST /api/v1/voice/session` accepts `{ "locale": "en" | "fr" }` and returns a temporary private-agent `signedUrl`. The Worker gets it from ElevenLabs with a server-side API key. The browser starts `Conversation.startSession({ signedUrl, connectionType: "websocket", onMessage })` from `@elevenlabs/client`, then fills the editable feedback fields from finalized user transcript turns. The form calls `POST /api/v1/feedback` only after the resident confirms. Typed intake remains available if the microphone is denied, the session limit is reached, or ElevenLabs is unavailable.

The live agent is named `envoy feedback intake` and has ID `agent_5801m3fcxxsfez68g5v7gr22fzky`. Its reproducible nonsecret settings are in `apps/worker/src/features/voice/agent-config.json`: private access, a 180-second maximum, one concurrent call, 20 daily calls, and no paid concurrency bursting. It has no submission tool and cannot create a feedback record by itself. Voice sessions do not upload audio recordings to envoy. The reviewed transcript becomes the feedback text and follows the same receipt, audit, and retention rules as typed feedback.

The Worker limits signed URL requests to four per IP each hour using a keyed HMAC bucket in `feedback_abuse_counters`. It never stores the raw IP. ElevenLabs' signed URL expires after approximately 15 minutes. The agent's daily limit and the workspace's disabled overage setting cap use if a public visitor bypasses the Worker and reuses a signed URL.

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
  "locale": "en"
}
```

## How to change it

Edit the Worker route in `apps/worker/src/features/voice/index.ts` for session policy or provider response handling. Change the agent prompt/config file and apply it with the ElevenLabs CLI when changing dialogue. Enable `user_transcript` and `agent_response` client events on the agent if the UI stops receiving transcripts. The web form owns transcript review and its handoff to `POST /api/v1/feedback`; do not submit from a model-generated statement of consent.

The current agent speaks English. The route accepts `fr` so the client can retain its locale and use translated form copy, but a French voice configuration still requires a separate multilingual agent or approved language override. Keep the typed French form working meanwhile.

## Configuration

- `ELEVENLABS_AGENT_ID`: `agent_5801m3fcxxsfez68g5v7gr22fzky` for the current workspace.
- `ELEVENLABS_API_KEY`: server-side secret with permission to issue signed URLs; never expose it to the browser, source tree, or logs.
- `FEEDBACK_ABUSE_HMAC_KEY`: existing Worker secret, at least 32 characters, used for privacy-preserving rate buckets.
- `DB`: D1 database with feedback migration `0005_feedback.sql` applied.
- `ALLOWED_ORIGINS`: includes the public web origin for the browser request.

Set production secrets with `wrangler secret put ELEVENLABS_API_KEY --env production`. Do not place the key in `wrangler.toml` or `.dev.vars` in Git. Provisioning the Worker key requires an ElevenLabs API key with suitable scope; the CLI's current OAuth token can manage the agent but does not include `service_account_write` to mint a service-account key.

## Dependencies

- [ElevenLabs signed URL API](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url) and [JavaScript client](https://elevenlabs.io/docs/eleven-agents/libraries/java-script).
- Cloudflare Worker Fetch API and D1.
- Existing guest feedback endpoint and receipt flow.
