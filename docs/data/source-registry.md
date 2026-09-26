# Source registry and provenance

## What it is

The source registry records where public information comes from, while `source_records` stores per-record publisher, original URL, geography, licence and terms state, language, timestamps, payload hash, evidence link, and freshness/error state. These are global public-catalog tables, not tenant-isolated storage. Public reads exclude fictional records by default and never label unknown, stale, expired, or terms-unreviewed content as verified.

## How it works

Migration `0003_sources.sql` creates `source_registry` and seeds attributable official starting links as `official_external`, with `termsStatus: unreviewed` and `freshness: unknown`. Migration `0006_source_records.sql` creates the per-record provenance table. Migration `0014_envoy_practice_labels.sql` gives the opt-in Toronto practice entry Envoy labels while retaining its sample flags and explicit statement that it is not a real event or City service. Official ingestion is described in [Official source ingestion](official-ingestion.md).

`GET /api/v1/sources` returns the non-sample registry. `GET /api/v1/sources?includeSamples=true` includes fictional source entries and carries a `sampleLabel` on each. `GET /api/v1/source-records` lists records whose terms are explicitly `permitted`; `GET /api/v1/source-records/{id}` reads one such record. Add `?includeSamples=true` to either record endpoint to include sample records. Sample details always carry their fictional label and `verified: false`.

The staff curator API is global and requires the `source:manage` permission. `GET /api/v1/staff/sources` lists registry freshness, safe error codes, current metadata version, record counts, and pending corrections. `GET /api/v1/staff/sources/{id}` adds per-record evidence, terms, freshness, and correction history. Curators submit a proposed field patch with a reason, HTTPS evidence URL, expected source version, and `Idempotency-Key`; a curator then approves or rejects it with the proposal version and a decision reason. Sample registry rows are read-only.

Approval updates only registry-level metadata and increments its version with a compare-and-swap. The source records themselves remain snapshots of publisher content and are never edited by this API. Changes to publisher, source URL, licence, or terms URL downgrade registry terms to `unreviewed`. Public source-record reads check both record terms and registry terms, so affected records stay hidden until a trusted source review or ingestion restores a permitted status. Scheduled ingestion preserves explicitly overridden registry fields and cannot silently restore a curator-downgraded terms state.

Record responses include source ID, external ID, publisher, source URL, jurisdiction and municipality, licence/terms state, language, fetch/verification/expiry timestamps, payload hash/evidence URL, and freshness/error state. `verified` is true only for non-sample content with permitted terms, a valid verification timestamp that is not in the future, and current freshness. Invalid or future fetch/verification timestamps downgrade freshness to `unknown`; an elapsed expiry overrides a stored `current` value. An official publisher or URL alone does not verify a record or grant reuse rights.

## How to change it

Register an official source only after confirming that its publisher and URL are attributable. Keep its initial terms state `unreviewed` and freshness `unknown` until a real review or fetch supplies evidence. Use the jurisdiction code and name for the actual coverage; fill municipality fields only for a municipality the source genuinely covers. Never transform a sample into official content. `source_registry` and `source_records` are global public data with no organization ownership or draft visibility flag: insert participating-organization records only after they are explicitly approved for public publication, and keep private or tenant-specific records in organization-scoped tables. When permitted data is imported, snapshot the source URL and terms, identify it with a publisher external ID where available, and save a payload hash plus evidence link when those are available. Persist only safe error codes, retain provenance on failures, and define explicit expiry/freshness rules before setting a record current. Curator corrections require an HTTPS evidence link and reason, use source and proposal versions to reject stale writes, and append audit events. Do not use a metadata correction to claim fresh verification or set terms permitted; the trusted ingestion/review path controls those states.

## Configuration

Apply the normal D1 migration sequence through `0026_source_review_changes.sql`. Samples are opt-in through `includeSamples=true`. Official ingestion runs from the Worker's scheduled handler; the registry itself needs no source credentials.

## Dependencies

The Worker source feature reads through `@civicresolve/db/d1`; shared source and record types and provenance mapping live in `@civicresolve/sources`; SQLite constraints and initial entries are defined by the D1 migrations. Curator APIs use the existing `source:manage` global permission, `audit_events`, and idempotency table. Official links listed here are discovery links only and do not imply permission to scrape or republish their content.
