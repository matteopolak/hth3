# External application preparation

## What it is

An applicant can organize answers and a personal checklist for a sourced external opportunity, download notes, and continue on the publisher’s official site. Envoy records only `prepared-for-external`; opening a link or saving notes never records an external submission.

## How it works

`GET /api/v1/external-preparations/{recordId}` is public. It returns a blank preparation for guests and the caller’s saved draft when a valid applicant token is present. The record must be an `official_external` source with reviewed permitted terms and an HTTPS URL. Source attribution, jurisdiction, freshness, and the destination come from the source record; Envoy does not infer requirements or eligibility.

Authenticated applicants use `PUT` and `DELETE` on that path to save or remove a draft. `GET /api/v1/external-preparations` lists the caller’s preparations. `GET /api/v1/external-preparations/{recordId}/export?locale=en|fr` returns a plain text document from the saved draft, or a blank template for guests. The browser also downloads its current unsaved notes, so signing in is only necessary for private persistence.

Reusable answers are private to the applicant: `GET /api/v1/external-preparations/answers`, `PUT /api/v1/external-preparations/answers/{id}`, and `DELETE /api/v1/external-preparations/answers/{id}`. The web drawer inserts a saved answer into the current draft, where the applicant can edit it before export or save.

The D1 migration is `0018_external_preparations.sql`. The database constraint permits only `prepared-for-external` and keys every draft by `(owner_subject, record_id)`. Neither external portal credentials nor official submission receipts are stored.

## How to change it

Validation, limits, status, and text export live in `packages/domain/src/external-preparation/index.ts`. Worker authorization and source checks live in `apps/worker/src/features/external-preparation/index.ts`. The standalone web page is `apps/web/src/features/external-preparation/index.ts` with its own stylesheet. Mount `handleExternalPreparationRequest` in the Worker router and call `createExternalPreparationPage({ recordId, locale, token, onBack, onSignIn })` from a source detail or activity route.

If an official integration is added later, give it a separate submission resource and confirmed receipt. Do not relax this preparation status or mark an external application submitted from a link click.

## Configuration

The web module uses `VITE_API_BASE_URL` or local `http://localhost:8787/api/v1`. Applicant save needs the existing Auth0 bearer token with `write:profile`. Guests can read, edit locally, export locally, and open the official URL.

## Dependencies

The feature uses the source registry, D1, Auth0 applicant authorization, `@civicresolve/domain/external-preparation`, and Lucide icons. It does not call or automate external application portals.
