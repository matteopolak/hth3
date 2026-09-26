# Worker, D1, R2, and outbox

## What it is

The Cloudflare Worker is the server boundary for CivicResolve. D1 stores transactional records and an idempotent event outbox; R2 is bound as a private object store whose keys and reads are scoped to a resource, organization, and owner.

## How it works

`apps/worker/wrangler.toml` binds the Worker to D1 and a private R2 bucket. The migration in `packages/db/migrations/` creates organizations and memberships, sample postings, feedback/application records, private-file metadata, audit events, idempotency records, and pending outbox events. `enqueueOutboxEvent` inserts once by idempotency key, then returns the original event ID on an identical retry and rejects a changed payload. Business writes and their outbox rows should use D1 `batch()` so the state and event commit together.

Private R2 keys include purpose, organization, owner, record, and asset IDs. The read helper checks all of those values against the authorization grant before it calls R2; the bucket has no public URL binding. Authorization middleware must establish the grant from the caller and the database before using this helper.

The seeded Auth0 organization is `CivicResolve Toronto Sandbox (Fictional, unaffiliated)`, with geography Toronto, Ontario and `sample = 1`. Its sample posting says it is not an official City of Toronto or government vacancy. These records exercise the internal workflow and do not claim a government partner.

`pnpm --filter @civicresolve/worker smoke` applies migrations and runs a local Worker against local D1. Its `/_local/smoke/` routes exist only when `APP_ENV=development`; the smoke script verifies retries and reads an event after restarting the Worker. This harness is not a resident submission endpoint. `pnpm check` runs the same smoke after formatting, typechecks, tests, and builds.

## How to change it

Add a forward-only migration for schema changes and update package-level D1 helpers at the same time. A route that changes state should validate the request, enforce role and tenant scope in the Worker, write the domain update and typed outbox event atomically, then return the persisted state. For files, store metadata in D1 and pass only a validated authorization grant to `readPrivateAsset`; never expose the R2 bucket directly. Test duplicate idempotency keys and cross-resource access whenever the write or asset model changes.

## Configuration

- `apps/worker/wrangler.toml`: Worker entrypoint, runtime-supported compatibility date, D1/R2 bindings, and local `APP_ENV`.
- `compatibility_date`: pinned to `2026-07-28`, the latest date supported by the Wrangler 4.113.0 bundled local workerd. Keep it there until an age-eligible Wrangler release supports a newer runtime date; do not bypass the workspace release-age policy to move it forward.
- `DB`: Cloudflare D1 transactional binding. Replace the local placeholder `database_id` with the account's configured database ID before remote deployment.
- `PRIVATE_ASSETS`: private R2 bucket binding; provision a bucket with a matching configured name for remote use.
- Production provisioning for later deployment: D1 database `civicresolve-prod` (`63318ca9-4000-4713-b72e-364429251d21`, ENAM) and private R2 bucket `civicresolve-private-prod`. The checked-in Wrangler binding remains local.
- Tiger is provisioned behind Hyperdrive configuration `d9c7e05b5ab547be9355ac1e0085dae6`; the later integration will bind it as `HYPERDRIVE`. No database password is stored in this repository.
- `ALLOWED_ORIGINS`: comma-separated origins accepted by API CORS. Local development permits localhost web/mobile origins when this is unset.
- `APP_ENV`: `development` enables only the local smoke harness; production must use `production`.
- Wrangler local state and logs are stored under `apps/worker/.wrangler/` and ignored by Git.

## Dependencies

The Worker depends on shared v1 contracts, the `@civicresolve/db` D1/R2 helpers, Wrangler, Cloudflare Workers, D1, and R2. Tiger delivery is a later integration; this outbox does not claim that a local event reached Tiger. The later Tiger connection is provisioned outside the repository and will be exposed to the Worker through a `HYPERDRIVE` binding for the dedicated provider issue; it is not required for this local foundation gate.
