# Federal source adapters

## What it is

`packages/sources/src/adapters/federal` supplies five official federal handoff records: jobs, benefits, grants and funding, Service Canada office finding, and consultations. These are directory links, not individual openings, awards, physical offices, or currently open consultations. Envoy does not represent a government publisher.

## How it works

The scheduled ingestion calls `fetchFederalRecords`. Each definition has a fixed Canada.ca URL, an expected page heading, a discovery area, and a refresh interval. The adapter fetches the allowlisted page, checks its HTTP status, HTML response, official host, size, and H1 identity, then creates a record using Envoy's own short description. It records the publisher, source/evidence URL, Canada.ca terms URL, retrieval time, expiry, and SHA-256 of the fetched HTML. It stores no body text and makes no eligibility, deadline, availability, or office-hours claim. If a page is unavailable or changes identity, that source receives an error code and no new verified record.

The current pages are [Government of Canada jobs](https://www.canada.ca/en/services/jobs/opportunities/government.html), [Benefits Finder](https://www.canada.ca/en/services/benefits/finder.html), [Grants and funding](https://www.canada.ca/en/government/grants-funding.html), [ESDC contact and office finder](https://www.canada.ca/en/employment-social-development/corporate/contact.html), and [Consulting with Canadians](https://www.canada.ca/en/government/system/consultations/consultingcanadians.html). The last two are `kind: null` because neither is an individual office or consultation; discovery area associations place them in Nearby and Participation. Canada.ca's [terms](https://www.canada.ca/en/transparency/terms.html) distinguish non-commercial and commercial reproduction. This adapter links to pages and uses its own descriptions rather than republishing page content.

Jobs and consultations expire after seven days; benefits, funding, and the office finder expire after 30 days. Expiry means Envoy must recheck the handoff page, not that a linked program closed. Individual availability and application status must be checked on the publisher's site.

### Individual federal student postings

`vacancies.ts` reads the Public Service Commission's [Federal Student Work Experience Program page](https://www.canada.ca/en/public-service-commission/jobs/services/recruitment/students/federal-student-work-program.html). Its specialized inventories publish an individual title, hiring organization, deadline, and direct GC Jobs poster link. The adapter verifies the page heading and structure, accepts only exact official GC Jobs poster links, parses English calendar dates, and excludes rows whose deadline passed. It keeps the poster number as a stable external ID, the direct GC Jobs URL as the handoff, and the Canada.ca page as deadline evidence. It leaves posting date and location unknown because the source page does not publish them, and tells residents to check the official poster for requirements and location. The page is rechecked daily; a completed refresh marks missing or closed listings stale. A changed format returns a source error and no new current listing.

This is narrow student recruitment coverage. The [GC Jobs search](https://emploisfp-psjobs.cfp-psc.gc.ca/psrs-srfp/applicant/page2440?fromMenu=true&toggleLanguage=en) requires a JavaScript session and responds with `X-Robots-Tag: noindex, nofollow`; Envoy does not crawl its search pages. [Job Bank's job seeker terms](https://www.jobbank.gc.ca/termsofuse-seeker.xhtml) prohibit automated access, so Envoy does not scrape its federal-jobs results. The [Open Government advertisements dataset](https://open.canada.ca/data/en/dataset/e61c8587-2cc9-4775-b34e-f1041ad00410) contains advertisements that closed within a fiscal year; it cannot establish current openings. The direct GC Jobs links in the student page still let people verify and apply on the official site.

## How to change it

Add or edit a definition in `FEDERAL_SOURCES` only after checking the publisher page and terms. Keep IDs stable for updates, use a precise H1 identity check, choose the relevant discovery area, and keep the summary free of claims the finder cannot verify. The office finder intentionally points to the Canada.ca ESDC contact page because that page routes to the current Service Canada locator; it is not geocoded as an office. If a future official API permits importing individual listings or locations, add a separate adapter with publisher IDs, record-level evidence, deadline/status verification, appropriate licence review, and a migration for any new kind. Update the fixture tests when a publisher changes its heading or URL.

The student adapter lives in `vacancies.ts`. Its `federal-student-specialized-inventories` source ID, allowlisted publisher hosts, maximum of 30 panels, and date/link parsers form a fail-closed boundary. If the page changes, update the parser and fixture together after reviewing the new official markup. Do not carry a closed posting forward as open, infer an unavailable location, or substitute historical advertisements for current jobs.

## Configuration

No API key is required. The finder URLs, 1 MB response limit, 12-second timeout, and 7/30-day expiry values live in the adapter. The student adapter uses a 500 KB response limit, the same timeout, and a one-day refresh threshold. The Worker scheduled source-ingestion flow and D1 source registry are described in [official source ingestion](official-ingestion.md). The source registry must contain `federal-service-canada-offices` and discovery area association before its record appears in Nearby; ingestion registers the student source with `official_link` collection mode.

## Dependencies

The adapter uses the Worker runtime's `fetch` and Web Crypto APIs, the shared `OfficialIngestRecord` contract, and D1 ingestion in the Worker. It depends on Canada.ca remaining the publisher for its five link pages. It has no Job Bank vacancy feed or Service Canada office-location dataset dependency.
