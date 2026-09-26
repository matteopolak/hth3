# Official link and practice issue pack

## What it is

`data/official-source-pack.json` adds a small set of real government and municipal handoff pages to Jobs, Funding, Support, Nearby, and Participation. `data/practice-civic-issues.json` adds fictional staff workflow records located in the real municipality of Toronto. Every practice issue has `sample=1` and starts with `[Practice]`.

These are official **page links**, not imported job vacancies, awards, service appointments, or open consultations. A listing's availability, program eligibility, office services and hours, and participation deadlines remain on the publisher's website.

## How it works

`node scripts/seed-source-pack.mjs --out /tmp/envoy-source-pack.sql` generates reviewable, idempotent SQL. The script creates one manual official source and record per link, assigns a discovery area and optional finder/location kind, and inserts practice feedback records into the fictional Toronto organization. It does not send practice issues to a government body or the analytics outbox. Re-running preserves changes to practice issue statuses and messages.

Each official record has its publisher, jurisdiction, source and evidence URL, terms URL, a metadata hash, review time, and a seven-day expiry. The pack was manually checked on 2026-09-26. It marks itself stale after 2026-10-03; re-running after that date does not renew verification. Before refreshing it, recheck each official page and update both `checkedAt` and `expiresAt` in the JSON. A source fetch failure elsewhere does not turn these manually checked records current.

The descriptions are original short summaries. Link-only review avoids reproducing government page content or scraping listings. See each entry's `termsReview` for the exact boundary and the linked publisher terms. The known BC job board restriction is why this pack contains no WorkBC job listing data.

## How to change it

Add an entry to the JSON with an official HTTPS URL, publisher, jurisdiction, area, terms URL, and a brief link-only terms review. Use a stable ID. Set `kind` only for a finder or a confirmed service location. Do not write `current` availability into titles or summaries unless a maintained feed can prove it. Use a real municipality name and source when adding a practice location, and keep the `[Practice]` label and `sample=1` boundary.

For review, run:

```sh
node scripts/seed-source-pack.mjs --out /tmp/envoy-source-pack.sql
```

After review and migrations, apply to local and production D1:

```sh
node scripts/seed-source-pack.mjs --target local --apply
node scripts/seed-source-pack.mjs --target production --apply
```

The script uses `INSERT ... ON CONFLICT` for official records and `INSERT OR IGNORE` for practice records. It deliberately does not refresh older source-adapter records or overwrite staff edits to practice issues.

## Configuration and dependencies

No packages, API keys, or paid services are required. The script uses Node built-ins and the repository's installed Wrangler through `pnpm exec`. It expects the `civicresolve-local` or `civicresolve-prod` D1 bindings in `apps/worker/wrangler.toml` and migrations `0001`, `0003`, `0005`, `0006`, `0008`, `0009`, and `0013` or later. Production execution requires the active Wrangler account to have D1 access. The workspace `pnpm` minimum release age remains two weeks; this workflow installs nothing.

## Coverage

The 2026-09-26 pack has 13 official pages: one jobs finder, four funding pages, three support programs, two service locations, and three participation directories. It adds eight practice civic issues. Existing scheduled adapters add federal and provincial finders plus Service BC locations separately. No real municipality, vacancy, grant decision, consultation status, or resident complaint was invented.
