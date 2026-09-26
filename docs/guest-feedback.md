# Guest civic feedback

## What it is

The Worker accepts guest reports into a clearly labeled fictional sandbox and issues a private receipt token. A resident can reopen the receipt and exchange messages without creating an account; staff with civic feedback permissions can respond and move the report through its review states.

## How it works

`POST /api/v1/feedback` accepts `{ "message": "..." }`, an `Idempotency-Key`, and a client-generated 32-byte random value in `X-Receipt-Token` as 64 hexadecimal characters. The Worker stores only the SHA-256 token hash and returns the token once with the receipt. `GET /api/v1/feedback/receipts/{id}` and the matching `/messages` route require that token. A bad token returns the same 404 as a missing receipt.

Guest feedback currently routes to `CivicResolve Toronto Sandbox (Fictional, unaffiliated)`. The receipt and staff queue label the record `sample: true`; the destination does not represent a City of Toronto or other government service. Staff paths are `/api/v1/staff/organizations/{orgId}/feedback`, `/{id}/messages`, and `/{id}/status`. The Worker checks both the Auth0 role/permission and the active organization backed by D1 membership. Civic reviewers and organization admins can read and respond; hiring reviewers cannot.

Status transitions are `submitted → acknowledged → in_review`; staff may then request resident information or record an outcome, and outcome/closed records can be reopened under the explicit transition map in `apps/worker/src/features/feedback-core/index.ts`. Invalid moves return `409`. D1 batches each state change with its audit entry, an outbox event, and its idempotency record. Event and audit payloads include message length and status, never the feedback body. The text remains in the private D1 receipt/message record for the resident and assigned sandbox staff.

The local Worker smoke exercises guest receipt privacy, a resident follow-up, staff response and status changes, role denial, idempotent infrastructure, and persistence after restarting Wrangler. It uses fixed development principals and local D1; it is not live Auth0 acceptance and does not claim delivery to Tiger or a government partner.

## How to change it

Add schema changes as forward-only migrations. Keep the receipt token out of URLs, logs, analytics events, and persisted idempotency responses. When adding an operation, preserve identical 404 behavior for unknown receipts and invalid tokens, enforce organization scope in the Worker, and batch the state write with audit/outbox/idempotency records. Add English and French client messages and exercise both allowed and denied role paths in the smoke harness.

## Configuration

- `X-Receipt-Token`: client-generated CSPRNG token, 32 bytes encoded as lowercase/uppercase hex; the client must retain it to reopen the private receipt.
- `Idempotency-Key`: required on writes and scoped to the guest or authenticated actor.
- `DB`: D1 stores the sample destination, report, messages, audit, idempotency, and outbox rows.
- The sandbox destination is seeded by the core migration and linked to Auth0 organization ID `org_43G1B1RhPwac7EjS`; it is fictional and unaffiliated.

## Dependencies

The feature uses Cloudflare Workers and D1, the v1 contracts, shared idempotency/outbox helpers, Auth0 JWT verification and organization authorization for staff, and the fixed local Worker smoke harness. Remote Tiger delivery is outside this foundation slice.
