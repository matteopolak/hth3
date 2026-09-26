# Envoy — Canada-wide civic product implementation plan

## 1. Decision and product

**Main track: Civic Technology.** A team may enter only one of Civic Technology, General, or CGI. Envoy will enter Civic Technology and only the side challenges demonstrated by working integrations. It will not claim a CGI or General entry.

Envoy is a working title for a bilingual (English/French) website and mobile app that helps people in Canada find public-sector jobs, benefits and food support, grants and scholarships, nearby public service locations, and ways to participate in civic decisions. It also contains a complete constructive-feedback system. Government organizations can join a shared staff workspace to publish jobs, receive applications and civic feedback, respond to residents, and understand recurring issues. The public app is task-oriented, not a single undifferentiated feed.

There are two kinds of opportunities, and the UI must not confuse them:

1. **Verified external opportunities** come from an identifiable government or program source. Their original URL, jurisdiction, attribution, checked-at time, and application destination are visible. An in-app preparation flow may help users assemble answers, but the app must not claim to have submitted to an external agency unless an authorized integration confirms it.
2. **Participating-employer opportunities** are published by an authenticated organization in Envoy. A person can upload a resume, complete a bilingual profile, review AI-suggested field values, and submit an application in the app. That application is persisted, visible to the employer in its dashboard, and has a real status and messaging trail.

Synthetic records may fill visual and test gaps only when persistently marked **Sample / not a real opportunity or service** in the record, search result, detail page, map, and video. Never extrapolate a real vacancy, grant, office, eligibility decision, or official submission from incomplete data. Extrapolation may be used for clearly labeled estimates or aggregate illustrations, not fictional official facts. No synthetic record is mixed into a real search without an obvious filter and badge. Seeded government organizations are fictional until a real organization onboards and verifies its affiliation.

The product has two complete loops:

```text
Discovery → verified source or participating employer → application preparation
→ in-app submission only to participating employer → employer review → applicant update

Resident feedback → clarification → Workers AI categorization → aggregate themes
→ authorized government-team review and response → resident outcome
```

The civic connection must be visible in the running product. For a hackathon deployment without an actual government partner, a clearly fictional test organization and employer based in a real municipality can exercise every internal loop. Municipality names and geographic boundaries must be real; do not invent a municipality to fill a data gap. The interface must never imply that the fictional account is a real Canadian government office or that feedback reached one.

### Confirmed product decisions

| Decision                                                              | Plan consequence                                                                                                                                                                                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canada-wide audience, not complete jurisdictional coverage on day one | Build a national location/jurisdiction model, begin with real federal plus BC/Ontario sources, and expose coverage gaps honestly.                                                                                                             |
| All core areas should be substantive                                  | Jobs, supports, funding, map, and feedback each need complete search/detail/action and staff or handoff flows; no decorative modules.                                                                                                         |
| Applications happen in-app where the receiver participates            | Reusable applicant profile/résumé autofill, review before submission, and a real organization-side inbox. External government systems get a clearly separate preparation/handoff path.                                                        |
| Government teams are the feedback audience and may also hire          | One organization can have civic and employer workspaces, with separate permissions and private data boundaries.                                                                                                                               |
| Web and mobile, English and French                                    | Public core journeys on both platforms; employer/administrator workflows are web-first. All critical product copy is maintained in both languages.                                                                                            |
| Quiet, monochrome visual design                                       | A compact, ChatGPT-like chat shell, small titles and breadcrumbs, straightforward lists and tables, and no uppercase eyebrow labels or filler descriptions. English is the showcase language; all critical copy also has French translations. |

### What “fully functional” means

Every feature presented as working must execute against the deployed application and persist the result. Specifically:

- Public web, mobile, and staff/employer web interfaces call the same live Cloudflare Worker API.
- English and French navigation, forms, validation, status messages, and critical program/application explanations are complete; language is a user preference, not an AI-only translation toggle. Source content stays identifiable as original-language or reviewed translation.
- Discovery works by location, jurisdiction, audience, category, and source status, with an explicit no-results state rather than fabricated coverage.
- A resume upload and profile can populate an application draft, but the applicant reviews and confirms every answer before submission.
- Participating employers can create a listing, receive and review an application, update its state, and communicate with the applicant. API tenancy prevents one employer from reading another employer's applications.
- Submitted feedback, messages, taxonomy versions, theme memberships, assignments, and audit events survive refresh and sign-in.
- Role restrictions are enforced by the Worker, not only hidden in the UI.
- Voice intake submits real feedback through the same API as text intake.
- Resident and employee agents expose the same actions as their respective website controls, within the caller's permissions.
- Published taxonomy changes affect later Workers AI classifications without code changes.
- The dashboard queries Tiger Data events written by actual feedback activity.
- Staff can see accurate category counts, trends, grouped themes, and evidence-linked summaries built from persisted feedback.
- A resident can see an assigned department, status changes, messages, and an outcome using an authenticated account or secure guest receipt link.
- Any Presage feature shown uses the actual SDK and changes the mobile interaction.
- The native SwiftUI iOS app performs the flows shown in the video against the live API.
- The Remotion video records or composes evidence from functioning product flows; it does not invent successful calls or display fabricated integration results.

Synthetic people and reports are appropriate **labeled** test content. Sample locations use real municipality names and are marked as samples; they do not imply a verified public office. Test fixtures and mocked providers may be used in automated tests. They must not substitute for a claimed live integration in judging or the final video.

### First-pass source coverage

Prioritize real federal sources and selected BC/Ontario sources, then extend to other jurisdictions source by source. Every adapter has a documented collection method, licence/terms check, refresh schedule, parser tests, and a freshness threshold. The [Open Government CKAN API](https://open.canada.ca/en/access-our-application-programming-interface-api) is a catalogue, not a unified live service API.

| Domain                     | Starting official sources                                                                                                                                                                                                                                                                                | Access reality                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jobs                       | [GC Jobs](https://www.canada.ca/en/services/jobs/opportunities/government.html), [BC Public Service](https://www2.gov.bc.ca/gov/content/careers-myhr/job-seekers/current-job-postings), [Ontario Public Service](https://www.gojobs.gov.on.ca/Jobs.aspx), later other provincial and municipal employers | Distinct portals; use permitted feeds/exports first, then source-specific collection where allowed. Most applications remain on employer sites unless the employer posts in Envoy. |
| Benefits and food support  | [Federal Benefits Finder](https://www.canada.ca/en/services/benefits/finder.html), [BC Benefits Connector](https://www2.gov.bc.ca/bcbenefitsconnector), Ontario program pages, [211 Canada](https://211.ca/data/) by data-sharing request                                                                | No national SNAP-style application or universal benefit API. Preserve jurisdiction, eligibility caveats, and official application links.                                           |
| Grants and student funding | [Federal grants](https://www.canada.ca/en/government/grants-funding.html), [all provincial/territorial student-aid entry points](https://www.canada.ca/en/services/benefits/education/student-aid/grants-loans/province-apply.html), BC and Ontario aid and scholarship sources                          | Award-disclosure data is not an open-opportunity feed. Capture deadline and sponsor from current official opportunity pages.                                                       |
| Offices and service map    | [Service Canada offices](https://offices.service.canada.ca/en), [ServiceOntario](https://www.ontario.ca/locations/serviceontario/), BC government locators and municipal open data                                                                                                                       | A government-owned building is not necessarily public-facing. Verify public access, offered services, hours, and accessibility.                                                    |
| Civic participation        | [Federal consultations dataset](https://open.canada.ca/data/en/dataset/7c03f039-3753-4093-af60-74b0f7b2385d), [BC engagement](https://engage.gov.bc.ca/), official local 311 links                                                                                                                       | External consultations and 311 requests are official handoffs; Envoy feedback is its own separately labeled workflow.                                                              |

Source-specific terms take precedence over a generic assumption that anything public may be scraped. [Open Government Licence datasets](https://open.canada.ca/en/open-government-licence-canada) require attribution; ordinary [Canada.ca page content has different terms](https://www.canada.ca/en/transparency/terms.html). Maintain a source registry and stop a broken or disallowed ingestion rather than silently replacing its results with generated entries.

## 2. Challenge coverage and judging

The [official competition guide](https://tracker.hackthehill.com/resources) permits one main track and multiple qualifying mini-challenges. Civic Technology asks teams to improve an interaction between people and a public institution. The running resident-to-department loop is the eligibility evidence.

Civic and General use the same **45-point** rubric:

| Criterion                        | Points | Product evidence                                                                                                                                                                                |
| -------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technical execution              |     15 | Working web/mobile discovery, résumé-assisted applications, employer review, feedback intake, Workers AI taxonomy decisions, aggregate staff view, authorization, persistence, and audit trail. |
| Idea and impact                  |     10 | A simpler route from a person's need to the right public opportunity, service, or civic team.                                                                                                   |
| Design and usability             |     10 | Distinct task-focused journeys, bilingual plain language, reviewable autofill, accessible alternatives, honest source labels, and useful staff overviews.                                       |
| Learning and technical decisions |      5 | Explain model boundaries, workflow safety, provider failures, and trade-offs made during the event.                                                                                             |
| Presentation                     |      5 | Timed live demonstration and direct answers during questions.                                                                                                                                   |

Judges assess what actually works in the normal in-person session. Mini-challenges are considered during that same session; there is no separate side-challenge presentation. The Devpost video supports the submitted project but does not replace the live demonstration. The broader product is not a reason to claim unfinished modules as complete.

### Targeted side challenges

| Challenge                                                       | Required working evidence                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Best Project Built with ElevenLabs / MLH Best Use of ElevenLabs | A real conversational voice session asks what happened and what should change, confirms the feedback, and submits it. The guide combines these into one challenge. |
| MLH Best Use of Tiger Data                                      | Feedback events enter a Tiger hypertable; continuous aggregates power category, volume, and trend charts.                                                          |
| MLH Best Use of Auth0                                           | Real staff login, role checks, protected API actions, and a denied unauthorized action.                                                                            |
| MLH Best Use of Presage                                         | A consented mobile interaction uses a real Presage SDK output to offer an accessibility adjustment, without changing feedback priority or eligibility.             |
| Best UI/UX                                                      | A low-friction resident journey and evidence-linked aggregate staff workspace with clear states and accessible controls.                                           |

Cloudflare Workers AI is a product technology rather than a prize entry. Do not enter Gemini, Solana, Vultr, or GoDaddy. The planned proprietary services make Best FOSS inapplicable. The current product does not qualify for Best Hardware Hack or MathemaTech; do not add token features just to enter them.

Only select a side challenge on Devpost after its working evidence exists. If a provider cannot be integrated, remove that claim and its prize selection rather than showing a simulation.

## 3. Scope and complete user journeys

### Public product modules

All modules must have functioning search/detail/action flows, loading/error/empty states, source provenance, and bilingual copy. A module is not “complete” because it has a homepage tile.

| Module                                       | Public journey                                                                                                                                                                                                                                                                                                                                    | Staff/employer journey                                                                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Government jobs                              | Search by role, location, employer, work arrangement, and deadline; save a posting; prepare an application from a résumé; apply inside Envoy only for participating employers.                                                                                                                                                                    | Verified employer publishes/updates/closes a posting, reviews applications, records decisions, and sends applicant updates.                                                                                              |
| Benefits and food support                    | Enter location and optional circumstances, compare relevant programs and community services, complete a reusable in-app intake/checklist, and see official application steps. For an onboarded program, submit its own configured intake form in-app; otherwise export answers or continue at the official site without a false submission state. | Authorized program staff may configure and receive first-party intake only for their program; curators correct source-backed records and refresh status. No staff member can manufacture an official eligibility result. |
| Grants, bursaries, scholarships, student aid | Search by audience, study level, field, jurisdiction, amount and deadline; save opportunities, build a checklist, prepare answers in-app, and follow the sponsor's actual application path.                                                                                                                                                       | Participating sponsors may publish a first-party opportunity and receive in-app applications; external awards remain official handoffs.                                                                                  |
| Nearby services map                          | Find public-facing offices and relevant community support by place/service, inspect accessibility, hours, contact details, freshness, and directions.                                                                                                                                                                                             | Curators verify imported locations; participating organizations maintain their own locations.                                                                                                                            |
| Civic feedback and complaints                | Submit criticism or suggestions by text/voice, review the summary, receive a private receipt, follow status and replies, and reopen with more information.                                                                                                                                                                                        | Government teams review evidence-linked themes, assign and respond, manage category rules, and see exact counts.                                                                                                         |
| Civic participation                          | Find open consultations and the right official channel; distinguish them from Envoy feedback.                                                                                                                                                                                                                                                     | Curators maintain source adapters; authorized government teams can publish their own engagement items.                                                                                                                   |

The app should also provide a small **My activity** area for saved items, applications, checklists, and feedback receipts. Status must reflect actual events in Envoy; “submitted” to an external employer or agency is never inferred from a click. An optional profile contains locale, location, accessibility preferences and résumé data. Browsing, map use, and guest feedback work without an account. In-app job, grant, or program applications need an account so applicants can return to drafts and messages. A participating organization may configure intake for its own program; this does not imply a universal government application gateway.

### Résumé-assisted applications

The applicant uploads PDF/DOCX or enters experience manually. The server extracts text and suggests structured education, work history, skills and contact fields with confidence/provenance; it must never invent qualifications. The user can edit or reject suggestions, attach the original résumé, answer posting-specific questions, review a final application, and explicitly submit. The in-app employer receives a persisted application and can shortlist, decline, request information, or send a decision. Every transition is audited and visible to the applicant. Personal data is private to the applicant and the receiving organization, with deletion/retention controls.

For an external posting, the same form is an **application preparation workspace**. It may copy/export answers and open the official application URL, but its state remains “prepared for external application,” not “submitted.” No automation should bypass CAPTCHA, login, or portal terms. A real employer account can opt into native applications; a fictional seeded employer cannot be portrayed as an official public institution.

### Source registry and provenance

Each imported record stores source ID and URL, publisher, licence/terms, country/province/municipality, language, external ID, fetched/last-verified timestamps, expiry or deadline, original payload hash, and an evidence link for each critical claim. Source adapters classify records as `verified_external`, `participating_org`, or `sample`. A nightly refresh rechecks time-sensitive jobs and deadlines, expires stale records, and surfaces parser failures to admins. Benefits and office hours need their own slower review cadence; a stale record remains visibly stale, never silently “current.” Manual overrides require a reason and audit event. Search can default to real results only while permitting an explicitly labeled sample-data mode for development and judging.

Normalize geography through province/territory plus municipality and postal-code location where supplied. Statistics Canada boundaries can aid routing, but statistical geography is not a guarantee of legal service jurisdiction. Personalizing search must not imply that an applicant is eligible; where rules are complex, show “may be relevant” with the official criteria and source.

### Default civic taxonomy

Ship a broad, editable Canada-oriented starter taxonomy. Residents do not need to browse or understand it before submitting. The platform first identifies the likely jurisdiction and participating organization, then applies that organization's published categories and routes. It must not tell a resident that a real government department received a report unless that department is onboarded and the API confirms receipt. Each published category has a stable ID, group, bilingual display name/description, inclusion/exclusion examples, optional follow-up fields, default department, and version. Initial groups and categories should cover:

| Group                        | Default categories                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streets and mobility         | Roads and potholes; sidewalks and crossings; streetlights and traffic signals; transit and bus stops; cycling and parking.                                                      |
| Environment and public space | Waste and recycling; parks and recreation spaces; trees and landscaping; noise and pollution; water, drainage, and sewer.                                                       |
| Buildings and community      | Housing and property standards; public facilities and libraries; community programs; public health and social services; community safety and bylaw enforcement.                 |
| Programs and institutions    | Benefits and income support; employment services; student aid and education; healthcare access; immigration and settlement services; taxation and revenue services.             |
| Access and administration    | Accessibility and language access; permits and licensing; fees and billing; application delays and decisions; websites and digital services; staff conduct and service quality. |
| Civic decisions              | Policy and planning; budget and spending; communication and transparency; other or unsure.                                                                                      |

Treat these as starter labels, not claims about any real government's jurisdiction. Include `other_or_unsure` and staff review so every submission has a safe route. Seed descriptions, examples, exclusions, and organization-specific department mappings, not just category names. Municipal service issues and provincial/federal program complaints may share a taxonomy group but cannot be assigned to an unrelated level of government. The starter set is inspired by the breadth of real [NYC311 report topics](https://portal.311.nyc.gov/report-problems/), which include both physical service issues and feedback about agencies and workers; Canadian routes still require Canadian-source verification.

Track **intent** separately from category: complaint, improvement suggestion, question/request, or positive feedback. A complaint about a public service and a suggestion to improve it can share a service category while remaining distinguishable in analytics.

Administrators can add, edit, reorder, and remove categories in the dashboard or through the agent. Removal means _retire from future classification_; historical submissions retain their original category ID and taxonomy version. Publishing a version updates the live classifier without a deployment. Preview the effect on example submissions before publication. An admin can also recategorize a submission with an audit trail.

Publishing validates unique IDs, nonempty descriptions, a valid group, a real destination department, and an active `other_or_unsure` route. The editor should show whether a category is draft, published, or retired and which taxonomy version classified each historical submission.

### Resident journey

1. Open the public site or mobile app and start writing or speaking without an account or category selection.
2. Describe what happened, why it matters, and what change would help. Location and evidence are optional unless essential to the specific issue.
3. Answer a small number of relevant follow-up questions; allow “I don't know” and skip nonessential fields.
4. Review and correct the summary before submission; show the original words alongside it.
5. Submit and receive a case number and a secure private receipt link. An optional Auth0 account can organize multiple submissions.
6. See the status, responsible public-service team, next step, and any staff response.
7. Add information or reply when staff request clarification.
8. See a concrete outcome, including an explanation if the institution cannot act, and reopen when appropriate.

The intake must work without a microphone, camera, address, or sign-in. Ask for contact details only if needed for follow-up, explain their use, and permit anonymous feedback. Protect guest receipt access with a high-entropy token stored hashed server-side; do not use the public case number as an access credential. Apply rate limits and an abuse-review path without putting an unnecessary form in front of every resident. Urgent emergencies must be directed to the appropriate emergency channel rather than treated as ordinary feedback.

### Resident agent journey

The public site and mobile app provide a persistent, ChatGPT-like conversation that works for guests. Its typed tools cover every resident action offered elsewhere in the product: search and filter sourced jobs, support, funding, offices and consultations; inspect details and provenance; save items and checklists; prepare and review profile, résumé, and application drafts; submit first-party applications; open official external handoffs; draft and submit feedback; and read or reply to a case through an authenticated account or secure guest receipt. Account-only actions ask the resident to sign in at execution time, while public discovery and guest feedback remain available without sign-in.

When a resident describes an unresolved service problem, the agent proactively offers to prepare a complaint or suggestion. It asks only for missing details needed for a useful submission, shows the original words and an editable proposed report, and submits only after explicit confirmation. It distinguishes Envoy's fictional sandbox from official government channels and never claims that an external application or report was submitted because a link was opened. Conversation history and pending drafts persist; tool results link to the same records and controls as the manual website.

### Government staff and employer journey

1. Sign in through Auth0 and see only authorized organization/department data.
2. Start on an aggregate overview: volume by category and intent, change over time, recurring themes, and unanswered concerns.
3. Read a short evidence-linked summary for a category or theme, then drill down only when detail is needed.
4. Review the individual submission, original text, classification, evidence, and history.
5. Accept, correct, recategorize, assign, or request more information.
6. Send a response and move the concern through valid states; record an outcome and later reopening.
7. Draft, preview, and publish a taxonomy or routing change when authorized.

An organization administrator can verify an employer profile, publish a job or grant opportunity, inspect only its own applicants, change application state, and send a message. A government organization may hold both **employer** and **civic reviewer** permissions in one account; permissions remain separate, least-privilege scopes. A hiring reviewer cannot read private civic submissions merely because they work for the same organization, and a civic reviewer cannot see résumés without hiring permission. Platform curators approve organization verification and source adapters but cannot impersonate a government applicant or silently alter their submissions.

The manual UI must support these operations even when the admin agent is unavailable.

Do not expose a button, tab, or action as available unless it has a working API path and an honest loading, success, and failure state. Hide unfinished settings or policy features rather than leaving inert controls.

Each UI implementer must regularly inspect the running website visually, not only rely on static checks. Inspect every changed route and surface at desktop, narrow, and mobile widths, with French text, empty/loading/error states, and the relevant role. Fix visible defects before claiming acceptance and report the exact route, width/device, and screenshot evidence. Inspect the native app on a real simulator or device when available; report an unavailable simulator separately from a completed visual check.

### Agentic staff journey

The ChatGPT-like interface can operate the entire **authorized** staff/employer workspace through typed tools. It can summarize grouped feedback, show counts and trends, open a filtered theme or submission tab, draft or retire a category, prepare a reply, propose reassignment, inspect the organization's job postings or applicant pipeline, draft a listing or applicant message, preview a taxonomy diff, and request approval for a write. Staff can edit the same objects manually in adjacent tabs. It cannot automatically reject applicants or infer protected traits from résumés.

Read tools may run immediately. Writes require a rich preview card with affected records, changes, and an explicit approval action. The Worker rechecks Auth0 claims, record versions, organization scope, and idempotency keys at execution time. The agent cannot bypass permissions or silently publish a change.

Chat and manual tabs share server state and version IDs. A manual edit appears in the agent context; an agent proposal appears in the relevant manual view. Conversation history and pending approvals persist across refreshes.

The agent tool set must cover the same useful operations as the manual workspace:

| Area       | Read tools                                                          | Write tools requiring preview and approval                                          |
| ---------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Feedback   | Search, open, inspect history and evidence                          | Correct fields, categorize, assign, change status, respond, resolve, reopen.        |
| Residents  | Read feedback conversation                                          | Draft and send a message; request more information.                                 |
| Taxonomy   | List categories and versions; compare changes                       | Add, edit, retire, restore, and publish categories and routing rules.               |
| Aggregates | Query exact counts, trends, and theme source links                  | Refresh summaries, correct a theme membership, save a view or report.               |
| Hiring     | Read postings and authorized application records; filter a pipeline | Draft/publish/close a posting, propose an application state change or message.      |
| Sources    | Inspect provenance, freshness, and ingestion errors                 | Propose a source correction; platform curator approval required for shared records. |
| Workspace  | Open tabs and inspect current context                               | Save or close a tab.                                                                |

Tools must return typed data for rich cards. A card should state its source, affected record/version, proposed edit, approval status, and final result. An employee can refuse, revise, or carry out the change manually.

## 4. Interfaces and design

### Shared visual language

Use a restrained black-and-white interface with readable typography, compact navigation, small titles, clear borders, and a prominent conversation surface. Take interaction cues from ChatGPT while keeping Envoy's own wording and layout. Design tokens, copy, and status names are shared across web, mobile, and video.

Use different interaction patterns for different tasks: a compact search/results list for jobs and awards; an editorial, step-by-step matcher for benefits; a true spatial map/list switch for offices; a calm wizard for applications and feedback; a timeline for status; a dense table/queue for staff work; and rich, selective cards only where the agent proposes a decision. Avoid nested cards, repeated dashboards, oversized headings on every page, prose where labels and actions suffice, and AI-generated filler. Maintain clear information hierarchy, progressive disclosure, useful filters, sensible defaults, and responsive breakpoints. Use real content samples to test text length in both languages, not English-only placeholder copy.

Prioritize meaningful states: empty, loading, listening, missing detail, awaiting approval, failed, retryable, completed, and read-only. Avoid decorative dashboards and fake AI activity.

### Staff web workspace

Use a left rail with recent agent threads and manual tabs for Overview, Feedback, Themes, Hiring, Applicants, Opportunities, Sources, Taxonomy, and Settings, filtered by role. The central surface shows a conversation or working tab. A context panel shows the selected theme, submission, posting, or application with its history and tool results. The agent conversation is not the only way to accomplish any core task.

The default overview should answer “What are people telling us?” before showing a queue: total submissions in the selected period, category and intent distribution, rising topics, repeated requests, unanswered volume, and a short summary of each theme. Counts come from database queries; summaries link to the submissions that support them. Staff can change time range, category, department, and status, and drill from a theme into original feedback.

Agent responses may render theme cards, submission cards, tables, charts, source links, taxonomy diffs, and approval cards. Every card should show its status and let the employee open the underlying object for manual editing. Keyboard navigation, search, visible focus, and clear error recovery are required.

### Public web experience

Use a prominent search/task entry that routes to Jobs, Support, Funding, Nearby, and Share feedback. Each area gets a purposeful visual structure. Source and sample badges, last-checked information, jurisdiction, deadline, and the true action destination must be visible on detail pages. Job/funding detail pages include a clear distinction between **Apply in Envoy** and **Continue on official site**.

The feedback flow remains calm and low-friction: prompt for a concrete experience and improvement; do not force a category, account, or location. Show the original wording and editable summary before submission. After submission, use a ticket-style receipt and timeline with ownership and next steps in plain language. Keep internal confidence scores, model names, and routing rules out of the public view.

### Native SwiftUI iOS app

Use native Swift and SwiftUI for a **real public iOS app**, not a video-only prop. It implements the versioned Worker API and English/French product copy with native `URLSession`, secure Keychain storage, and platform navigation rather than a webview. Keep Swift request/response models aligned with the shared API contract and verify parity in tests. It must support:

- Search/detail for jobs, support, funding, and nearby services, including source status and official handoff.
- Profile, résumé upload, application draft/review/submission for participating employers, and application status/messages.
- Text or voice feedback intake, follow-up, review/correction, live submission, and private receipt/status timeline.
- Optional Presage consent and accessibility adjustment, if entered for that prize.

Do not use local mock responses or a prerecorded success state in the shipped app. Platform administration and employer hiring review are web-first; mobile is for public users. If a staff mobile surface is later required, it is a separate scoped feature.

Store the guest receipt secret in secure device storage on mobile. The web app should present the private link clearly at submission time and avoid exposing its secret to analytics, logs, or public pages.

### Accessibility

Target WCAG 2.2 AA patterns where relevant: keyboard access and visible focus on web, labeled controls, status text that does not depend on color alone, captions/transcripts, a text alternative to voice, adequate touch targets, reduced motion, and plain-language errors. Presage must be opt-in, immediately disableable, and must never alter eligibility, priority, or department routing.

## 5. System architecture

```text
Public web + native SwiftUI iOS app    Government staff/employer web
                 \                     /
                  Cloudflare Worker API
                  ├─ Auth0 staff roles / optional resident account
                  ├─ secure guest receipts and rate limits
                  ├─ source registry / scheduled import adapters
                  ├─ search, profiles, resume drafts, applications
                  ├─ domain commands and agent tools
                  ├─ Workers AI extraction, categorization, summaries
                  ├─ resident and staff conversational agents
                  ├─ D1 transactional records and outbox
                  ├─ Tiger Cloud feedback-event analytics
                  ├─ R2 resumes, attachments and transcripts
                  ├─ Vectorize similar-feedback candidates
                  ├─ ElevenLabs voice agent webhooks
                  └─ Presage client data only when consented
```

The Worker owns authorization, validation, orchestration, and external secrets. Clients do not call privileged providers directly. Cloudflare D1 is the transactional source of truth for imported records, postings, applications, feedback, categories, themes, and an event outbox. Tiger Cloud receives validated feedback events from that outbox and powers time-series aggregates and staff trend charts; it is not a competing write store for applications or private feedback. The outbox retries safely by event ID, exposes lag to staff, and never turns an analytics outage into a false failure of a resident submission. R2 stores résumés, attachments and transcript artifacts with access controlled through the Worker. Search indexes and caches are derived and rebuildable. A scheduled import job updates source-backed records without exposing provider credentials to clients.

The product can run for a fictional organization/employer in a real municipality without an external government integration. It must never imply that reports or applications are being sent to a real public agency. Within its own resident, applicant and staff accounts, posting, applying, review, feedback submission, assignment, communication, and resolution must all work.

### AI responsibilities

- **Workers AI:** use `@cf/ibm-granite/granite-4.0-h-micro` as the initial inexpensive standard model for structured extraction, published-taxonomy intent/category decisions, redacted theme summaries, and both resident and staff conversations. Keep the model ID configurable and validate outputs as proposals against domain rules and permissions.
- **Vectorize and Tiger:** find semantically similar feedback as candidate theme members, then store reviewed membership and exact counts in Tiger.
- **Application rules:** validate all model output, keep original submissions, enforce authorization and state transitions, and send uncertain or sensitive reports to staff review.

Classification contract:

```ts
type ClassificationInput = {
  feedbackText: string;
  extractedFields: Record<string, unknown>;
  taxonomyVersion: string;
  categories: Array<{
    id: string;
    groupId: string;
    description: string;
    examples: string[];
    exclusions: string[];
  }>;
};

type ClassificationResult = {
  intent: "complaint" | "suggestion" | "question" | "positive";
  categoryId: string;
  confidence: number;
  alternatives: string[];
  provider: "workers-ai";
  modelVersion: string;
};
```

Construct a bounded classification prompt from the current published category descriptions and examples. Select a broad group and then a category in that group; retain an `other_or_unsure` route. Validate the model's selected ID against the published taxonomy and store intent, category, confidence, model ID, taxonomy version, and review outcome. Uncertain output goes to staff review. Tests may use a fixture provider, but neither the video nor the live product should present fixture output as a live model result. Use only verified no-charge Workers AI allocation; never upgrade a plan or incur usage-based charges. Workers Free inference fails after its 10,000 Neurons/day allocation; Workers Paid can bill beyond that allocation, so verify the actual account plan and usage before live calls. If the free boundary cannot be verified, leave live inference acceptance open.

### Aggregation and summaries

The staff landing page must make large volumes of feedback readable without forcing staff to open every submission:

1. Query exact current operational counts from D1 and time-series trends from Tiger by time window, category, intent, department, and status. Show Tiger's synchronized-through time beside those charts so an ingestion lag is not mistaken for missing reports.
2. Find similar submissions within a category using Workers AI embeddings and Vectorize; persist reviewed theme membership in D1 and emit corresponding analytics events to Tiger. A submission may belong to one primary theme and retain its original category.
3. Generate a concise theme summary with Workers AI from redacted source text. Include what residents report, what changes they request, the number of linked submissions, and representative source IDs.
4. Show theme cards sorted by volume or change over time, with links to a filtered list of original submissions.
5. Allow staff to correct a category, split/merge themes, or mark a summary as inaccurate. Regenerate affected summaries after new submissions or corrections.

Numerical claims come from SQL, not the language model. Summaries carry a generated-at timestamp and source links; stale summaries are marked as such. Protect private details in the aggregate view and do not quote a small or sensitive cohort without staff access. The original submission always remains available to authorized reviewers.

An example theme card, with illustrative values only:

```text
Permit website loses saved drafts
38 submissions · 12 more than the previous period · Digital services
Residents report losing progress when the form times out.
Common request: save a draft and resume later.
[Read summary sources] [Open 38 submissions] [Assign owner]
```

Do not count one submission multiple times within a category or theme. Show whether a metric counts submissions, people, or themes, because those are different measures.

### Data and events

Core entities: organizations and their verification state; users, memberships and roles; source registry, ingestion runs and errors; source-backed opportunities, benefits, services and locations; first-party postings; public profiles and résumé assets; application drafts, answers, submissions, messages and transitions; saved items and checklists; feedback submissions, guest access tokens, messages, attachments, classifications, category groups, categories, taxonomy versions, routing rules, themes, theme memberships, theme summaries, status transitions, voice sessions, agent threads/messages/tool calls, workspace tabs, and audit events.

Keep imported source data separate from organization-authored data and labeled samples. Use stable IDs and deduplication by publisher/external ID/source URL, plus a reviewed merge path when two sources describe the same opportunity. Preserve original source text and its last verified timestamp. Sensitive applicant information must not enter public analytics, agent prompts unrelated to hiring, or feedback aggregates. Encrypt transport/storage as supported by the providers, use short-lived signed asset access, enforce deletion/retention policies, and log access to résumés.

At minimum, each event stores submission ID, event type, timestamp, actor, organization, and validated payload. Persist an event for creation, classification, correction, theme membership, assignment, status change, message, outcome, reopening, taxonomy publication, and agent approval/execution.

Create a Tiger `feedback_events` hypertable and continuous aggregates for intake volume over time, category/intent counts, and at least one operational metric such as acknowledgement time. Dashboard charts must query those aggregates, and the UI must show the latest synchronized event timestamp. Historical synthetic submissions may seed the database with a sample flag, but new user and staff actions must produce real D1 outbox events that arrive in the same Tiger charts. Keep the D1 outbox until Tiger acknowledges each event; replay must be idempotent.

### Feedback state machine

```text
draft → submitted → categorized or needs_review → assigned → acknowledged
→ in_review → waiting_on_resident → outcome_recorded → closed
                               outcome_recorded → reopened → assigned
```

An outcome can be action taken, planned action, referral, or no action with an explanation. Criticism should not be marked “resolved” merely because staff read it. Each transition has an allowed actor/role, required fields, and an audit event. Rejected transitions return a clear error. Staff must be able to complete the full path and residents must see its result.

### Integrations

- **Auth0:** real staff and administrator sign-in, optional resident accounts, organization/department roles, Worker-side JWT and scope validation, protected mutations, and an observable access-denied path. Guest feedback and private receipt links work without Auth0; their access tokens are checked by the Worker. Use step-up authentication for high-impact actions if available within the build time.
- **Source ingestion:** one adapter per provider, using an approved API/feed/open dataset where possible. A portal without permitted machine access remains an official link or a manually reviewed record. Do not scrape authenticated application portals. Respect source terms, attribution, rate limits, and deletion notices. Provider failures are visible in Sources and never silently replenished with fake records.
- **Résumé extraction:** parse PDF/DOCX through a bounded server-side pipeline, suggest fields with Workers AI where useful, and return source spans for user review. Store the original file privately; never auto-submit an unreviewed guess or infer protected personal attributes for ranking.
- **ElevenLabs:** actual conversational agent that invites constructive detail (“What happened?” and “What would improve it?”), asks relevant follow-ups, confirms the summary, and submits feedback through a signed Worker webhook. Handle retries and duplicate webhooks.
- **Tiger Data:** real PostgreSQL connection, schema migrations, feedback-event hypertable, continuous aggregates, and dashboard queries. Verify Worker connectivity early.
- **Presage:** real SDK integration in the mobile app, explicit consent, one measurable interaction adaptation (for example, shorter prompts or a pause offer), and no service decision based on biometric output. Validate SDK/device feasibility early.
- **Workers AI categorization:** validate model output and category IDs against the published taxonomy; route uncertainty for human review.

External calls need timeouts, request IDs, idempotency where relevant, retry/error states, and audit visibility. A provider outage may degrade that feature but must not silently create false success.

### Minimum API surface

The Worker should expose versioned, schema-validated routes for:

- Guest submission, attachment upload, and private receipt/status access.
- Public discovery search/detail and provenance for jobs, benefits, funding, consultations and locations; saved items and checklists.
- Applicant profile/résumé upload, application draft/autofill/review/submission, and status/messages.
- Participating organization verification, posting management, applicant queue, employer messages and audited decisions.
- Source registry, import-run status, stale-record and sample-data controls for authorized curators.
- Guest follow-up messages and optional account claim.
- Staff overview counts, trends, theme summaries, and filtered source submissions.
- Staff assignment, response, state transition, theme correction, and summary refresh.
- Category/group drafts, preview, publication, and retirement.
- Agent threads, tool results, rich approval cards, and approved tool execution.
- ElevenLabs signed webhook delivery and idempotent session completion.

Each route needs an explicit auth mode: public read, public feedback submission with abuse controls, guest receipt token, authenticated applicant/resident, scoped hiring reviewer, scoped civic staff, organization administrator, or platform curator. Never expose résumé data to a different organization, feedback text through public counts, or sampled records as if they were official.

## 6. pnpm workspace and CI

Use one pnpm lockfile and typed package boundaries:

```text
apps/
  web/          # public and government staff/employer web UI
  worker/       # Cloudflare API, discovery, applications, feedback, tools, webhooks
  mobile/       # native Swift/SwiftUI public iOS app
  remotion/     # five-minute video composition
packages/
  contracts/    # bilingual request/response, events, tool and card schemas
  domain/       # application/feedback states, permissions, provenance rules
  db/           # D1 transactional migrations; Tiger analytics schema and queries
  ai/           # Workers AI, classification, agent, resume extraction adapters
  sources/      # approved feeds, normalizers, registry and freshness rules
  i18n/         # English/French message catalogues
  ui/           # shared web components
  design-tokens/
  fixtures/     # synthetic test data only
  config/
docs/
PLAN.md
pnpm-workspace.yaml
pnpm-lock.yaml
```

Root commands: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check`, `pnpm video:render`, and `pnpm deploy`. `pnpm check` is the local CI gate.

CI runs on every push to `main`: frozen install, formatting/lint, typecheck, domain/permission/provider tests, migrations against a disposable database, a web build, and a Worker smoke test. A macOS job builds the native SwiftUI iOS app with `xcodebuild`. End-to-end tests must cover a verified-source search with official handoff; a labeled sample record; résumé draft/review/native application to a participating employer and its staff-side decision; and guest feedback from intake through a staff response and resident receipt. Add locale parity checks and an English/French flow test. Provider adapters can be stubbed in automated tests; run a separate pre-submission integration check with real sponsor services.

Deployment is a separate job after checks pass. Secrets stay in Cloudflare/GitHub secret stores. The deployed app and video must use the same contracts and status vocabulary.

## 7. Subagent delivery protocol

The full ownership ledger, parallel release schedule, handoff requirements, and [GitHub epic/sub-issue map](docs/orchestration.md) are in the orchestration document. The tracker is planning infrastructure, not authorization to start implementation.

Use only Luna subagents at `high` or `xhigh` reasoning. All agents may work in the same checkout and `main` branch. The orchestrator assigns one file owner per active unit and maintains an ownership ledger; agents must not edit another active unit’s files. After the core gate, cap active feature agents at four and use fewer whenever ownership or provider access overlaps.

### Sequential foundation gate

One core subagent first builds a working vertical slice: pnpm workspace, contracts, English/French catalogues, Worker/API, D1 persistence/outbox, scoped organization/applicant roles, source/sample provenance, one participating-employer posting and in-app application, secure guest feedback/receipt, a seeded taxonomy, manual staff queues, status mutations, and public web/mobile shells. It runs relevant checks, commits, and pushes before feature agents begin. External credentials are required for live provider acceptance; a local fixture may support tests but must be clearly marked and never represented as the live integration.

The orchestrator verifies the local vertical slices, role boundaries, shared contracts, and CI. Only then does it delegate feature-sized units from the [native GitHub blocker queue](https://github.com/matteopolak/hth3/issues) with explicit package/file ownership, dependencies, acceptance behavior, and test commands. Deployed provider acceptance remains a separate gate when credentials are available. Suggested later units: source adapters/search, résumé extraction/application UX, benefits and funding guidance, map/locations, ElevenLabs intake, Workers AI decisions, theme grouping and summaries, both resident and staff agents with full website tool parity, Tiger dashboard, mobile/Presage, design polish, and Remotion capture/render.

For shared interface changes, commit a contract update first, then release dependent units. The orchestrator owns root/entrypoint and overview-doc edits after foundation. Agents stage only their owned paths; commits and pushes use a short serialized Git lane in the shared checkout. Do not pull/rebase while another agent has uncommitted work. Resolve cross-owner conflicts through the orchestrator; never discard another agent’s work. Run `pnpm check` after each integration wave.

Each completed unit is committed and pushed to `main` with a Conventional Commits subject only: `type(scope): imperative summary`. No commit body, description, or co-author trailer. Report the commit, files changed, checks run, and any remaining limitation.

## 8. Presentation and five-minute video

### In-person Civic presentation

Five minutes to present and show the working product, followed by three minutes of questions. Lead with one person's path across a real sourced job/support search, a résumé-assisted application to a clearly fictional participating employer, and constructive feedback. Switch to the government workspace: the employer sees the application; civic staff see Workers AI categorization and recurring themes, respond, and the resident sees the response. Demonstrate both conversational agents, an approval card, and manual edit if complete. Say explicitly which opportunities are official external links and which are fictional sandbox records. Use real service integrations for any sponsor claim made during judging.

### Remotion Devpost video

Remotion is an editor/compositor for a five-minute account of the **working** product. Capture actual web and mobile interactions, real voice audio/transcripts, real database-backed state changes, and real sponsor integration results. Use motion graphics to explain the architecture and transitions; do not animate a feature that has no working implementation.

Suggested timing (adjust to what is implemented and legible):

1. 0:00–0:40 — the fragmented Canadian service journey and the location-aware entry point.
2. 0:40–1:45 — verified jobs/support/funding and nearby offices; clear source and sample labels.
3. 1:45–2:35 — résumé-assisted native application and employer review in the working fictional sandbox.
4. 2:35–3:25 — guest web/mobile feedback, proactive resident-agent complaint draft, ElevenLabs follow-up and Workers AI categorization.
5. 3:25–4:25 — aggregate civic dashboard, agent approval card, Tiger trends, staff response and resident status.
6. 4:25–5:00 — real Presage interaction if working, architecture, bilingual experience, and honest limitations.

Keep captions readable and the recorded UI legible at normal playback size. If a sponsor feature is incomplete, remove its segment and prize selection. The video cannot stand in for the in-person live evaluation.

## 9. Build order and acceptance

### Gate A — complete shared platform and civic loop

- A guest submits constructive criticism on the deployed site without choosing a category or creating an account.
- Worker persists the original text, secure receipt token hash, submission, and outbox event in D1; the event reaches Tiger asynchronously.
- Staff signs in via Auth0, assigns and acknowledges it, then records an outcome.
- Guest opens the private receipt link and sees the department, update, and outcome.
- Guest can provide more information; authorized staff can reopen or close the submission.
- Invalid token, role, and state transition are rejected.
- Web and mobile use the same bilingual contracts and API; source/sample provenance and organization scope are enforced server-side.

### Gate B — discovery and in-app application

- Real federal plus BC/Ontario source records are visible with source links, last-checked times, jurisdiction, and honest stale/no-results states.
- Jobs, benefits/food support, funding, and nearby offices have functional search/detail/action flows on web and mobile, with accessible English and French UI.
- A clearly fictional sandbox employer can publish a posting; a user can upload a résumé, edit extracted suggestions, apply, and receive a real status/message from that employer's scoped dashboard. Verification as a real government organization requires an actual onboarding process.
- A participating grant sponsor or support program can configure an intake form, receive a reviewed in-app application, and send a status update. External grants and benefits provide the same preparation/checklist experience but end with the actual official handoff and no Envoy “submitted” claim.
- The office map and accessible list show only verified public-facing locations or plainly labeled samples; filtering by service, accessibility, and distance returns the same underlying results.
- Consultations expose deadline, jurisdiction, official source, and a truthful participation destination; first-party consultations accept and persist a response only for an onboarded organization.
- An external listing supports preparation and official-site handoff, never false “submitted” state.
- A sample record remains labeled across search, detail, saved items, map, application preparation, and video.

### Gate C — categorization, aggregation, and configuration

- Workers AI extracts useful fields from a real submission without replacing the resident's original words.
- Workers AI chooses intent and a published category; low confidence reaches human review.
- The database ships with the full starter taxonomy described above.
- Admin adds, edits, and retires categories; the next submission uses the newly published version, while history remains readable.
- Two related submissions appear in one theme with an exact count; the summary links back to both source records.
- A new submission updates Tiger counts and eventually refreshes the relevant theme summary.
- Agent tools and manual tabs perform the same authorized commands.
- Approval cards show exact changes and cannot execute after stale previews.

### Gate D — side-challenge integrations

- ElevenLabs voice session submits feedback with a transcript and a useful follow-up question.
- Tiger dashboard reflects actual feedback events through a continuous aggregate.
- Auth0 role denial and permitted mutation both work.
- Presage changes one consented mobile interaction from a real SDK signal.
- Resident and staff UI are usable with keyboard/text alternatives.

### Gate E — delivery

- Deployed web and Worker routes pass smoke tests.
- Mobile app performs each recorded interaction against the deployed API.
- Five-minute Remotion video is captured from the working build and rendered with captions.
- Draft Devpost submission is created by Sunday 12:00 AM and final selection, roster, links, and video are submitted by Sunday 10:00 AM Eastern, per the event guide.

The end-state scope includes every module listed in Section 3; gates order implementation and verification rather than redefining an unfinished module as complete. Do not mark an incomplete feature as functional or fill missing coverage with unlabeled generated content. If external credentials or partner access are unavailable, report that acceptance blocker plainly.

## 10. Configuration and source references

Expected configuration includes Auth0 domain/audience/client ID, D1 database binding, Tiger connection settings, Cloudflare AI/R2/Vectorize bindings and selected model IDs, source adapter URLs/keys and refresh schedules, ElevenLabs agent ID and webhook secret, and Presage SDK configuration. Use environment-specific secrets; never commit credentials, `.dev.vars`, real applicant résumés, or recordings containing real personal information. A deployment needs an explicitly configured application origin and permitted CORS origins for web/mobile.

- [Hack the Hill III competition guide](https://tracker.hackthehill.com/resources)
- [MLH Hack the Hill prize categories](https://www.mlh.com/events/hack-the-hill-30/prizes)
- [Cloudflare Workers AI documentation](https://developers.cloudflare.com/workers-ai/)
- [ElevenLabs Agents documentation](https://elevenlabs.io/docs/eleven-agents/overview)
- [Tiger Data documentation](https://www.tigerdata.com/docs)
- [Auth0 documentation](https://auth0.com/docs)
- [Presage SmartSpectra documentation](https://smartspectra.presagetech.com/)
- [Remotion documentation](https://www.remotion.dev/docs/)
