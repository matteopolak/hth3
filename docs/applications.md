# In-app applications and employer workspace

Implementation status: the Worker supports sample and verified participating-employer postings, applicant-confirmed submissions, private applicant/employer messages, and audited decisions. Owner-scoped profiles, private PDF/DOCX résumés, source-linked extraction suggestions, and explicit résumé sharing work locally. No real employer is onboarded yet; live Auth0 acceptance remains separate.

## What it is

Envoy lets people submit inside the app only to organizations that have opted into its hiring workflow. The seeded Toronto organization is an unverified practice workspace; verified non-sample organizations can publish first-party postings once onboarded. External government postings remain official-site handoffs, with a preparation workspace but no false submission state. The same distinction applies to grants and benefits: an onboarded sponsor/program can receive its own in-app intake; external programs get reusable answers and a truthful handoff, not a simulated official submission.

## How it works

An applicant can browse `GET /api/v1/postings`, prepare answers, and submit to a published participating-employer posting through `POST /api/v1/applications`. Submission requires an authenticated Applicant role, `submit:applications`, an explicit `confirmedByApplicant: true`, and an idempotency key. Applicant ownership uses the Auth0 token subject; the applicant does not need membership in the employer organization. `GET /api/v1/applications` and `GET /api/v1/applications/{id}` expose only the caller's own records. The receiving organization's hiring reviewer or organization admin can read its employer queue and update allowed states through the organization-scoped staff API. Applicant status reads show those changes. Current status progression is `submitted → under_review → information_requested/shortlisted/declined`, with `shortlisted → offer/declined`; invalid moves return `409`.

Each sample posting and application is explicitly marked sample/fictional and does not imply a real vacancy or government affiliation. D1 stores answers, while audit and outbox records store status metadata without answer text. The local smoke uses fixed development principals, exercises applicant ownership and employer/civic role boundaries, and confirms persistence after a Worker restart. It is not a live Auth0 token test or a real employer submission.

The applicant may save a manual profile, upload a PDF or DOCX résumé to private R2, and request deterministic text extraction. Suggestions for contact details, education, experience, skills, and summary carry literal source spans for review; the upload never changes the profile or submits an application automatically. A résumé is shared with the receiving employer only through an explicit application-bound action. The same-organization hiring reviewer can then download it, while a different organization and civic-only staff cannot. Deleting the résumé or profile revokes access. See [Applicant profile and résumé extraction](applications/resume-extraction.md) for limits and retention behavior. External posting handoffs must never be labeled submitted or claim an official application ID.

For a `verified_external` posting or program, the same draft tool can organize answers and link to the official application. Opening that link records only an outbound handoff. The app must never label it “submitted,” claim an official application ID, or automate a protected portal. For a `sample` posting, the whole record and any sandbox application remain clearly marked as fictional. A government-branded account is verified before it can publish real first-party postings; employer and civic-feedback permissions are separate even within one organization.

The remaining application work is persistent drafts, prepared external handoffs, and a fuller status history. Private applicant/employer messages and decisions are implemented in the [employer workspace](applications/employer-workspace.md). External drafts must never enter the native submitted pipeline. Do not put applicant data in public search, feedback analytics, or unrelated agent prompts.

## How to change it

Change shared contracts and the state machine before adding a new application status or form field. Add a migration and a role/tenant test for every new reviewer capability. Add both English and French copy for any applicant-facing step, including validation and email/message templates. Update the public detail page if the action destination changes. Test that an employer cannot read or update another employer's application, a civic-only staff account cannot read applications, and a non-owner cannot read an applicant record. Non-sample publishing requires the existing organization verification boundary.

## Configuration

Worker/D1 bindings store application records and transitions; private R2 stores résumés. The upload accepts PDF/DOCX up to 5 MB and the current retention setting is 365 days, enforced on access and purge; there is not yet a scheduled global sweep. Auth0 issuer/audience/client settings govern accounts and organization membership. The Applicant role has `read:profile` and `write:profile` API grants. The local sample uses `sample-posting-intake-assistant` and `org_43G1B1RhPwac7EjS`; local development identities must be disabled in production.

## Dependencies

Shared contracts/domain rules, Cloudflare Worker, D1, R2, Auth0, and web/native iOS clients. The current résumé extraction has no AI dependency. Future AI autofill is an assistive draft feature; native submission and manual entry must still work if it is unavailable.
