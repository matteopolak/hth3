# Official participation sources

## What it is

Envoy lists selected federal, British Columbia, and Ontario consultations alongside official directories. Every action is a handoff to the publisher. Envoy does not submit comments to these external consultations or record them as submitted.

## How it works

Migration `0021_consultations.sql` seeds four individually reviewed opportunities and three directories. Each row carries an official destination, an evidence URL, publisher, jurisdiction, source state, the review and expiry times, and a deadline only when the individual publisher published one. The initial review was on 2026-09-26. The individual source pages are [Canada Water Agency](https://www.canada.ca/en/canada-water-agency/national-water-security-strategy/public-engagement-towards-nwss.html), [BC Parks Cypress Mountain](https://engage.gov.bc.ca/govtogetherbc/engagement/cypress-mountain-ski-resort-development-plan/), [BC Wildfire Service app survey](https://engage.gov.bc.ca/govtogetherbc/engagement/bc-wildfire-service-app/), and [Ontario ERO notice 026-0936](https://ero.ontario.ca/notice/026-0936). These are metadata and original short summaries, not copied consultation documents.

`GET /api/v1/consultations` optionally filters by `jurisdiction=CA|CA-BC|CA-ON`. `GET /api/v1/consultations/{id}` returns one item. `GET /api/v1/consultations/{id}/handoff` returns the official URL and an explicit instruction to complete participation there. No write route is exposed. The response marks `externalOnly: true` and `inAppSubmission: false`.

`toConsultation` turns a stored `current` source into `stale` after `expiresAt`. For date-only deadlines, B.C. uses the Vancouver calendar date and Ontario uses the Toronto calendar date. On the deadline date the response says `check_official_source`, because the publisher's closing time is not stored; provincial records are marked `closed` only after that local date ends. Federal deadlines span multiple time zones, so the route switches to `check_official_source` on the earliest Canadian calendar date boundary and never infers `closed` automatically. Invalid or missing deadline dates also require checking the publisher. Stale/error sources use `check_official_source`; directories always use `directory`. Exact closing times, eligibility, and any changed status remain on the publisher’s page.

## How to change it

Review each official page and its participation destination before changing a deadline, opening, or description. Update the row in `consultations` using a new migration or an operator script, set `verified_at` to the actual review time, and set a short `expires_at`. Put the publisher’s URL in `official_url` and the page supporting the metadata in `evidence_url`. Never extend the source expiry merely because a calendar deadline is in the future. The output mapping and status logic are in `packages/sources/src/adapters/consultations/index.ts`; the read API is in `apps/worker/src/features/consultations/index.ts`. Add a first-party response flow only after a real organization is onboarded and there is a separate, authorized submission path.

## Configuration

Apply D1 migrations through `0021_consultations.sql`. There are no credentials or feature flags. The initial snapshot expires at `2026-10-03T20:20:00Z`; refresh it from primary pages before demonstrating an “open” status after that date.

## Dependencies

The feature uses Cloudflare D1, `@civicresolve/sources` for response mapping, and the Worker shared API helpers. It depends on the official Government of Canada, govTogetherBC, and Environmental Registry of Ontario pages for reviewable dates and handoff URLs.
