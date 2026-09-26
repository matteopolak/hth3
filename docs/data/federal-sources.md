# Federal source adapters

## What it is

`packages/sources/src/adapters/federal` supplies five official federal handoff records: jobs, benefits, grants and funding, Service Canada office finding, and consultations. These are directory links, not individual openings, awards, physical offices, or currently open consultations. Envoy does not represent a government publisher.

## How it works

The scheduled ingestion calls `fetchFederalRecords`. Each definition has a fixed Canada.ca URL, an expected page heading, a discovery area, and a refresh interval. The adapter fetches the allowlisted page, checks its HTTP status, HTML response, official host, size, and H1 identity, then creates a record using Envoy's own short description. It records the publisher, source/evidence URL, Canada.ca terms URL, retrieval time, expiry, and SHA-256 of the fetched HTML. It stores no body text and makes no eligibility, deadline, availability, or office-hours claim. If a page is unavailable or changes identity, that source receives an error code and no new verified record.

The current pages are [Government of Canada jobs](https://www.canada.ca/en/services/jobs/opportunities/government.html), [Benefits Finder](https://www.canada.ca/en/services/benefits/finder.html), [Grants and funding](https://www.canada.ca/en/government/grants-funding.html), [ESDC contact and office finder](https://www.canada.ca/en/employment-social-development/corporate/contact.html), and [Consulting with Canadians](https://www.canada.ca/en/government/system/consultations/consultingcanadians.html). The last two are `kind: null` because neither is an individual office or consultation; discovery area associations place them in Nearby and Participation. Canada.ca's [terms](https://www.canada.ca/en/transparency/terms.html) distinguish non-commercial and commercial reproduction. This adapter links to pages and uses its own descriptions rather than republishing page content.

Jobs and consultations expire after seven days; benefits, funding, and the office finder expire after 30 days. Expiry means Envoy must recheck the handoff page, not that a linked program closed. Individual availability and application status must be checked on the publisher's site.

## How to change it

Add or edit a definition in `FEDERAL_SOURCES` only after checking the publisher page and terms. Keep IDs stable for updates, use a precise H1 identity check, choose the relevant discovery area, and keep the summary free of claims the finder cannot verify. The office finder intentionally points to the Canada.ca ESDC contact page because that page routes to the current Service Canada locator; it is not geocoded as an office. If a future official API permits importing individual listings or locations, add a separate adapter with publisher IDs, record-level evidence, deadline/status verification, appropriate licence review, and a migration for any new kind. Update the fixture tests when a publisher changes its heading or URL.

## Configuration

No API key is required. The URLs, 1 MB response limit, 12-second timeout, and 7/30-day expiry values live in the adapter. The Worker scheduled source-ingestion flow and D1 source registry are described in [official source ingestion](official-ingestion.md). The source registry must contain the `federal-service-canada-offices` entry and discovery area association before its record appears in Nearby.

## Dependencies

The adapter uses the Worker runtime's `fetch` and Web Crypto APIs, the shared `OfficialIngestRecord` contract, and D1 ingestion in the Worker. It depends on Canada.ca remaining the publisher for its five link pages. It has no Job Bank vacancy feed or Service Canada office-location dataset dependency.
