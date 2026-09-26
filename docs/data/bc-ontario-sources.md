# BC and Ontario official sources

## What it is

The provincial adapters supply official discovery links for jobs, support, funding, and service locations. The BC adapter also imports individual Service BC office locations from a provincial ArcGIS layer. A finder link is not an open vacancy, award, eligibility decision, application, or office pin.

## How it works

`fetchBcOfficialRecords` verifies three BC finder pages and reads the published Service BC office layer. An office receives a stable ID from the provincial office code, a source URL, the original layer as evidence, a payload hash, and coordinates only when both coordinates are valid. The layer is checked for a transfer-limit response; a changed schema or empty directory fails rather than producing a partial current list.

`fetchOntarioOfficialRecords` checks four Ontario pages: Ontario Public Service careers, benefits and programs, available government funding, and the ServiceOntario location finder. It records only our short description and the original official URL. The ServiceOntario finder has `kind: null` because it does not identify a single physical office. Ontario pages and BC finders are link-only; their page bodies are used solely for an identity check and a hash.

Both adapters return `records` and per-source `failedSources`. They never produce a record after HTTP error, CAPTCHA/identity mismatch, oversized response, or malformed directory data. Successful records expire after seven days. The Worker ingestion flow sets last fetched and verified times, records errors, and marks omitted BC offices stale after a successful directory refresh. The public source API exposes freshness and verification timestamps so gaps remain visible.

| Coverage | Source | Mode | Limit |
| --- | --- | --- | --- |
| BC jobs | [Current B.C. Government job postings](https://www2.gov.bc.ca/gov/content/careers-myhr/job-seekers/current-job-postings) | Official link | No individual vacancy import |
| BC support | [B.C. Benefits Connector](https://www2.gov.bc.ca/bcbenefitsconnector) | Official link | No eligibility assertion |
| BC funding | [B.C. funding opportunities](https://www2.gov.bc.ca/gov/content/funding) | Official link | No individual award/call import |
| BC offices | [Service BC office locations](https://catalogue.data.gov.bc.ca/dataset/service-bc-office-locations) | Licensed ArcGIS data | Confirm hours and services at publisher |
| Ontario jobs | [Ontario Public Service careers](https://www.ontario.ca/page/careers-ontario-public-service) | Official link | No individual vacancy import |
| Ontario support | [Find benefits and programs](https://www.ontario.ca/page/find-benefits-and-programs) | Official link | No eligibility assertion |
| Ontario funding | [Available funding opportunities](https://www.ontario.ca/page/available-funding-opportunities-ontario-government) | Official link | No individual grant status import |
| Ontario offices | [ServiceOntario location finder](https://www.ontario.ca/locations/serviceontario/) | Official link | No office pins or hours import |

## How to change it

Edit `packages/sources/src/adapters/bc/index.ts` or `packages/sources/src/adapters/ontario/index.ts`. Keep source IDs stable because they join `source_registry` and `source_records`. Add the registry entry before adding a new source. A new individual vacancy, grant, or Ontario office importer needs a separate data licence review, stable publisher ID, current status/deadline or precise coordinates, and an explicit refresh policy. Do not parse a CAPTCHA or treat a blocked publisher response as verification.

The combined `fetchOfficialRecords` entry point in `packages/sources/src/official.ts` orchestrates provincial and federal adapters. The trusted scheduled Worker calls that entry point and persists provenance in D1; there is no public ingestion endpoint.

## Configuration

The known official URLs, expected page titles, response size caps, 12-second timeout, and seven-day expiry are constants in the adapters. There are no API keys. Ontario link-only pages use [Ontario terms](https://www.ontario.ca/page/terms-use); a general web page is **not** claimed to carry an Open Government Licence merely because an [Ontario licence](https://www.ontario.ca/page/open-government-licence-ontario) exists. BC office rows carry [Open Government Licence - British Columbia](https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc) attribution. BC link-only pages record [BC copyright terms](https://www2.gov.bc.ca/gov/content/home/copyright).

Ontario has returned HTTP 403 or a CAPTCHA to automated previews. Until a normal adapter fetch succeeds, its source registry can show an error or unknown freshness and there is no verified record. This is an intentional coverage gap; the official destination links can still be listed as unverified registry entries. The adapters do not retry through proxies or invent replacement data.

## Dependencies

The adapters use the Worker runtime `fetch` and Web Crypto APIs, `@civicresolve/sources` ingest types, the trusted Worker source-ingestion service, and D1 source registry and record tables. The BC office query uses the [Government of BC ArcGIS layer](https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/bcgw_pub_whse_imagery_and_base_maps/MapServer/51) exposed by the provincial data catalogue.
