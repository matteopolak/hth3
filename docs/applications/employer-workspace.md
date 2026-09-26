# Employer postings and application conversations

## What it is

Envoy's participating-employer API lets an organization admin create, edit, publish, and close its own postings. Hiring reviewers and organization admins can read applications, exchange messages with applicants, and record hiring decisions. Applicants can read and reply in their own application conversation.

## How it works

The Worker routes requests to `handleEmployerRequest` in `apps/worker/src/features/employer/index.ts`. Every staff operation authenticates the caller, checks its Auth0 scope, role, active organization, and persisted membership through `canPerformOrganizationAction`, then scopes D1 reads or writes to the posting's organization. Applicant message routes use the authenticated subject as the owner boundary. Staff never receive a private applicant profile or résumé through these routes; a résumé is available only through the separate explicit application share flow.

An admin creates a draft with `POST /api/v1/staff/organizations/{orgId}/postings` and `{ "title": "...", "description": "...", "location": "Toronto, Ontario" }`. The server derives `sample` from the organization record, so callers cannot label a practice employer as real. `PATCH /{postingId}` updates a draft or published posting. `POST /{postingId}/publish` publishes a draft; a non-sample organization must have `verification_status = verified`. `POST /{postingId}/close` closes a published posting. `GET` on the collection or item shows the organization's posting state and timestamps. Closed postings cannot be edited or republished.

`GET /api/v1/staff/organizations/{orgId}/applications/{applicationId}` returns the submitted answers and status only when the posting belongs to that organization. Both the applicant at `/api/v1/applications/{applicationId}/messages` and employer staff at `/api/v1/staff/organizations/{orgId}/applications/{applicationId}/messages` can `GET` the conversation or `POST { "message": "..." }`. Only reviewers and admins can send employer messages. Message bodies stay in D1; audit and outbox entries contain metadata only.

An employer records a hiring decision with `POST /api/v1/staff/organizations/{orgId}/applications/{applicationId}/decision` and `{ "status": "shortlisted" | "offer" | "declined", "message": "optional applicant-facing explanation" }`. The allowed transitions match the existing application state machine: `under_review` may become `shortlisted` or `declined`, `information_requested` may become `declined`, and `shortlisted` may become `offer` or `declined`. The optional message appears in the applicant's conversation. Status, message, audit, and outbox records are written in one D1 batch.

## How to change it

Change transition rules in the employer feature and `application-core` together. If adding a new staff action, add it to the agent tool catalogue so the employee assistant has the same access as the manual website. Public posting discovery and application submission are in `application-core`; their queries admit sample postings from sample organizations and non-sample postings only from verified, non-sample organizations. Do not expose an unverified organization's non-sample posting or an application from a different tenant.

## Configuration

The feature uses the existing `DB` binding and Auth0 settings. Staff posting management requires `manage:postings`; application reads require `read:applications`; staff messages and decisions require `review:applications`. Applicant reads and messages require the applicant role and `read:applications` or `submit:applications` respectively. The local development identities work only with `APP_ENV=development` and `DEV_AUTH_ENABLED=true`. Migration `0011_employer_postings.sql` adds posting lifecycle dates and the private `application_messages` table.

## Dependencies

Cloudflare D1, the Worker Auth0 identity verifier, domain permission checks, the existing application records, and the shared audit/outbox tables. The public listing and application submission handlers in `application-core` are required for the full applicant loop.
