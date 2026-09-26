# Public discovery and official handoff

## What it is

Envoy offers one public search and detail API for jobs, support, funding, nearby services, and civic participation. Records retain their publisher, source URL, terms, evidence, freshness, and sample status. Signed-in residents can save a record and maintain their own checklist.

## How it works

`GET /api/v1/discovery` reads permitted `source_records`, joins their `source_record_details` and optional `discovery_record_areas` rows, and accepts `q`, `area`, `type`, `location`, `jurisdiction`, `audience`, `status`, `source`, `language`, `freshness`, `limit`, `offset`, and `includeSamples=true`. Areas are `jobs`, `support`, `funding`, `nearby`, and `participation`. The default excludes all fictional samples. A province code in `location` or `jurisdiction` also includes federal entry points. Free-text `location` searches place names and office addresses. `source` is an exact source registry ID. `GET /api/v1/discovery/:id` returns one item with full provenance and coordinates when available.

`type` distinguishes `jobs_finder`, `benefits_finder`, `funding_finder`, `service_location`, `consultation_finder`, `source_record`, and `sample_record`. `audience` is a **navigation intent**, not an eligibility decision: `job_seekers`, `benefit_seekers`, `funding_seekers`, `service_visitors`, or `civic_participants`. Responses carry `navigationAudience` and `audienceBasis: "navigation_only"`. `status` filters the source record state: `verified`, `current`, `stale`, `expired`, `error`, or `unknown`. `verified` uses the source's permitted-terms and freshness check; it does not mean an individual job or consultation is open. The existing `freshness` filter remains an alias for the raw freshness state. The API deliberately does not accept `status=open` without an imported, sourced opportunity status.

For example, `/api/v1/discovery?type=service_location&location=Victoria&source=service-bc-office-locations&status=verified` finds currently verified Service BC offices in Victoria. `/api/v1/discovery?area=participation&audience=civic_participants&source=federal-consultations-finder` returns the federal consultation finder link, rather than asserting a particular consultation is open.

`GET /api/v1/discovery/:id/handoff` returns an HTTPS publisher URL only for a permitted real record. It never records an external application or consultation submission. The client opens the publisher site, where the visitor confirms current deadlines, hours, eligibility, and completion. Finder links for federal jobs, benefits, funding, and consultations lead to the publisher's live search; they are not individual opportunities. Service BC records are actual locations, but visitors should confirm hours before travelling. Stale records remain visible with their freshness state.

`GET /api/v1/discovery/saved` lists up to 100 of the signed-in resident's saves. `PUT /api/v1/discovery/saved/:id` saves a record and optionally replaces a checklist; `DELETE` removes it. Checklist entries use `{ "id": "step-1", "text": "Review requirements", "done": false }`, with at most 12 short, user-authored entries. A checked entry is only the resident's own note. Saved items require the Applicant role and `write:profile` permission. Sample saves and reads require `includeSamples=true` on each request.

Migration `0013_discovery.sql` adds saved items and optional area tags. It seeds the [Government of Canada consultations finder](https://www.canada.ca/en/government/system/consultations/consultingcanadians.html) as a reviewed official link. Its short description is Envoy's own text; it does not claim any particular consultation is currently open. The link was reviewed on 2026-09-26 and expires after 14 days until refreshed. The page's [Canada.ca terms](https://www.canada.ca/en/transparency/terms.html) govern reuse; this feature stores link metadata rather than republishing the page.

## How to change it

Add new records through the source registry and a terms-reviewed adapter. `source_record_details.kind` maps existing finder and location kinds to areas. For another kind, add a `discovery_record_areas` row at ingestion and extend `type` mapping only when the record has that shape. The audience mapping follows the area as a browsing intent; add sourced eligibility fields separately if a real program adapter supplies them. Do not guess live deadlines, opening status, or availability from a finder. Keep the source URL, evidence URL, publisher, and freshness truthful. Add area-specific filters only when the imported record schema has reliable corresponding fields. The Worker route is `apps/worker/src/features/discovery/index.ts`; the root Worker dispatches to `handleDiscoveryRequest`. Resident and staff agent tools should call the same route.

## Configuration

Apply D1 migrations through `0013_discovery.sql`. There are no new environment variables. API parameters are bounded to 100 results per page, a 120-character search, and 12 checklist entries. Account saves depend on the existing Auth0 Applicant role and `write:profile` scope. A browser client needs `GET`, `PUT`, and `DELETE` in the Worker's CORS methods.

## Dependencies

The feature uses `@civicresolve/db/d1`, `@civicresolve/sources`, the Worker Auth0 verifier, `@civicresolve/domain/permissions`, and Cloudflare D1. It consumes official source records imported by the source adapters, rather than scraping in a public request.
