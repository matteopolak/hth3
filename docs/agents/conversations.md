# Resident and employee conversations

## What it is

The Worker hosts persistent English and French Envoy resident and employee conversations. Residents can start as guests; employees need a current Auth0 organization role. Both can call typed tools covering the implemented manual API operations. Writes become reviewable proposals and run only after an explicit approval request.

## How it works

`POST /api/v1/agent/conversations` with `{ "mode": "resident", "locale": "en" }` creates a conversation. A guest receives a 64-character `conversationToken` and must send it as `X-Conversation-Token` on subsequent requests. Signed-in conversations bind to the current Auth0 subject; employee conversations also bind to the organization. A platform curator with a global taxonomy permission supplies `organizationId` when creating an employee conversation for a selected organization. `GET /api/v1/agent/conversations` lists signed-in threads. `GET /api/v1/agent/conversations/{id}` returns history, pending proposals, and the mode's available tools.

`POST /api/v1/agent/conversations/{id}/messages` accepts `{ "message": "..." }`. The Worker sends bounded recent history and a role-specific tool catalog to the `@cf/ibm-granite/granite-4.0-h-micro` Workers AI model. Workers AI currently returns an OpenAI Chat Completions envelope, so the Worker reads `choices[0].message.content` as well as its older top-level `response` shape. A model-selected read tool runs through the existing Worker feature handler. A model-selected write tool creates a proposal. For a non-emergency service problem explicitly placed in Toronto, the Worker prepares a reviewable feedback proposal even when the model selects no tool; if the municipality is unclear, the assistant asks before choosing a destination. The client may also invoke any exposed tool directly with `POST /api/v1/agent/conversations/{id}/tools` and `{ "tool": "list_postings", "args": {} }`; this keeps manual agent controls usable when tool selection is imperfect.

The `tools` response lists exact names and access levels. Current resident tools include sourced discovery search/detail/official handoffs, saved items and checklists, public postings, private profile and résumé actions, application submission and messages, feedback receipts/replies/reopening, and emergency guidance. Current employee tools include public discovery, organization feedback and applications, feedback analytics, theme overview/detail/refresh, organization posting creation/editing/publication/closure, applicant messages and decisions, a shared résumé download path, taxonomy version history/draft/preview/publication, and classification review/correction. Binary résumé upload and evidence upload remain the existing manual file controls; the agent can use already uploaded assets. New manual API actions should be added to `apps/worker/src/features/agents/tools.ts` when introduced.

Writes are stored in D1 with a path, method, body, destination, and expiry in a preview card. `POST /api/v1/agent/conversations/{id}/proposals/{proposalId}/approve` with `{ "approved": true }` executes one proposal; `.../reject` discards it. New feedback also requires `{ "approved": true, "sandboxAcknowledged": true }`. An approval expires after 30 minutes. The Worker derives a stable idempotency key and reruns the underlying API handler with the caller's **current** Authorization and receipt token headers, so role, ownership, organization, status transition, and target checks happen again. For status and message changes, the preview also captures the record's `updatedAt` and rejects stale approvals. Resident feedback receipt tokens are HMAC-derived from the proposal and returned only to the client, never saved in conversation history or proposal results.

Each tool links to the same `/api/v1` resource as its manual counterpart. A guest reading or replying to feedback must pass `X-Receipt-Token`; the model never receives the token. A signed-in applicant action requires the same Auth0 permission as the manual API. A staff action is restricted to the actor's organization and role. No model output can directly execute a write.

## How to change it

Add a new typed entry in `apps/worker/src/features/agents/tools.ts`, with a fixed route builder, parameter validation, method, target feature handler, and `read` or `write` access. Avoid accepting arbitrary URLs or an organization ID from model arguments. Update `systemPrompt` if the assistant's behavior changes, and add the corresponding UI preview/rendering. The table migration is `packages/db/migrations/0007_agent_conversations.sql`. Keep tool payloads small and exclude access tokens, private receipt tokens, and raw uploaded files from stored arguments or model messages.

## Configuration

`[ai] binding = "AI"` in `apps/worker/wrangler.toml` provides Workers AI. The model and 200-inference-per-UTC-day application cap are in `apps/worker/src/features/agents/index.ts`; the cap is persisted in D1 to limit free-credit use. `FEEDBACK_ABUSE_HMAC_KEY` must have at least 32 characters for feedback approval. Auth0 variables and D1/R2 bindings are shared with the existing Worker. The Worker must allow the `X-Conversation-Token` CORS header. There is no paid AI fallback: if the binding or free quota is unavailable, message generation returns `AI_UNAVAILABLE`, while direct read tools and proposal approvals still use the Worker API.

## Dependencies

Cloudflare Workers AI, D1, existing Auth0 identity mapping, application, profile, source, and feedback feature handlers. The browser and SwiftUI clients keep the guest conversation token securely and render proposal cards with a clear approve/reject choice.
