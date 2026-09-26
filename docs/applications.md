# In-app applications and employer workspace

Planning status: the application and employer workflows below are specifications, not implemented features.

## What it is

CivicResolve is planned to let people prepare applications from a résumé and submit them inside the app **only** to organizations that have opted into its hiring workflow. External government postings remain official-site handoffs, with a preparation workspace but no false submission state. The same distinction applies to grants and benefits: an onboarded sponsor/program can receive its own in-app intake; external programs get reusable answers and a truthful handoff, not a simulated official submission.

## How it works

An authenticated applicant uploads a PDF/DOCX résumé or enters details manually. Extraction produces editable suggestions for contact information, education, experience and skills. Each suggestion retains a source span or a clear “not found” state; the system must not invent qualifications or decide eligibility. The applicant reviews answers and posting-specific questions, then confirms submission. The Worker persists the application, attachments, state transitions and audit events. The receiving organization's hiring reviewer can read only applications to that organization's postings, request more information, shortlist or decline with an appropriate message, and update status. The applicant sees those changes in My activity.

For a `verified_external` posting or program, the same draft tool can organize answers and link to the official application. Opening that link records only an outbound handoff. The app must never label it “submitted,” claim an official application ID, or automate a protected portal. For a `sample` posting, the whole record and any sandbox application remain clearly marked as fictional. A government-branded account is verified before it can publish real first-party postings; employer and civic-feedback permissions are separate even within one organization.

The application state machine is `draft → submitted → under_review → information_requested/shortlisted/declined/offer`, with explicit authorized transitions and applicant-visible history. An external draft has a separate `prepared_for_external` state and cannot enter the native submitted pipeline. Store résumé assets privately, issue short-lived access to authorized reviewers, and support retention/deletion. Do not put applicant data in public search, feedback analytics, or unrelated agent prompts.

## How to change it

Change shared contracts and the state machine before adding a new application status or form field. Add a migration and a role/tenant test for every new reviewer capability. Add both English and French copy for any applicant-facing step, including validation and email/message templates. Update the public detail page if the action destination changes. Test that an employer cannot read or update another employer's application, and that a civic-only staff account cannot see résumés.

## Configuration

Worker/D1 bindings store application records and transitions; R2 stores files. Set allowed upload types and byte limits, signed-download expiry, retention policy, and permitted application origins. Auth0 issuer/audience/client settings govern accounts and organization membership. Local development identity, if present, must be explicitly disabled in production.

## Dependencies

Shared contracts/domain rules, Cloudflare Worker, D1, R2, Auth0, web and mobile clients, and optional résumé parsing/Workers AI. AI autofill is an assistive draft feature; native submission and manual entry must still work if it is unavailable.
