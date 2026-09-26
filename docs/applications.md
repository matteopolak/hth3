# In-app applications and employer workspace

Implementation status: the local sample posting supports an applicant-confirmed submission and an employer review/status loop. Résumé parsing, attachments, external posting handoffs, messages, and production/live Auth0 acceptance remain later work.

## What it is

CivicResolve lets people submit inside the app only to organizations that have opted into its hiring workflow. The current foundation implements that boundary with one clearly marked sample posting and a fictional, unaffiliated Toronto sandbox organization. External government postings remain official-site handoffs, with a preparation workspace but no false submission state. The same distinction applies to grants and benefits: an onboarded sponsor/program can receive its own in-app intake; external programs get reusable answers and a truthful handoff, not a simulated official submission.

## How it works

An applicant can browse `GET /api/v1/postings`, prepare answers, and submit to the sample posting through `POST /api/v1/applications`. Submission requires an authenticated Applicant role, `submit:applications`, an explicit `confirmedByApplicant: true`, and an idempotency key. Applicant ownership uses the Auth0 token subject; the applicant does not need membership in the employer organization. `GET /api/v1/applications` and `GET /api/v1/applications/{id}` expose only the caller's own records. The receiving organization's hiring reviewer or organization admin can read the sample employer queue and update allowed states through the organization-scoped staff API. Applicant status reads show those changes. Current status progression is `submitted → under_review → information_requested/shortlisted/declined`, with `shortlisted → offer/declined`; invalid moves return `409`.

Each sample posting and application is explicitly marked sample/fictional and does not imply a real vacancy or government affiliation. D1 stores answers, while audit and outbox records store status metadata without answer text. The local smoke uses fixed development principals, exercises applicant ownership and employer/civic role boundaries, and confirms persistence after a Worker restart. It is not a live Auth0 token test or a real employer submission.

Résumé upload/parsing is not implemented yet. When added, extraction must produce editable suggestions for contact information, education, experience, and skills. Each suggestion should retain a source span or a clear “not found” state; the system must not invent qualifications or decide eligibility. External posting handoffs must never be labeled submitted or claim an official application ID.

For a `verified_external` posting or program, the same draft tool can organize answers and link to the official application. Opening that link records only an outbound handoff. The app must never label it “submitted,” claim an official application ID, or automate a protected portal. For a `sample` posting, the whole record and any sandbox application remain clearly marked as fictional. A government-branded account is verified before it can publish real first-party postings; employer and civic-feedback permissions are separate even within one organization.

The full product is planned to add `draft` and `prepared_for_external` states, résumé parsing, private attachments, status history, and appropriate applicant/employer messages. Those pieces are not part of the local foundation API yet; the current sample loop exposes the persisted current status only. External drafts must never enter the native submitted pipeline. When attachments are added, store résumé assets privately, issue short-lived access to authorized reviewers, and support retention/deletion. Do not put applicant data in public search, feedback analytics, or unrelated agent prompts.

## How to change it

Change shared contracts and the state machine before adding a new application status or form field. Add a migration and a role/tenant test for every new reviewer capability. Add both English and French copy for any applicant-facing step, including validation and email/message templates. Update the public detail page if the action destination changes. Test that an employer cannot read or update another employer's application, a civic-only staff account cannot read applications, and a non-owner cannot read an applicant record. If public employers are added, require an explicit onboarding/verification boundary before they can publish non-sample postings.

## Configuration

Worker/D1 bindings store application records and transitions; R2 stores files when uploads are introduced. Set allowed upload types and byte limits, signed-download expiry, retention policy, and permitted application origins before enabling uploads. Auth0 issuer/audience/client settings govern accounts and organization membership. The local sample uses `sample-posting-intake-assistant` and `org_43G1B1RhPwac7EjS`; local development identities must be disabled in production.

## Dependencies

Shared contracts/domain rules, Cloudflare Worker, D1, R2, Auth0, web and mobile clients, and optional résumé parsing/Workers AI. AI autofill is an assistive draft feature; native submission and manual entry must still work if it is unavailable.
