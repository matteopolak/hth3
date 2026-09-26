# Worker, D1, R2, and outbox

## What it is

The Cloudflare Worker is the server boundary for Envoy. D1 stores transactional records and an idempotent event outbox; R2 is bound as a private object store whose keys and reads are scoped to a resource, organization, and owner.

## How it works

`apps/worker/wrangler.toml` binds the Worker to D1 and a private R2 bucket. The forward migrations in `packages/db/migrations/` create organizations and memberships, sample postings, feedback/application records, private-file metadata, audit events, idempotency records, and pending outbox events. `enqueueOutboxEvent` inserts once by idempotency key, then returns the original event ID on an identical retry and rejects a changed payload. Feature writes use D1 `batch()` so the state, audit record, outbox event, and idempotency result commit together.

Private R2 keys include purpose, organization, owner, record, and asset IDs. The read helper checks all of those values against the authorization grant before it calls R2; the bucket has no public URL binding. Authorization middleware must establish the grant from the caller and the database before using this helper.

The seeded organization is internally marked `sample = 1` and `unverified`, with Toronto, Ontario geography. Migration `0010_posting_copy.sql` gives its display name and posting natural copy; the UI keeps an explicit practice disclosure at the record and submission action. These records exercise the internal workflow and do not claim a government partner.

Worker authentication is implemented in `apps/worker/src/auth/`. Auth0 JWT validation, exact role and API-permission checks, and the required intersection with D1 organization membership are described in [Auth0 and organization authorization](authorization.md). Applicant ownership is based on the token subject and does not require membership in an employer organization.

`pnpm --filter @civicresolve/worker smoke` applies migrations and runs a local Worker against local D1. Its `/_local/smoke/` routes exist only when `APP_ENV=development`; the smoke script verifies outbox retries, guest receipt privacy, civic staff responses and transitions, applicant confirmation/ownership, employer review, role and tenant denial, and reads persisted feedback/application state after restarting the Worker. Test identities are fixed local principals; there is no live Auth0 token in this evidence. The local records are fictional samples and no external delivery is asserted. `pnpm check` runs the same smoke after formatting, typechecks, tests, and builds.

## How to change it

Add a forward-only migration for schema changes and update package-level D1 helpers at the same time. A route that changes state should validate the request, enforce role and tenant scope in the Worker, write the domain update and typed outbox event atomically, then return the persisted state. For files, store metadata in D1 and pass only a validated authorization grant to `readPrivateAsset`; never expose the R2 bucket directly. Test duplicate idempotency keys and cross-resource access whenever the write or asset model changes.

## Configuration

- `apps/worker/wrangler.toml`: Worker entrypoint, runtime-supported compatibility date, D1/R2 bindings, and local `APP_ENV`.
- `compatibility_date`: pinned to `2026-07-28`, the latest date supported by the Wrangler 4.113.0 bundled local workerd. Keep it there until an age-eligible Wrangler release supports a newer runtime date; do not bypass the workspace release-age policy to move it forward.
- `DB`: Cloudflare D1 transactional binding. The default local binding uses a placeholder ID; `env.production` points to the provisioned `civicresolve-prod` database.
- `PRIVATE_ASSETS`: private R2 bucket binding. The default local bucket name is for local development; `env.production` points to `civicresolve-private-prod`.
- Migration `0002_feedback_organization.sql`: attaches guest feedback submissions to the destination organization so civic staff access is tenant-scoped.
- Production provisioning for later deployment: D1 database `civicresolve-prod` (`63318ca9-4000-4713-b72e-364429251d21`, ENAM) and private R2 bucket `civicresolve-private-prod`. Wrangler has explicit production bindings; deployment and remote migrations are separate steps.
- `AI`: Workers AI binding used by resident/staff agents and feedback classification. The selected Granite Micro model stays within the account's no-charge allocation.
- `HYPERDRIVE`: production Tiger Data connection for five-minute outbox delivery and scoped analytics. Apply `scripts/tiger/001_feedback_analytics.sql` to Tiger before expecting analytics.
- `ELEVENLABS_AGENT_ID`: nonsecret ID of the private voice intake agent. `ELEVENLABS_API_KEY` is a Worker secret needed to sign browser sessions; the current OAuth CLI token cannot serve as that key.
- The production cron runs every five minutes for Tiger delivery and invokes official source ingestion once daily at 02:00 UTC. See [Official source ingestion](data/official-ingestion.md).
- `ALLOWED_ORIGINS`: comma-separated origins accepted by API CORS. Local development permits localhost web/mobile origins when this is unset.
- `FEEDBACK_ABUSE_HMAC_KEY`: at least 32 characters, stored as a Worker secret in production. Guest feedback writes fail closed when it is missing; the local smoke injects a fixed test-only key.
- `APP_ENV`: `development` enables only the local smoke harness; production must use `production`.
- Auth0's public issuer host and API audience are configured as non-secret Wrangler vars. Role grants and active organization membership are checked on the Worker; see [authorization configuration](authorization.md).
- Wrangler local state and logs are stored under `apps/worker/.wrangler/` and ignored by Git.

## Dependencies

The Worker depends on shared v1 contracts, `@civicresolve/db`, `@civicresolve/domain`, `@civicresolve/sources`, the `postgres` driver, Wrangler, Cloudflare Workers, D1, R2, Workers AI, and optional Tiger/ElevenLabs provider bindings. A local outbox event does not establish live Tiger delivery; that requires the remote schema, Worker deployment, and a confirmed event round trip.
