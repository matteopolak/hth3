# Official vacancy records

## What it is

The B.C. vacancy adapter publishes individual BC Public Service postings from a small curated list of direct official pages. It stores only a publisher requisition ID, factual title, location, closing date, direct URL, a generic Envoy handoff sentence, and provenance. It does not copy the job description, salary, qualifications, or application instructions.

## How it works

`fetchProvincialVacancies` reads the allowlisted direct posting IDs in `packages/sources/src/adapters/vacancies/index.ts`. The publisher's [robots file](https://bcpublicservice.hua.hrsmart.com/robots.txt) allows `/hr/ats/Posting/view/*` but disallows automated search. Each request is bounded by a 12-second timeout and 300 KB response limit. A changed host, redirect, identity, required field, or date fails the entire source closed. Direct pages use separate publisher field IDs for title, location, and `Close Date`; the adapter never searches or copies the body.

The three initial IDs are `124147`, `123788`, and `124288`, checked against direct official posting pages on September 26, 2026. The output uses stable IDs `official-bc-vacancy-{requisition}` and source ID `bc-public-service-vacancies`. The location and close date remain tied to the publisher URL. A posting with a closing date before the current Vancouver calendar date is omitted. On the closing date, status is `unknown` because the exact time and any amendments need confirmation at the publisher. An absent closing date is also `unknown`, never assumed open. Records expire after 24 hours even if the scheduler cannot refresh them.

The Worker marks previously imported records stale after a complete refresh omits a closed curated posting. If any direct page fails, the adapter returns no records and a source failure so existing records can be marked `error`. The source registry and public discovery API expose these states and timestamps. Applications remain on the official BC Public Service site.

## How to change it

Add or remove a direct requisition ID in `POSTING_IDS` only after checking the publisher page and its current status. Do not enumerate the recruitment search route; the robots file disallows it. Keep the stable ID mapping and the parser's field checks. If the publisher changes its HTML, update the field IDs from a new direct page and run the two focused adapter checks. The shared `OfficialIngestRecord` listing shape and the Worker ingestion code control storage and public discovery mapping.

A broader vacancy feed requires a documented licence or written permission and a publisher-provided export/API. Do not fill gaps with invented job titles or reuse expired postings as current. A job finder remains a separate record type from an individual vacancy.

## Configuration

No API key is used. The curated IDs, official board URL, detail URL root, page size cap, timeout, and one-day expiry are code constants. The adapter records [B.C. copyright terms](https://www2.gov.bc.ca/gov/content/home/copyright); the Province states that site material may not be reproduced or redistributed without prior written permission. The adapter therefore keeps only factual posting metadata and a direct link. The first three URLs are:

- [124147](https://bcpublicservice.hua.hrsmart.com/hr/ats/Posting/view/124147)
- [123788](https://bcpublicservice.hua.hrsmart.com/hr/ats/Posting/view/123788)
- [124288](https://bcpublicservice.hua.hrsmart.com/hr/ats/Posting/view/124288)

The [City of Vancouver terms](https://vancouver.ca/your-government/terms-of-use.aspx) restrict copying and repeated automated access to its site material. The [City of Winnipeg conditions](https://www.winnipeg.ca/connect/conditions-use) prohibit redistribution and reuse of its website content without written permission. Neither city has a vacancy scraper here; their careers destinations remain separate directory links. WorkBC's [job seeker terms](https://www.workbc.ca/job-seeker-terms-use) also prohibit copying or scraping its board, so it is not used as a substitute feed.

## Dependencies

The adapter uses official BC recruitment detail pages, the Worker runtime `fetch`, `Intl` time zone formatting, and Web Crypto, plus the shared source listing contract and Worker ingestion service. The City of Vancouver and City of Winnipeg have no runtime dependency for vacancy import.
