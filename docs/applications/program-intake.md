# Participating program intake

## What it is

Envoy lets a verified participating grant or benefit sponsor publish its own intake form, receive applications, and send status updates and messages. An unverified practice organization can use the same flow with an explicit practice disclosure. External programs remain official-site handoffs; they never appear as submitted applications in Envoy.

## How it works

`handleProgramIntakeRequest` owns `/api/v1/programs`, `/api/v1/program-applications`, and the corresponding `/api/v1/staff/organizations/{orgId}/...` routes. Public reads return published forms only when the sponsor is verified, or when both the program and organization are marked `sample`. The existing Auth0 actor and D1 membership checks restrict sponsor actions to an organization admin in the active organization. Applicants use their own subject to submit and read. A sponsor cannot read another sponsor's applications, and an applicant cannot read another person's application.

The sponsor creates a draft with `POST /api/v1/staff/organizations/{orgId}/programs`, providing `kind`, `title`, `summary`, and `questions`. Each question has a stable lowercase ID, a label, a `short_text`, `long_text`, or `select` type, and a required flag. Choice questions include `options`. The sponsor may edit only drafts, publishes with `POST /{programId}/publish`, and closes an open intake with `POST /{programId}/close`. Published questions are immutable so submitted answers retain their original meaning; create a revised program for a new form.

An applicant submits with `POST /api/v1/program-applications`, an `Idempotency-Key` header, and a body such as:

```json
{
  "programId": "prg_...",
  "answers": { "support_needed": "..." },
  "confirmedByApplicant": true,
  "sandboxAcknowledged": true
}
```

`sandboxAcknowledged` is required only for practice programs. A person may submit once per program. The applicant and sponsor can exchange messages through their respective `/{applicationId}/messages` routes. The sponsor changes status through `PATCH /api/v1/staff/organizations/{orgId}/program-applications/{id}/status` with `{ "status": "under_review" }`. Allowed transitions are `submitted` to `under_review` or `information_requested`; `under_review` to `information_requested`, `approved`, or `declined`; and `information_requested` to `under_review` or `declined`. `approved` records a sponsor decision, not an Envoy eligibility determination or guaranteed award. Form answers and messages remain in D1; audit and outbox records include metadata rather than private answers.

The web module exports `createProgramIntakePage({view, locale, token, organizationId, onSignIn})`, with `view` set to `discover`, `mine`, or `sponsor`. It provides program browsing and review, a personal request timeline, and a sponsor form builder and inbox. The result/detail split becomes a full-width stacked layout on narrow screens; a single result fills the available width. The public Programs route currently opens official sources and does not mount the `discover` intake view, because no government sponsor has joined. The `mine` and `sponsor` views still support private follow-up and staff work. Official grant and benefit links remain external publisher handoffs.

## How to change it

Change form validation in `packages/domain/src/program-intake/index.ts`, the Worker route logic in `apps/worker/src/features/program-intake/index.ts`, and web fields in `apps/web/src/features/program-intake/`. Add a migration before changing persisted form or application state. Keep the published-form snapshot stable after submissions. If a new status is added, update the domain transition map, D1 constraint, and resident and sponsor labels together. The agent tool catalogue should expose any new manual action so both assistants have equivalent capability.

## Configuration

Migration `0017_program_intake.sql` creates sponsor programs, applications, and messages and seeds one clearly labelled practice program; `0020_program_intake_copy.sql` shortens its summary after the migration was already applied locally. The feature uses the existing Worker `DB`, `APP_ENV`, Auth0 domain/audience, and development-auth settings. Sponsor management requires persisted organization admin membership and the existing `manage:organizations` API scope. Applicant submission uses `submit:applications`; reading uses `read:applications`. The web API base comes from `VITE_API_BASE_URL`.

## Dependencies

Cloudflare D1, Auth0 token verification and organization membership, `@civicresolve/domain/program-intake`, shared audit/outbox tables, and the discovery feature for external publisher handoffs.
