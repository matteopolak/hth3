# Grounded theme clustering

## What it is

The optional grounded-themes path uses Workers AI embeddings and Vectorize to propose semantically similar feedback within an organization's published category. Workers AI can then write a short English and French summary from redacted, linked submissions. D1 remains the source of truth for every count and membership.

## How it works

`POST /api/v1/staff/organizations/:organizationId/themes/refresh` first reads the organization's submissions and exact category information from D1. If the explicit no-charge gate is on and there are 3–24 submissions, Envoy redacts direct contact details, embeds each report with `@cf/google/embeddinggemma-300m`, and upserts vectors into an organization/category namespace. Vectorize supplies same-category candidate pairs; the current small batch is also compared locally because new upserts are not immediately queryable. A high cosine threshold groups candidate reports into one primary theme. No raw submission text is stored in Vectorize metadata.

Groups of at least three can receive a Granite Micro summary. The prompt contains only up to five redacted source excerpts with IDs. The response must name IDs from that input; invalid responses fall back to deterministic copy. SQL joins calculate exact theme, category, trend, and unanswered counts. The API exposes `summaryMethod` and source IDs. The refresh response exposes `grounding.status` (`disabled`, `capacity_limit`, `provider_unavailable`, or `grounded`) and `manualReview` so provider failure is visible.

Staff can manually place a submission in a theme by `POST /api/v1/staff/organizations/:organizationId/themes/:themeId/memberships` with `{ "submissionId": "fb_..." }`. The route enforces organization and category boundaries, marks the membership as staff reviewed, rebuilds the affected summaries from actual D1 memberships, and emits an outbox event. Later automatic refreshes preserve the staff choice. The detail route still exposes original submissions for verification.

## How to change it

The orchestration and SQL projection are in `apps/worker/src/features/themes/index.ts`. Redaction and model response validation are in `apps/worker/src/integrations/workers-ai/grounded-themes.ts`; candidate search and cosine validation are in `apps/worker/src/integrations/vectorize/themes.ts`. Keep the 24-submission bound until there is a safe usage budget and pagination. If the embedding model changes, update the index dimension and rebuild derived vectors. Never use model text as a numerical count or let a model move a staff-reviewed membership.

There is no live Vectorize index yet. Cloudflare's [Vectorize pricing page](https://developers.cloudflare.com/vectorize/platform/pricing/) lists a Workers Free allocation of 30 million queried dimensions per month and 5 million stored dimensions, while its [Workers pricing page](https://developers.cloudflare.com/workers/platform/pricing/) currently says Vectorize requires Workers Paid. Resolve this contradiction and verify this account's Free plan and usage before creating an index or enabling the path. No-charge acceptance is therefore still open. The existing deterministic theme path remains usable.

## Configuration

The feature stays off unless both `THEME_AI_ENABLED=true` and `THEME_AI_NO_CHARGE_CONFIRMED=true` are set **and** the Worker has `AI` and `THEME_VECTORS` bindings. The latter is deliberately absent from `wrangler.toml` until the no-charge account status is confirmed. When safe, create a 768-dimension cosine index for `@cf/google/embeddinggemma-300m`, add a `THEME_VECTORS` Vectorize binding for the appropriate environment, and set both flags only within a verified no-charge allocation. Keep credentials in Cloudflare secrets, never in source.

The model IDs, 24-submission cap, 0.84 cosine threshold, and five-source summary cap are constants in the integration files. The embedding model is multilingual, covering English and French reports. Workers AI Free provides [10,000 Neurons per day](https://developers.cloudflare.com/workers-ai/platform/pricing/) and fails when exhausted; a Paid account can bill beyond its allocation, which is why the gate requires account verification.

## Dependencies

This feature uses existing D1 feedback and theme tables, the organization permission check, outbox delivery to Tiger, the Workers AI binding, and an optional Vectorize index. Vectorize is a rebuildable candidate store; deleting its vectors does not delete submissions or theme memberships. On binding, quota, or model failures, the existing deterministic grouping and summary path returns a visible fallback status.
