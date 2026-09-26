# Source catalog and coverage

Implementation status: federal finder links and Service BC office ingestion are implemented. A live remote fetch has not yet been accepted.

## What it is

This is the source-of-truth policy for Envoy's Canada-wide discovery features. The first release targets useful federal, British Columbia, and Ontario coverage; it does not infer missing listings or imply that all jurisdictions are complete.

## How it works

The public catalog distinguishes three record origins: `verified_external` (a current, attributable official source), `participating_org` (authored by a verified organization in Envoy), and `sample` (fictional demonstration content). A sample record is visibly labeled in every surface, excluded from the default real-results search, and never given an official application outcome. Record details show source, publisher, jurisdiction, original URL, last verification, deadline/expiry when relevant, and the true action destination.

Collection is source-specific:

| Area                       | Initial sources                                                                                                                                                                                                | Collection decision                                                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Federal jobs               | [GC Jobs](https://www.canada.ca/en/services/jobs/opportunities/government.html)                                                                                                                                | Official-link records until permitted machine access is confirmed. The [Job Bank monthly open dataset](https://open.canada.ca/data/en/dataset/ea639e28-c0fc-48bf-b5dd-b8899bd43072) is historical, not a live GC Jobs application feed. |
| BC/Ontario government jobs | [BC Public Service](https://www2.gov.bc.ca/gov/content/careers-myhr/job-seekers/current-job-postings), [Ontario Public Service](https://www.gojobs.gov.on.ca/Jobs.aspx)                                        | Source-specific, terms-reviewed adapters or curated official links. Do not scrape authenticated application pages.                                                                                                                      |
| Federal benefits           | [Benefits Finder](https://www.canada.ca/en/services/benefits/finder.html)                                                                                                                                      | Federal navigation and official application links. It does not contain all provincial benefits or provide a single application endpoint.                                                                                                |
| Food and community support | [211 Canada](https://211.ca/data/), provincial income-support sites                                                                                                                                            | Request 211's API/map-ready data agreement; otherwise link to its directory. No national Canadian SNAP-style application.                                                                                                               |
| Grants/student aid         | [Federal grants](https://www.canada.ca/en/government/grants-funding.html), [student-aid jurisdiction links](https://www.canada.ca/en/services/benefits/education/student-aid/grants-loans/province-apply.html) | Current program pages and deadlines. Disclosed past awards are not open opportunities.                                                                                                                                                  |
| Government offices         | [Service Canada offices](https://offices.service.canada.ca/en), [ServiceOntario](https://www.ontario.ca/locations/serviceontario/)                                                                             | Verify public access, services, hours, and accessibility before displaying a pin. Federal real-property inventories alone do not prove public access.                                                                                   |
| Consultations              | [Federal consultations dataset](https://open.canada.ca/data/en/dataset/7c03f039-3753-4093-af60-74b0f7b2385d), [BC engagement](https://engage.gov.bc.ca/)                                                       | Federal CSV is suitable for an adapter. Provincial and municipal portals need separate adapters or official links.                                                                                                                      |

The [Open Government CKAN API](https://open.canada.ca/en/access-our-application-programming-interface-api) discovers datasets; it does not automatically expose live jobs, offices, or applications. Sources published under the [Open Government Licence](https://open.canada.ca/en/open-government-licence-canada) require attribution, while ordinary [Canada.ca page content](https://www.canada.ca/en/transparency/terms.html) has different reproduction terms. A public page is not automatically permission to republish or scrape its contents.

Each adapter stores its collection method, licence/terms check, parser version, schedule, expected fields, freshness threshold, and last run/error. Deduplicate by publisher and external ID where available, then original URL and reviewed fingerprints. A failed import leaves the last verified record marked stale and alerts curators; it never generates a replacement record. Time-sensitive jobs and deadlines need frequent checks. Offices and benefit descriptions have separate review schedules and should never promise current hours or eligibility without a recent official source.

## How to change it

Add a source registry entry before writing an adapter. Verify its terms and available API/feed/export, add parser fixtures and bilingual display names, and define freshness/expiry handling. Add an explicit `sample` fixture only for development or an honestly labeled sandbox. Municipality names and geographic boundaries must correspond to real places; the fictional Toronto sandbox organization is unaffiliated with the actual city. Do not extrapolate a real listing, award, service location, eligibility rule, or government application outcome from nearby records. When a source is removed, retain attribution/audit history while removing or expiring public records as required.

## Configuration

Each adapter needs a source ID, base URL, jurisdiction, locale, collection mode, refresh interval, rate limit, and optional credentials. Credentials belong in Worker secrets, not in the browser, app bundle, repository, or recorded demo. Search defaults to excluding `sample`; a development-only sample-data switch may expose it with a persistent label.

## Dependencies

Cloudflare Worker scheduled jobs, the D1 source registry and catalog, and the public search API. Access to 211 bulk data depends on a separate data-sharing request; it is not an assumed open API. The UI depends on reliable origin and freshness fields to render provenance truthfully.
