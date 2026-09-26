# Official source ingestion

## What it is

The source ingestion flow publishes verified official **discovery links** for federal, BC, and Ontario jobs, support, funding, offices, and participation, plus individual Service BC office locations from licensed provincial data. A finder record is not a vacancy, eligibility decision, open award, application, or specific office.

## How it works

`fetchOfficialRecords` in `packages/sources/src/official.ts` combines independent federal, BC, and Ontario adapters. Each known page is fetched from an allowlisted official URL and checked for its expected identity before the adapter emits its own short description, source and evidence URL, publisher, terms link, fetch time, expiry, and payload hash. The page body is not republished. A failed HTTP response, identity check, oversized body, or malformed directory becomes a per-source failure with no invented replacement record. One unavailable publisher does not block the other adapters.

The BC adapter also queries the [Service BC ArcGIS layer](https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/bcgw_pub_whse_imagery_and_base_maps/MapServer/51). It imports published office names, addresses, and valid coordinates with [BC Open Government Licence](https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc) attribution. An office links to its official page if the dataset supplies an acceptable one, or to the [data catalogue](https://catalogue.data.gov.bc.ca/dataset/service-bc-office-locations). The Ontario ServiceOntario and federal Service Canada location finders are link-only records without coordinates; they are never plotted as individual office pins.

The trusted `ingestOfficialSources(database)` Worker flow writes `source_records`, `source_record_details`, and `source_registry` health. It also assigns a `discovery_record_areas` category for each verified record: jobs, support, funding, nearby, or participation. The record upsert refreshes the current official destination and evidence URL; registry URL changes require a migration. A successful BC directory refresh marks missing offices stale; a failed source fetch marks its registry and existing records `error`. Fetch and verification timestamps remain visible through the public source API. No public HTTP ingestion route exists.

The scheduled Worker refreshes sources when the BC office source is due, with a 15-minute retry after a failed BC refresh. This currently controls the combined fetch; per-source freshness is still tracked independently. Federal jobs and consultation links expire after seven days, federal benefits, funding, and Service Canada finder links after 30 days, and BC and Ontario records after seven days. `verified` means the link or licensed row was fetched successfully and remains within its freshness window. It does not certify that a program or office currently accepts a request. Users should confirm current details on the publisher site.

## How to change it

Add or change federal links in `packages/sources/src/adapters/federal/index.ts`, BC links and offices in `adapters/bc/index.ts`, and Ontario links in `adapters/ontario/index.ts`. Keep IDs stable across the adapter, `source_registry`, and source records. Add a registry migration before adding a source; migration `0023_expanded_official_sources.sql` adds the Ontario and Service Canada finders and updates the existing Ontario jobs source URL to the Ontario careers entry page. Update `areaForRecord` in the Worker ingestion service when adding a new discovery category. Add a kind constraint and consumer before introducing a new record kind.

Each adapter must retain source provenance, a publisher ID where available, an evidence URL, terms or licence link, an expiry rule, and a fail-closed identity/schema check. The BC layer currently caps transfers at 1,000 records; implement pagination before using a larger layer. A true vacancy, grant call, or individual Ontario office importer would need its own permitted source, publisher ID, current status or deadline, and application or location data. Historical advertisement and award datasets are not live opportunities.

`GET /api/v1/source-records` and its detail route expose provenance, `kind`, and coordinates when available. Sample records retain null official details and remain unverified. See [BC and Ontario official sources](bc-ontario-sources.md) for provincial coverage and limits.

## Configuration

No API key is required. Apply D1 migrations through `0023_expanded_official_sources.sql`. Source URLs, identity text, response size caps, and expiry rules are constants in the adapters; network timeouts are 12 seconds. Link-only entries record [Canada.ca terms](https://www.canada.ca/en/transparency/terms.html), [BC page copyright](https://www2.gov.bc.ca/gov/content/home/copyright), or [Ontario terms](https://www.ontario.ca/page/terms-use), as appropriate. A general Ontario web page is not treated as an open-data-licensed dataset.

On September 26, 2026, direct automated fetches of Ontario.ca pages returned HTTP 403, and the Ontario jobs portal had previously returned a CAPTCHA. The Ontario adapter leaves those sources in an error or unknown state instead of copying or bypassing them. A prior remote Worker preview returned 65 Service BC offices and three BC finder links; Canada.ca returned HTTP 520 in that preview. These are observed results, not guaranteed future counts. The adapters preserve and expose the next fetch outcome, including safe HTTP, timeout, network, invalid JSON, and identity error codes.

## Dependencies

The adapters use official publisher sites, the Worker runtime `fetch` and Web Crypto APIs, `@civicresolve/sources` types, and D1 source and discovery tables. The Worker source ingestion service connects these adapters to the scheduled refresh and public source API.
