# Municipal job postings

## What it is

`packages/sources/src/adapters/city-jobs` collects individual vacancies from the City of Ottawa and City of Toronto public career boards. Each record has the publisher's requisition or job ID, a direct official posting URL, factual title, published location and closing date. These are live third-party listings, separate from our jobs-finder directory links and from Envoy employer-created roles.

## How it works

Both career boards publish a public SuccessFactors search page with links to current vacancies. The collector takes at most 12 links per city and checks the corresponding direct posting pages sequentially. Ottawa posters state `Requisition ID`, `Location`, and `Application Close`; Toronto posters state `Job ID`, `Work Location`, and `Posting Period`. A record is included only when all required fields parse, the close date has not passed in Toronto local time, the page identifies itself as a JobPosting, and all URLs stay on the expected official host. The direct posting is both the handoff and evidence URL. Only metadata and an original one-line handoff summary are stored; job descriptions and images are not copied.

The search page lists current opportunities, so included records have `applicationStatus: open`. A successful complete check reports its source ID for stale-listing cleanup; explicit zero-result pages do too. Fetch, redirect, content-type and template failures report a source error and do not create records. The adapter limits HTML to 500 KB per response and freshness to 12 hours or the end of the closing date, whichever is earlier. Because Toronto daylight-saving time varies, the closing-date expiry uses a conservative 04:00 UTC cutoff, which can hide a winter vacancy up to one hour early rather than claim it remains open after closing.

Source IDs: `city-ottawa-open-jobs`, `city-toronto-open-jobs`. Collection mode is `official_link`. The scheduler should run no more often than needed for freshness and respect public site capacity. A record may disappear between search and detail fetch; that run fails closed and the previous status is marked as an error rather than silently claiming a current vacancy.

## How to change it

Update board URLs, field patterns, bounds, or expiry logic in `packages/sources/src/adapters/city-jobs/index.ts`. Add a small focused fixture to its adjacent test for each new publisher template. An additional city needs a rights and robots review, direct job URLs, publisher IDs, explicit dates/locations, and a reliable way to distinguish current postings. Do not convert a city career landing page into a fake vacancy.

Calgary is deliberately absent from automated collection. [The City of Calgary website terms](https://www.calgary.ca/info-requests/terms-of-use.html) prohibit data mining, robots and similar extraction tools. Its official [careers page](https://www.calgary.ca/careers.html) remains a directory handoff until a permitted feed or explicit permission is available. Ottawa's [copyright disclaimer](https://ottawa.ca/en/terms-use/disclaimer) and Toronto's [copyright information](https://www.toronto.ca/home/copyright-information/) also mean this adapter stays link-only and does not republish poster text. The boards' [Ottawa application guidance](https://jobs-emplois.ottawa.ca/city-jobs/content/Apply-with-Us/?locale=en_GB) and [Toronto application guidance](https://jobs.toronto.ca/jobsatcity/content/How-to-Apply/?locale=en_US) confirm that applicants must use their official processes and submit before the posted closing dates.

## Configuration

There are no credentials or paid APIs. `MAX_POSTINGS_PER_CITY` is 12, `MAX_HTML_BYTES` is 500,000, and the fetch timeout is 12 seconds. The package's `./adapters/city-jobs` export provides `fetchCityVacancies(fetcher, now)` for ingestion; callers can inject a fetcher for focused tests. The workspace enforces `minimumReleaseAge: 20160` minutes (two weeks) for pnpm installs.

## Dependencies

The adapter uses built-in `fetch`, `crypto.subtle`, and `Intl`; it returns the shared `OfficialIngestRecord` contract. It depends on the two official public career boards and the Worker's source-record ingestion and stale-source handling. It does not need Auth0 or applicant accounts because it never applies on behalf of users.
