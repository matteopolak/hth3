# Source registry and provenance

## What it is

The source registry records where public information comes from, while `source_records` stores per-record publisher, original URL, geography, licence and terms state, language, timestamps, payload hash, evidence link, and freshness/error state. Public reads exclude fictional records by default and never label unknown, stale, expired, or terms-unreviewed content as verified.

## How it works

Migration `0003_sources.sql` creates `source_registry` and seeds attributable official starting links as `official_external`, with `termsStatus: unreviewed` and `freshness: unknown`. Migration `0006_source_records.sql` creates the per-record provenance table. It seeds no official content; the only record is a clearly marked fictional Toronto sample using the real municipality's geography and an explicit statement that it is not a real event or City service.

`GET /api/v1/sources` returns the non-sample registry. `GET /api/v1/sources?includeSamples=true` includes fictional source entries and carries a `sampleLabel` on each. `GET /api/v1/source-records` lists records whose terms are explicitly `permitted`; `GET /api/v1/source-records/{id}` reads one such record. Add `?includeSamples=true` to either record endpoint to include sample records. Sample details always carry their fictional label and `verified: false`.

Record responses include source ID, external ID, publisher, source URL, jurisdiction and municipality, licence/terms state, language, fetch/verification/expiry timestamps, payload hash/evidence URL, and freshness/error state. `verified` is true only for non-sample content with permitted terms, a verification timestamp, and current freshness. An elapsed expiry overrides a stored `current` value. An official publisher or URL alone does not verify a record or grant reuse rights.

## How to change it

Register an official source only after confirming that its publisher and URL are attributable. Keep its initial terms state `unreviewed` and freshness `unknown` until a real review or fetch supplies evidence. Use the jurisdiction code and name for the actual coverage; fill municipality fields only for a municipality the source genuinely covers. Never transform a sample into official content. When real permitted data is imported, snapshot the source URL and terms, identify it with a publisher external ID where available, and save a payload hash plus evidence link when those are available. Persist only safe error codes, retain provenance on failures, and define explicit expiry/freshness rules before setting a record current.

## Configuration

Apply the normal D1 migration sequence through `0006_source_records.sql`. Samples are opt-in through `includeSamples=true`. This feature has no scraper, source credentials, or ingest schedule; source records remain empty for official data until a terms-reviewed import is implemented.

## Dependencies

The Worker source feature reads through `@civicresolve/db/d1`; shared source and record types and provenance mapping live in `@civicresolve/sources`; SQLite constraints and initial entries are defined by the D1 migrations. Official links listed here are discovery links only and do not imply permission to scrape or republish their content.
