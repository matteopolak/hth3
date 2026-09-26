# Source registry and provenance

## What it is

The source registry records where public information comes from, the jurisdiction it covers, the publisher, its licence and terms review, and the latest fetch, verification, expiry, and freshness state. Its API exposes official source entry points without claiming that those pages have been ingested or verified; fictional sample entries are excluded by default.

## How it works

Migration `0003_sources.sql` creates `source_registry` and seeds attributable official starting links as `official_external`, with `termsStatus: unreviewed` and `freshness: unknown`. It also seeds one clearly marked fictional Toronto sample, using Toronto's real municipal geography and an explicit statement that it is unaffiliated with the City of Toronto. No listing, program, award, vacancy, or service claim is fabricated.

`GET /api/v1/sources` returns the non-sample registry. `GET /api/v1/sources?includeSamples=true` includes fictional entries and carries a `sampleLabel` on each. Responses include publisher, original URL, jurisdiction codes and names, municipality when applicable, licence/terms fields, timestamps, and freshness/error state. An expired timestamp overrides a stale stored `current` value. A source being official does not make its content or reuse terms verified.

## How to change it

Register an official source only after confirming that its publisher and URL are attributable. Keep its initial terms state `unreviewed` and freshness `unknown` until a real review or fetch supplies evidence. Use the jurisdiction code and name for the actual coverage; fill municipality fields only for a municipality the source genuinely covers. Never transform a sample into official content. If ingestion is added, persist only safe error codes or summaries, retain last-known provenance on failures, and define an explicit expiry/freshness policy before setting a source current.

## Configuration

The D1 database must have migration `0003_sources.sql` applied. Samples are opt-in through the `includeSamples=true` query parameter. There are no source credentials or ingest schedules configured by this registry feature.

## Dependencies

The Worker source feature reads registry rows through `@civicresolve/db/d1`; source row and response types live in `@civicresolve/sources`; SQLite constraints and starter entries are defined by the D1 migration. Official links listed here are discovery links only and do not imply permission to scrape or republish their content.
