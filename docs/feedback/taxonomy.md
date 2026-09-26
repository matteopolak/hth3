# Feedback taxonomy and classification

## What it is

Each civic organization has a bilingual, versioned category taxonomy. Staff can prepare and publish a draft without deploying code. New feedback receives a Workers AI category proposal against the published version; uncertain or unavailable inference goes to `other_or_unsure` for review.

## How it works

Migration `0008_taxonomy.sql` seeds 31 Canada-oriented categories in six groups for the fictional Toronto sandbox organization. Categories describe possible _topics_, not verified government jurisdiction. Their destination is the fictional Envoy general review queue. Each version stores a complete JSON snapshot. Publishing marks the old version `superseded` and the draft `published`; old classifications retain their version ID and category ID.

`POST /api/v1/feedback` creates a resident submission. The Worker should call `classifyFeedbackSubmission(env.DB, env.AI, submissionId)` after the durable write. It sends bounded original text and published descriptions/examples to the configured Workers AI model. The model returns a proposal only; the domain validator rejects retired or unknown IDs and low confidence. The Worker saves a classification, current category/intent, assignment, audit event, and outbox event. AI failure saves a fallback `other_or_unsure` decision and marks it for review. The resident's original wording remains unchanged.

The staff API is scoped under `/api/v1/staff/organizations/:organizationId`:

- `GET /taxonomy` reads the published version; authorized admins also see the draft and departments.
- `GET /taxonomy/versions` lists up to 50 versions; `GET /taxonomy/versions/:id` opens a historical snapshot.
- `POST /taxonomy/draft` copies the current published version.
- `PATCH /taxonomy/draft` replaces the draft document after validation.
- `POST /taxonomy/preview` classifies up to 5,000 characters against both versions without saving it.
- `POST /taxonomy/publish` activates the draft atomically.
- `GET /feedback/:id/classification` reads the current classification.
- `POST /feedback/:id/classification` records a staff correction with `{ "categoryId": "roads_potholes", "intent": "complaint", "reason": "Resident describes road surface damage" }`.

Publishing requires unique stable IDs, bilingual names and descriptions, valid groups and active destination departments, and an active `other_or_unsure` route. A category's jurisdiction level must match its department's level; an internal `review_only` route can receive cross-jurisdiction topics without claiming a government destination. Provincial, federal, and mixed topics classified for the municipal sandbox are marked for staff route review. Retirement keeps the category in history while excluding it from new model choices. `curator` and active organization admins can edit. Active civic staff and organization admins can read and correct classifications within their organization. The token role and D1 membership are both checked.

## How to change it

Change validation and types in `packages/domain/src/taxonomy/index.ts`. To adjust starter topics, change `packages/domain/src/taxonomy/starter.json` and create a **new** migration for existing databases; editing the old migration will not update deployed data. Change API behavior in `apps/worker/src/features/taxonomy/`; keep published snapshots immutable and preserve the `other_or_unsure` fallback. Expose new actions to the employee agent only with the same authorization and explicit write approval as the manual endpoint.

The legacy `feedback_submissions.category` column has a seven-value CHECK constraint. New taxonomy IDs are written to `category_id`; do not write them to the legacy column. Staff views and analytics should read `category_id` and `intent` for classified submissions.

## Configuration

The Worker needs a Cloudflare Workers AI `[ai]` binding named `AI`. Classification defaults to `@cf/ibm-granite/granite-4.0-h-micro`; pass another model ID to `classifyFeedbackSubmission` to change it. The provider must remain within the account's verified free allocation. Without a binding or on inference error, feedback still persists and is marked `needs_review`.

## Dependencies

This feature uses D1 migrations and outbox/audit tables, Auth0 role/scopes through the Worker identity adapter, the Cloudflare Workers AI binding, and the existing feedback submission flow. The model input/output shape follows [Cloudflare's Granite 4.0 H Micro documentation](https://developers.cloudflare.com/workers-ai/models/granite-4.0-h-micro/), and binding syntax follows [Cloudflare Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/).

## Live acceptance

On 2026-09-26, deployed Worker version `4e4165b1-cc2f-4e58-9a59-2be7a4cb40c4` accepted one fictional Toronto sandbox streetlight report. Production D1 saved provider `workers-ai`, model `@cf/ibm-granite/granite-4.0-h-micro`, published taxonomy version `1`, category `streetlights_signals`, intent `complaint`, model-reported confidence `0.95`, and review outcome `accepted`. The submission and classification IDs are `fb_89c88bd60db28a39b9e47faaa100d35a` and `fc_c7526048c45c44aca209ea60a64b8330`. The private receipt token and original message were not written to verification logs.

An earlier live call on the prior Worker version produced `other_or_unsure` with `needs_review` when the model response could not be parsed. The classifier now accepts both `response` and `choices[0].message.content` provider shapes and records a specific non-sensitive fallback reason. The live test ran on the verified Workers Free account. [Cloudflare's pricing documentation](https://developers.cloudflare.com/workers-ai/platform/pricing/) states that its 10,000 daily free Neurons have no paid overage on Workers Free; excess calls fail until reset. Confidence is the model's self-report, not a calibrated probability.
