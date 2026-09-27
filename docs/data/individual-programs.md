# Individual official programs

## What it is

`data/individual-program-pack.json` contains direct official pages for ten specific funding or support programs in Canada, British Columbia, and Ontario. It also tags eight previously seeded direct program links as individual programs so discovery can distinguish them from generic finders. These are outbound links with original short summaries, not applications hosted by Envoy or eligibility decisions.

## How it works

The pack records a stable ID, publisher, jurisdiction, direct detail/application page, terms URL, evidence note, manual check time, and seven-day expiry for each new program. `scripts/seed-individual-programs.mjs` turns it into D1 migration `0028_individual_programs.sql`: a source registry entry, source record, listing detail, and discovery area for each new page. Previously seeded program records receive listing detail only and keep their existing source provenance. The `source_record_listings` table is created by migration `0027_source_listings.sql`.

Only the master's research scholarship and Ontario medical grant are marked `open`: their official pages explicitly said so when checked. The master's page gives a December 1 deadline, represented as `2026-12-01`. The doctoral scholarship's agency deadline varies from institutional deadlines, so no single closing date is stored. The Ontario Trillium Drug Program's September 30 date concerns reimbursement for the previous program year, not closure of program applications. All other status values are `unknown`. Discovery downgrades an open label when the underlying source record expires or loses verification.

Source and evidence URLs point to the same official detail page; terms URLs point to each publisher's rights page. Titles identify the programs; summaries are original and deliberately brief. No government body is implied to receive an application through Envoy. A source record becomes expired after the review window even if the migration is applied later. This makes later manual review necessary instead of silently renewing an old claim.

## How to change it

Review the official publisher page again before changing a status, deadline, eligibility summary, `checkedAt`, or `expiresAt`. Update the JSON and regenerate the migration:

```sh
node scripts/seed-individual-programs.mjs --out packages/db/migrations/0028_individual_programs.sql
```

Keep IDs stable. Add a new direct program only after checking its detail page and rights link; a directory or generic finder belongs in the separate source pack. Prefer `unknown` application status when a page does not explicitly confirm current intake. Do not put an institution-specific scholarship deadline into the shared `closingDate` field. If extending the pack after migration `0028` has been deployed, put the new rows in a later migration or use a reviewed reseed operation; changing an applied migration will not update an existing D1 database.

The eight existing-record links come from `seed-source-pack.mjs`, which may run after D1 migrations in a fresh environment. Run this idempotent seed once more after that pack to attach their listing metadata:

```sh
node scripts/seed-individual-programs.mjs --target local --apply
node scripts/seed-individual-programs.mjs --target production --apply
```

The NSERC scholarship pages use a separate agency site. The pack links to Canada.ca terms as a general federal reference, but NSERC-specific content reproduction rights were not confirmed. The records therefore contain links and original summaries only. B.C. and Ontario page text is likewise not copied, and neither is assumed to carry an open-data licence.

## Configuration

No credentials, packages, or remote APIs are required for generation. Apply migrations through `0028_individual_programs.sql`. A reseed uses the configured Wrangler login and D1 database; it makes no external program application. The pack-level `checkedAt` and `expiresAt` set the initial provenance window; `closingDate` is a separate program deadline, where known. Updating either requires a fresh review of the publisher page.

## Dependencies

This pack depends on D1 `source_registry`, `source_records`, `discovery_record_areas`, and `source_record_listings`. The source pages are published by NSERC, StudentAid BC, and the Government of Ontario. The generation script uses Node.js built-ins only.
