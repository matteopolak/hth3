# Official source ingestion

## What it is

An adapter imports three federal **finder links** (jobs, benefits, and funding) and actual Service BC office locations. Finder records lead people to the publisher's live search or application site; they are not individual vacancies, benefit eligibility decisions, or open grant calls.

## How it works

`fetchOfficialRecords` retrieves the known federal pages, checks that each still identifies itself, and records a hash, fetch time, expiry, source URL, publisher, and official terms URL. It uses our own short descriptions and does not copy the pages. The Service BC adapter queries the [official ArcGIS layer](https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/bcgw_pub_whse_imagery_and_base_maps/MapServer/51), validates the office fields, and imports the published names, addresses, and coordinates. The [BC catalogue](https://catalogue.data.gov.bc.ca/dataset/service-bc-office-locations) labels this dataset under the Open Government Licence – British Columbia, which requires attribution. A record points to the official office page when the dataset supplies one, or to the catalogue otherwise. The licence link and publisher accompany every location.

`ingestOfficialSources(database)` writes records to `source_records`, their kind and coordinates to `source_record_details`, and source health to `source_registry`. Migration `0009_official_sources.sql` adds the detail table and two registry sources. A successful refresh marks missing BC offices stale; a failed fetch marks the source and its records as errors. Errors never cause generated replacements. No public HTTP ingestion route exists: call the function from a trusted operator or scheduled Worker entry point.

Records expire after 14 days for finder links and seven days for BC offices. `verified` in the current source API means the source was fetched successfully under permitted terms and is within that freshness window. It does **not** mean a job, benefit, grant, or office is currently accepting a particular request. Before visiting an office, users must confirm hours and services on its official site.

## How to change it

Add a source adapter in `packages/sources/src/official.ts` with a publisher URL, a parser that fails closed when the format changes, an expiry, and a source registry row. Preserve a stable publisher ID, original URL, raw payload hash, and licence/terms link. Add a new `kind` constraint in the migration and its consumer before introducing new record types. Avoid treating historical federal advertisement datasets or grants award disclosures as live opportunities. For a real vacancy/grant, implement a separate current-opportunity adapter and verify its application link and deadline.

The ArcGIS layer currently reports a maximum of 1,000 records. The adapter rejects `exceededTransferLimit`; implement pagination before using a larger layer. `GET /api/v1/source-records` and its detail route join `source_record_details` and expose `kind` and `coordinates` for official records. Sample records retain null values. The Worker package and entry point must import `@civicresolve/sources` and call `ingestOfficialSources`; no automatic schedule is installed by this module.

## Configuration

No API key is required. Apply D1 migrations through `0009_official_sources.sql`. The source URLs, acceptable page identity text, maximum response sizes, and expiry intervals are constants in `official.ts`. The default network timeout is 12 seconds per source.

## Dependencies

The adapter uses the official [Government of Canada jobs](https://www.canada.ca/en/services/jobs/opportunities/government.html), [Benefits Finder](https://www.canada.ca/en/services/benefits/finder.html), and [grants and funding](https://www.canada.ca/en/government/grants-funding.html) entry points, plus the Service BC ArcGIS layer. Federal pages' [Canada.ca terms](https://www.canada.ca/en/transparency/terms.html) permit linking and describe reproduction conditions; this adapter stores only link metadata and original descriptions. BC location data is used with [BC OGL attribution](https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc). Code dependencies are `@civicresolve/sources`, D1, and the Worker runtime's `fetch` and Web Crypto APIs.
