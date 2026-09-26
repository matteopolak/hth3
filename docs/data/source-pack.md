# Official link and practice issue pack

## What it is

`data/official-source-pack.json` adds real government, public library, municipal recreation, and transit handoff pages to Jobs, Funding, Support, Nearby, and Participation. `data/practice-civic-issues.json` adds fictional staff workflow records located in the real municipality of Toronto. Every practice issue has `sample=1` and starts with `[Practice]`.

These are official **page links**, not imported job vacancies, awards, service appointments, or open consultations. A listing's availability, program eligibility, office services and hours, and participation deadlines remain on the publisher's website.

## How it works

`node scripts/seed-source-pack.mjs --out /tmp/envoy-source-pack.sql` generates reviewable, idempotent SQL. The script creates one manual official source and record per link, assigns a discovery area and optional finder/location kind, writes reviewed Nearby details to `service_location_metadata`, and inserts practice feedback records into the fictional Toronto organization. It does not send practice issues to a government body or the analytics outbox. Re-running preserves changes to practice issue statuses and messages.

Each official record has its publisher, jurisdiction, source and evidence URL, terms URL, a metadata hash, review time, and a seven-day expiry. The pack was manually checked on 2026-09-26. It marks each record stale after its own expiry; re-running after that date does not renew verification. Before refreshing it, recheck each official page and update its `checkedAt` and `expiresAt` values. Entries without dates inherit the pack-level dates. A source fetch failure elsewhere does not turn these manually checked records current.

The descriptions are original short summaries. Link-only review avoids reproducing government page content or scraping listings. See each entry's `termsReview` for the exact boundary and the linked publisher terms. The known BC job board restriction is why this pack contains no WorkBC job listing data.

## How to change it

Add an entry to the JSON with an official HTTPS URL, publisher, jurisdiction, area, terms URL, and a brief link-only terms review. Use a stable ID. Set `kind` only for a finder or a confirmed service location. Nearby entries require `serviceCategory`, `address`, `publicAccessSummary`, `servicesSummary`, `detailsCheckedAt`, and `detailsSourceUrl`. Optional `hoursSummary` and `accessibilitySummary` must come from the linked official page. When adding coordinates, record their official `coordinatesEvidenceUrl`. The seed script checks these fields before writing metadata. Do not write `current` availability into titles or summaries unless a maintained feed can prove it. Use a real municipality name and source when adding a practice location, and keep the `[Practice]` label and `sample=1` boundary.

The Vancouver library coordinates come from the [City's libraries open dataset](https://opendata.vancouver.ca/explore/dataset/libraries/), whose metadata says it was updated in July 2009; each included branch address was therefore checked against its current Vancouver Public Library page. Thornhill Recreation Centre coordinates come from [Open Calgary's recreation facilities dataset](https://data.calgary.ca/d/hxfu-6d96). The Waterfront transit desk's coordinate comes from the [City of Vancouver rapid transit station dataset](https://opendata.vancouver.ca/explore/dataset/rapid-transit-stations/), so its pin indicates the station rather than the precise desk entrance. Alberta Supports publishes coordinates on its [location page](https://www.alberta.ca/find-an-alberta-supports-centre). The coordinate source URL is saved to `service_location_metadata.coordinates_source_url` separately from the page that verifies public access and services. No unsourced coordinates are filled in for the Ontario counters. Hours are left unknown because schedules can change quickly.

The Vancouver coordinate datasets are published under the [Open Government Licence – Vancouver](https://vancouver.ca/your-government/terms-of-use.aspx). The Calgary dataset uses the [Open Government Licence – City of Calgary](https://data.calgary.ca/stories/s/u45n-7awa/): “Contains information licensed under the Open Government Licence – City of Calgary.” Source URLs and publishers remain visible with the locations; retain the licence links and attribution if map presentation changes.

For review, run:

```sh
node scripts/seed-source-pack.mjs --out /tmp/envoy-source-pack.sql
```

After review and migrations, apply to local and production D1:

```sh
node scripts/seed-source-pack.mjs --target local --apply
node scripts/seed-source-pack.mjs --target production --apply
```

The script uses `INSERT ... ON CONFLICT` for official records and `INSERT OR IGNORE` for practice records. D1's remote SQL import rejects explicit `BEGIN`/`COMMIT`, so the generated file has no manual transaction wrapper; failed runs can be replayed safely. It deliberately does not refresh older source-adapter records or overwrite staff edits to practice issues.

## Configuration and dependencies

No packages, API keys, or paid services are required. The script uses Node built-ins and the repository's installed `apps/worker/node_modules/.bin/wrangler` directly. It expects the `civicresolve-local` or `civicresolve-prod` D1 bindings in `apps/worker/wrangler.toml` and migrations through `0022_service_location_metadata.sql`. Production execution requires the active Wrangler account to have D1 access. The workspace `pnpm` minimum release age remains two weeks; this workflow installs nothing.

## Coverage

The 2026-09-26 pack has 34 official pages and locations: five jobs finders, nine funding pages, three support programs, eleven service locations, and six participation directories. Nearby has six government counters, three libraries, one community recreation centre, and one transit help point. Nine have official publisher coordinates; the two Ontario counters are listed without a pin until coordinate evidence is available. It adds eight practice civic issues. Existing scheduled adapters add federal and provincial finders plus Service BC locations separately. No real municipality, vacancy, grant decision, consultation status, or resident complaint was invented.
