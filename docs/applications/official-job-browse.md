# Official job browsing

## What it is

Envoy's Apply for work page shows current, individually sourced public-sector vacancies and any verified participating employers. Official job boards are a separate fallback. The seeded practice employer stays available to internal API checks but is hidden from ordinary public browsing.

## How it works

`apps/web/src/features/applications/api.ts` fetches `GET /api/v1/discovery?area=jobs&type=job_posting` for individual vacancies and a separate `jobs_finder` query with `includeFinders=true` for official boards. The page admits only current, verified, non-closed external job postings with an HTTPS publisher handoff. It filters `sample` first-party postings returned by `/postings`; real participating employer postings remain available for in-app application. When there are no participating employers, the page starts on Official sources.

Each vacancy shows its publisher, sourced location, posting date, and closing date when provided. The primary action opens the publisher's exact job posting. The optional preparation action stores answers for an external application; it does not submit anything to the publisher. Finder links lead to a publisher search page and are labeled as job boards, not individual vacancies. Existing practice applications remain visible in the owner's private My applications history with their truthful label.

## How to change it

Keep the two discovery queries separate. A `jobs_finder` result must never appear as a current individual vacancy. Keep the `verified`, `freshness`, closing status, source URL, and handoff checks when changing the official result filter. If the public posting API later excludes practice records by default, the client-side sample filter can remain as a defensive boundary. Add new detail facts only when the discovery API provides their provenance.

## Configuration

`VITE_API_BASE_URL` selects the Worker API; it defaults to `http://localhost:8787/api/v1` for local development. Discovery defaults exclude samples, stale listings, closed listings, and finder links unless the caller explicitly asks for them. The public applications page does not expose a practice-mode switch.

## Dependencies

The Worker discovery API and official source ingestion, the public posting API, the external preparation feature, and the web application module. The verified employer publish boundary lives in the Worker employer feature.
