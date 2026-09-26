# Grounded theme clustering

## What it is

The optional grounded-themes path uses Workers AI embeddings and Vectorize to propose semantically similar feedback within an organization's published category. Workers AI can then write a short English and French summary from redacted, linked submissions. D1 remains the source of truth for every count and membership.

## How it works

`POST /api/v1/staff/organizations/:organizationId/themes/refresh` rebuilds the default lexical projection and exact counts in D1. With the explicit no-charge gate enabled, `POST /api/v1/staff/organizations/:organizationId/themes/candidates` redacts contact details, embeds up to 24 eligible reports with `@cf/google/embeddinggemma-300m`, and upserts vectors into organization/category namespaces. Vectorize supplies same-category candidate pairs; the bounded current batch is also compared locally because new upserts are not immediately queryable. A high cosine threshold produces **review-required suggestions**. Semantic suggestions never move a membership automatically. No raw submission text is stored in Vectorize metadata. Sensitive categories are excluded from this path.

Eligible groups of at least three can receive a Granite Micro summary. The prompt contains only up to five redacted source excerpts with IDs. The response must name IDs from that input; invalid responses fall back to deterministic copy. The validator accepts either direct translated strings or the model's `summary`/`requestedChange` object form and converts it to text. SQL joins calculate exact theme, category, trend, and unanswered counts. The API exposes `summaryMethod` and source IDs. The candidate route exposes provider availability and manual-review state so failures remain visible.

Staff can manually place a submission in a theme by `POST /api/v1/staff/organizations/:organizationId/themes/:themeId/memberships` with `{ "submissionId": "fb_..." }`. The route enforces organization and category boundaries, marks the membership as staff reviewed, rebuilds the affected summaries from actual D1 memberships, and emits an outbox event. Later automatic refreshes preserve the staff choice. The detail route still exposes original submissions for verification.

## How to change it

The orchestration and SQL projection are in `apps/worker/src/features/themes/index.ts`. Redaction and model response validation are in `packages/ai/src/workers-ai/grounded-themes.ts`; candidate search and cosine validation are in `packages/ai/src/vectorize/themes.ts`. The Worker integration paths are re-exports that keep handler imports stable. Keep the 24-submission bound until there is a safe usage budget and pagination. If the embedding model changes, update the index dimension and rebuild derived vectors. Never use model text as a numerical count or let a model move a staff-reviewed membership.

The matteopolak account's Cloudflare dashboard showed **Workers Free — Current plan** on September 26, 2026. Its plan table included 30 million queried Vectorize dimensions monthly, 5 million stored dimensions, and 10,000 Workers AI Neurons daily; Paid was offered as an upgrade. This account-specific result resolves the disagreement between Cloudflare's [Vectorize pricing page](https://developers.cloudflare.com/vectorize/platform/pricing/) and its [Workers pricing page](https://developers.cloudflare.com/workers/platform/pricing/). The `envoy-feedback-themes` 768-dimension cosine index was created under that Free plan. A bounded live probe returned three 768-dimensional embeddings and an evidence-linked Granite response. After asynchronous indexing, Vectorize reported three vectors and returned 0.9137 similarity for two related streetlight reports versus 0.7558 for an unrelated fountain report. The authenticated staff route still needs live acceptance after deployment.

## Configuration

The feature stays off unless both `THEME_AI_ENABLED=true` and `THEME_AI_NO_CHARGE_CONFIRMED=true` are set **and** the Worker has `AI` and `THEME_VECTORS` bindings. Production Wrangler sets both flags and binds `THEME_VECTORS` to the Free-plan `envoy-feedback-themes` index; retain this configuration only while the account remains on Workers Free. Keep credentials in Cloudflare secrets, never in source. Recheck the account plan before enabling in another environment.

The model IDs, 24-submission cap, 0.84 cosine threshold, and five-source summary cap are constants in the integration files. The embedding model is multilingual, covering English and French reports. Workers AI Free provides [10,000 Neurons per day](https://developers.cloudflare.com/workers-ai/platform/pricing/) and fails when exhausted; a Paid account can bill beyond its allocation, which is why the gate requires account verification.

## Dependencies

This feature uses existing D1 feedback and theme tables, the organization permission check, outbox delivery to Tiger, the Workers AI binding, and a Vectorize index. Vectorize is a rebuildable candidate store; deleting its vectors does not delete submissions or theme memberships. On binding, quota, or model failures, the existing deterministic grouping and summary path returns a visible fallback status.
