# Feedback themes and staff overview

## What it is

Envoy groups persisted feedback within its current published taxonomy category by recurring issue terms and shows staff exact submission counts, trends, and source-linked summaries. The theme API is limited to staff with access to the organization.

## How it works

`GET /api/v1/staff/organizations/:organizationId/themes` returns D1 counts for the selected 1–90 day window: total and unanswered submissions, category, intent and status breakdowns, daily counts, plus persisted theme cards. "Unanswered" means no staff message yet and no recorded outcome or closed status. `days`, `category`, `department`, and `status` are optional query filters. Each metric explicitly counts **submissions**, not people. The current theme count and prior-window count come from membership joins; category and overview counts come directly from feedback submissions. Tiger's separate `/analytics` endpoint remains available for synchronized event history and lag information.

`POST /api/v1/staff/organizations/:organizationId/themes/refresh` rebuilds derived membership from current feedback classifications. Within each category, a report is grouped under a term repeated by at least three reports; reports without a repeated term remain in that category's general theme. A submission has one primary theme, and a classification correction or a new report can move membership during refresh. The refresh stores a bilingual summary and up to five representative source IDs. It emits `feedback.theme_membership_added` or `feedback.theme_membership_moved` events to the existing outbox for changed memberships only. Refresh does not call Workers AI or consume inference credits.

The GET routes detect missing or category-mismatched memberships and run the same projection refresh before returning, so newly submitted feedback appears without a manual refresh. The explicit POST remains useful when staff want to regenerate summaries after non-category edits.

`GET /api/v1/staff/organizations/:organizationId/themes/:themeId` returns the theme and a paginated list of original feedback sources. `limit` defaults to 50 and caps at 100; `offset` starts at 0. Source links point to the existing staff feedback endpoint, which enforces the same organization boundary. A summary is marked stale if any linked submission changed since it was generated.

The deterministic summary uses exact SQL counts and taxonomy names. For at least three submissions, it also names words repeated in three or more source submissions after email and phone-like strings are stripped. Smaller cohorts receive only a generic description and links, avoiding a quote from one resident. Staff can inspect the original submissions for nuance and requested changes.

## How to change it

The implementation is `apps/worker/src/features/themes/index.ts`; storage is `packages/db/migrations/0012_themes.sql`. The lexical grouping is intentionally simple and can split synonyms or group unrelated reports with the same term. Add richer similarity grouping by changing `groupSubmissions` while keeping the one-primary-theme membership rule. When introducing Workers AI summaries, validate free-plan availability before calls, redact private information, retain the exact SQL count, and keep source IDs and generation timestamps. Taxonomy names are read from the organization's published version, so category edits appear after refresh without code changes.

The feature handler must be called from the Worker router before its final 404. Its exported entry point is `handleThemesRequest(request, url, featureContext)`.

## Configuration

No new environment variables are required. The endpoint uses the existing `DB`, Auth0 configuration, and development authentication switch. It does not need an AI binding. Apply D1 migrations through `0012_themes.sql` before using the routes.

## Dependencies

It relies on D1 feedback submissions, published taxonomy versions, assignments, organization permissions, and the existing outbox. Tiger receives membership events through the established outbox delivery path. Staff authentication and organization authorization use the same modules as the feedback queue.
