# Official source ingestion

## What it is

The source ingestion flow publishes verified official discovery links and individual, source-backed vacancies and programs for jobs, support, funding, offices, and participation. Finder records remain separate from individual opportunities. A finder is not a vacancy, eligibility decision, open award, application, or specific office.

## How it works

`fetchOfficialRecords` in `packages/sources/src/official.ts` combines independent federal, BC, Ontario, and direct-vacancy adapters. Each known page is fetched from an allowlisted official URL; adapters check expected page identity before emitting their own short description, source and evidence URL, publisher, terms link, fetch time, expiry, and payload hash. The page body is not republished. A failed HTTP response, off-origin redirect, identity check, oversized body, or malformed directory becomes a per-source failure with no invented replacement record. One unavailable publisher does not block the other adapters. The vacancy adapters collect direct federal student inventory, BC Public Service, Ottawa, and Toronto posting URLs; each listing keeps its own publisher ID, location and dates when published, and application status.

The BC adapter also queries the [Service BC ArcGIS layer](https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/bcgw_pub_whse_imagery_and_base_maps/MapServer/51). It imports published office names, addresses, and valid coordinates with [BC Open Government Licence](https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc) attribution. An office links to its official page if the dataset supplies an acceptable one, or to the [data catalogue](https://catalogue.data.gov.bc.ca/dataset/service-bc-office-locations). The Ontario ServiceOntario and federal Service Canada location finders are link-only records without coordinates; they are never plotted as individual office pins.

The trusted `ingestOfficialSources(database)` Worker flow writes `source_records`, `source_record_details`, `source_record_listings`, and `source_registry` health. It also assigns a `discovery_record_areas` category for each verified record: jobs, support, funding, nearby, or participation. A successful fetch refreshes record and registry publisher, jurisdiction, licence, and terms provenance from the adapter; record destination and evidence URLs also refresh. Registry destination URL changes require a migration. A complete directory or vacancy refresh marks omitted records stale; a failed source fetch marks its registry and existing records `error`. Fetch and verification timestamps remain visible through the public source API. No public ingestion route exists; `POST /api/v1/staff/sources/refresh` requires a curator bearer token and refreshes only vacancy adapters. A D1 audit row prevents a second start in the same five-minute window.

The scheduled Worker refreshes all sources when the BC office source is due (daily), and refreshes the four vacancy adapters when any vacancy source is due (every six hours). Failed sources retry after 15 minutes. The city adapters expire postings after 12 hours; the shorter refresh interval keeps current listings visible. Federal jobs and consultation links expire after seven days, federal benefits, funding, and Service Canada finder links after 30 days, and BC and Ontario finder records after seven days. A redirect to a different origin fails the source and leaves existing records visibly in an error state; it is not accepted as proof that the official page was checked. `verified` means the link or licensed row was fetched successfully and remains within its freshness window. It does not certify that a program or office currently accepts a request. Users should confirm current details on the publisher site.

## How to change it

Add or change federal links in `packages/sources/src/adapters/federal/index.ts`, BC links and offices in `adapters/bc/index.ts`, Ontario links in `adapters/ontario/index.ts`, and individual vacancies in `adapters/federal/vacancies.ts`, `adapters/vacancies/index.ts`, and `adapters/city-jobs/index.ts`. Keep IDs stable across the adapter, `source_registry`, and source records. A new adapter may supply registry metadata for a new source; an existing registry's destination URL still requires a migration. Update `areaForRecord` in the Worker ingestion service when adding a new discovery category. Add a kind constraint and consumer before introducing a new record kind.

Each adapter must retain source provenance, a publisher ID where available, an evidence URL, terms or licence link, an expiry rule, and a fail-closed identity/schema check. For a new individual listing, set `listing.category`, `applicationStatus`, and source-backed dates and location; leave unavailable fields null. Report a source in `refreshedSourceIds` only after a complete scan, so omitted records can be marked stale safely. The BC layer currently caps transfers at 1,000 records; implement pagination before using a larger layer. Historical advertisement and award datasets are not live opportunities.

`GET /api/v1/source-records` and its detail route expose provenance, `kind`, and coordinates when available. Sample records retain null official details and remain unverified. See [BC and Ontario official sources](bc-ontario-sources.md) for provincial coverage and limits.

## Configuration

No API key is required. Apply D1 migrations through `0028_individual_programs.sql` before refreshing individual listings. Source URLs, identity text, response size caps, and expiry rules are constants in the adapters; network timeouts are 12 seconds. Link-only entries record [Canada.ca terms](https://www.canada.ca/en/transparency/terms.html), [BC page copyright](https://www2.gov.bc.ca/gov/content/home/copyright), or [Ontario terms](https://www.ontario.ca/page/terms-use), as appropriate. A general Ontario web page is not treated as an open-data-licensed dataset.

For an immediate vacancy refresh after migration and deploy, a curator can call `POST /api/v1/staff/sources/refresh` with a valid bearer token. If no curator token is available, an operator with Wrangler production access can run the local SQL export and authenticated D1 import:

```sh
./node_modules/.bin/tsc -p packages/sources/tsconfig.build.json
node scripts/prepare-official-vacancies.mjs /tmp/envoy-official-vacancies.sql
cd apps/worker
./node_modules/.bin/wrangler d1 execute civicresolve-prod --remote --env production --file /tmp/envoy-official-vacancies.sql
```

The exporter calls the same four official vacancy adapters as the Worker, writes no file if any source fails or the full source set is absent, validates identifiers and direct HTTPS evidence, and includes only current individual postings. Review the printed source counts and SQL before applying it. The SQL is idempotent: it marks previously imported listings stale, upserts the current records and listing metadata, and respects curator-controlled registry terms. No public refresh endpoint is involved. The remote-preview scheduled test route did not invoke the handler in the production Worker with Wrangler 4.113.0, so use this CLI flow for the immediate import.

On September 26, 2026, direct automated fetches of Ontario.ca pages returned HTTP 403, and the Ontario jobs portal had previously returned a CAPTCHA. The Ontario adapter leaves those sources in an error or unknown state instead of copying or bypassing them. A prior remote Worker preview returned 65 Service BC offices and three BC finder links; Canada.ca returned HTTP 520 in that preview. These are observed results, not guaranteed future counts. The adapters preserve and expose the next fetch outcome, including safe HTTP, timeout, network, invalid JSON, and identity error codes.

## Dependencies

The adapters use official publisher sites, the Worker runtime `fetch` and Web Crypto APIs, `@civicresolve/sources` types, and D1 source and discovery tables. The Worker source ingestion service connects these adapters to the scheduled refresh and public source API. The explicit refresh route additionally depends on Auth0 bearer validation, `source:manage` authorization, and the D1 audit table; the one-time preview path depends on Wrangler access to the production Cloudflare account.
