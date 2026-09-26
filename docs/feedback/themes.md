# Feedback themes and staff overview

## What it is

Envoy groups persisted feedback within its current published taxonomy category by recurring issue terms and shows staff exact submission counts, trends, and source-linked summaries. The theme API is limited to staff with access to the organization.

## How it works

`GET /api/v1/staff/organizations/:organizationId/themes` returns D1 counts for the selected 1–90 day window: total and unanswered submissions, category, intent and status breakdowns, daily counts, plus persisted theme cards. "Unanswered" means no staff message yet and no recorded outcome or closed status. `days`, `category`, `department`, and `status` are optional query filters. Each metric explicitly counts **submissions**, not people. The current theme count and prior-window count come from membership joins; category and overview counts come directly from feedback submissions. `analyticsAsOf` is the latest feedback event time successfully delivered to Tiger; `analyticsPendingEvents` counts undelivered feedback events. A null `analyticsAsOf` means no event has been delivered. Tiger's separate `/analytics` endpoint provides its own event and aggregate views.

`POST /api/v1/staff/organizations/:organizationId/themes/refresh` rebuilds derived membership from current feedback classifications. By default, a report is grouped under a term repeated by at least three reports within its category; reports without a repeated term remain in that category's general theme. Sensitive categories use one general theme. A submission has one primary theme, and a classification correction or a new report can move an automatic membership. Staff-reviewed memberships stay fixed while their category remains valid. The refresh stores a bilingual summary and representative source IDs when allowed. It emits `feedback.theme_membership_added` or `feedback.theme_membership_moved` events to the existing outbox for changed memberships only. The optional, explicitly gated Workers AI and Vectorize path is documented in [Grounded theme clustering](../ai/grounded-themes.md).

The GET routes detect missing or category-mismatched memberships and run the same projection refresh before returning, so newly submitted feedback appears without a manual refresh. The explicit POST remains useful when staff want to regenerate summaries after non-category edits.

`GET /api/v1/staff/organizations/:organizationId/themes/:themeId` returns the theme and a paginated list of original feedback sources. `limit` defaults to 50 and caps at 100; `offset` starts at 0. Source links point to the existing staff feedback endpoint, which enforces the same organization boundary. A summary is marked stale if any linked submission changed since it was generated.

The deterministic summary uses exact SQL counts and taxonomy names. For at least three submissions in an allowlisted public-space or infrastructure category, it also names words repeated in three or more source submissions after private details are stripped. Smaller cohorts and all other categories, including new taxonomy categories, receive a generic category description. Their overview cards omit representative source IDs and set `summaryEvidenceRestricted=true`; authorized staff can still open the theme detail to review the original submissions. Summaries include `summaryGeneratedAt`, `summarySourceCount`, and `summaryStale` so staff can distinguish fresh evidence from later edits.

`POST /api/v1/staff/organizations/:organizationId/themes/candidates` asks the gated embeddings and Vectorize path for possible same-category moves. It returns pairs of source IDs, current and proposed theme IDs, and a similarity score with `reviewRequired=true`; it never moves a submission. It excludes sensitive categories and caps the batch at 24 submissions. Staff can accept a suggestion or make a manual correction with `POST /api/v1/staff/organizations/:organizationId/themes/:themeId/memberships` and `{ "submissionId": "fb_..." }`. This records an audited, staff-reviewed membership that later automatic refreshes preserve. Summaries for affected themes are rebuilt from their actual D1 memberships. The refresh response also includes candidate suggestions when grounding is available.

## How to change it

The implementation is `apps/worker/src/features/themes/index.ts`; grouping review and the public-space category allowlist are in `packages/domain/src/themes/index.ts`; storage is `packages/db/migrations/0012_themes.sql`. The lexical fallback can split synonyms or group unrelated reports with the same term. Keep the one-primary-theme rule and exact SQL counts when changing grouping. Similarity results are candidates until staff acts. Add a new category to the allowlist only after checking its privacy implications. Taxonomy names are read from the organization's published version, so category edits appear after refresh without code changes.

The feature handler must be called from the Worker router before its final 404. Its exported entry point is `handleThemesRequest(request, url, featureContext)`.

## Configuration

The deterministic endpoint needs no new environment variables. Optional grounding requires verified no-charge configuration, an AI binding, and a Vectorize binding as described in [Grounded theme clustering](../ai/grounded-themes.md). Apply D1 migrations through `0012_themes.sql` before using the routes.

## Dependencies

It relies on D1 feedback submissions, published taxonomy versions, assignments, organization permissions, and the existing outbox. Tiger receives membership events through the established outbox delivery path. Staff authentication and organization authorization use the same modules as the feedback queue.
