# CivicResolve — Hack the Hill III implementation plan

## 1. Decision and product

**Main track: Civic Technology.** A team may enter only one of Civic Technology, General, or CGI. CivicResolve will enter Civic Technology and the side challenges for which its finished product qualifies. The product will not claim a CGI or General entry.

CivicResolve is a working civic feedback platform for constructive criticism, complaints, and improvement suggestions. A resident explains what happened and what should change in their own words, by text or voice. The platform asks only useful follow-up questions, creates a trackable submission, and routes it to the appropriate public-service team. Staff see a counted, summarized view of recurring issues before opening individual submissions. Authorized administrators can add, edit, retire, and route categories through manual screens or an agentic conversation. The system records consequential actions and shows whether concerns are acknowledged and addressed.

The end-to-end path is:

```text
Resident feedback → clarification → persisted submission → Jev categorization
→ aggregated themes → staff review/action → resident update → measured outcome
```

The civic connection must be visible in the running product: a named public department owns a concern, staff can acknowledge or act on it, and the resident can see an outcome. Use a clearly fictional municipality for the hackathon rather than imply that a real city has integrated its systems.

### What “fully functional” means

Every feature presented as working must execute against the deployed application and persist the result. Specifically:

- Resident and staff interfaces call the same live Cloudflare Worker API.
- Submitted feedback, messages, taxonomy versions, theme memberships, assignments, and audit events survive refresh and sign-in.
- Role restrictions are enforced by the Worker, not only hidden in the UI.
- Voice intake submits real feedback through the same API as text intake.
- The admin agent uses the same authorized commands as manual controls.
- Published taxonomy changes affect later Jev classifications without code changes.
- The dashboard queries Tiger Data events written by actual feedback activity.
- Staff can see accurate category counts, trends, grouped themes, and evidence-linked summaries built from persisted feedback.
- A resident can see an assigned department, status changes, messages, and an outcome using an authenticated account or secure guest receipt link.
- Any Presage feature shown uses the actual SDK and changes the mobile interaction.
- The React Native app performs the flows shown in the video against the live API.
- The Remotion video records or composes evidence from functioning product flows; it does not invent successful calls or display fabricated integration results.

Synthetic people, locations, and reports are appropriate test content. Test fixtures and mocked providers may be used in automated tests. They must not substitute for a claimed live feature in judging or the final video.

## 2. Challenge coverage and judging

The [official competition guide](https://tracker.hackthehill.com/resources) permits one main track and multiple qualifying mini-challenges. Civic Technology asks teams to improve an interaction between people and a public institution. The running resident-to-department loop is the eligibility evidence.

Civic and General use the same **45-point** rubric:

| Criterion | Points | Product evidence |
| --- | ---: | --- |
| Technical execution | 15 | Live feedback intake, Jev taxonomy decisions, aggregated staff view, authorization, persistence, and audit trail. |
| Idea and impact | 10 | A lower barrier to constructive civic feedback and a faster way for public teams to understand recurring concerns. |
| Design and usability | 10 | Plain-language intake, optional identity, clear status timeline, accessible alternatives, and a useful staff overview. |
| Learning and technical decisions | 5 | Explain model boundaries, workflow safety, provider failures, and trade-offs made during the event. |
| Presentation | 5 | Timed live demonstration and direct answers during questions. |

Depth matters more than feature count. Judges assess what actually works in the normal in-person session. Mini-challenges are considered during that same session; there is no separate side-challenge presentation. The Devpost video supports the submitted project but does not replace the live demonstration.

### Targeted side challenges

| Challenge | Required working evidence |
| --- | --- |
| Best Project Built with ElevenLabs / MLH Best Use of ElevenLabs | A real conversational voice session asks what happened and what should change, confirms the feedback, and submits it. The guide combines these into one challenge. |
| MLH Best Use of Tiger Data | Feedback events enter a Tiger hypertable; continuous aggregates power category, volume, and trend charts. |
| MLH Best Use of Auth0 | Real staff login, role checks, protected API actions, and a denied unauthorized action. |
| MLH Best Use of Presage | A consented mobile interaction uses a real Presage SDK output to offer an accessibility adjustment, without changing feedback priority or eligibility. |
| Best UI/UX | A low-friction resident journey and evidence-linked aggregate staff workspace with clear states and accessible controls. |

Cloudflare Workers AI and Jev are product technologies rather than prize entries. Do not enter Gemini, Solana, Vultr, or GoDaddy. The planned proprietary services make Best FOSS inapplicable. The current product does not qualify for Best Hardware Hack or MathemaTech; do not add token features just to enter them.

Only select a side challenge on Devpost after its working evidence exists. If a provider cannot be integrated, remove that claim and its prize selection rather than showing a simulation.

## 3. Scope and complete user journeys

### Default civic taxonomy

Ship a broad, editable municipal starter taxonomy. Residents do not need to browse or understand it before submitting. Each published category has a stable ID, group, display name, description, inclusion/exclusion examples, optional follow-up fields, default department, and version. Initial groups and categories should cover:

| Group | Default categories |
| --- | --- |
| Streets and mobility | Roads and potholes; sidewalks and crossings; streetlights and traffic signals; transit and bus stops; cycling and parking. |
| Environment and public space | Waste and recycling; parks and recreation spaces; trees and landscaping; noise and pollution; water, drainage, and sewer. |
| Buildings and community | Housing and property standards; public facilities and libraries; community programs; public health and social services; community safety and bylaw enforcement. |
| Access and administration | Accessibility and language access; permits and licensing; fees and billing; websites and digital services; staff conduct and service quality. |
| Civic decisions | Policy and planning; budget and spending; communication and transparency; other or unsure. |

Treat these as starter labels, not claims about any real municipality's jurisdiction. Include `other_or_unsure` and staff review so every submission has a safe route. Seed descriptions, examples, exclusions, and department mappings, not just category names. The starter set is inspired by the breadth of real [NYC311 report topics](https://portal.311.nyc.gov/report-problems/), which include both physical service issues and feedback about agencies and workers.

Track **intent** separately from category: complaint, improvement suggestion, question/request, or positive feedback. A complaint about a public service and a suggestion to improve it can share a service category while remaining distinguishable in analytics.

Administrators can add, edit, reorder, and remove categories in the dashboard or through the agent. Removal means *retire from future classification*; historical submissions retain their original category ID and taxonomy version. Publishing a version updates the live classifier without a deployment. Preview the effect on example submissions before publication. An admin can also recategorize a submission with an audit trail.

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

### Staff journey

1. Sign in through Auth0 and see only authorized organization/department data.
2. Start on an aggregate overview: volume by category and intent, change over time, recurring themes, and unanswered concerns.
3. Read a short evidence-linked summary for a category or theme, then drill down only when detail is needed.
4. Review the individual submission, original text, classification, evidence, and history.
5. Accept, correct, recategorize, assign, or request more information.
6. Send a response and move the concern through valid states; record an outcome and later reopening.
7. Draft, preview, and publish a taxonomy or routing change when authorized.

The manual UI must support these operations even when the admin agent is unavailable.

Do not expose a button, tab, or action as available unless it has a working API path and an honest loading, success, and failure state. Hide unfinished settings or policy features rather than leaving inert controls.

### Agentic staff journey

The ChatGPT-like interface can operate the entire **authorized** staff workspace through typed tools. It can summarize grouped feedback, show counts and trends, open a filtered theme or submission tab, draft or retire a category, prepare a reply, propose reassignment, preview a taxonomy diff, and request approval for a write. Staff can edit the same objects manually in adjacent tabs.

Read tools may run immediately. Writes require a rich preview card with affected records, changes, and an explicit approval action. The Worker rechecks Auth0 claims, record versions, organization scope, and idempotency keys at execution time. The agent cannot bypass permissions or silently publish a change.

Chat and manual tabs share server state and version IDs. A manual edit appears in the agent context; an agent proposal appears in the relevant manual view. Conversation history and pending approvals persist across refreshes.

The agent tool set must cover the same useful operations as the manual workspace:

| Area | Read tools | Write tools requiring preview and approval |
| --- | --- | --- |
| Feedback | Search, open, inspect history and evidence | Correct fields, categorize, assign, change status, respond, resolve, reopen. |
| Residents | Read feedback conversation | Draft and send a message; request more information. |
| Taxonomy | List categories and versions; compare changes | Add, edit, retire, restore, and publish categories and routing rules. |
| Aggregates | Query exact counts, trends, and theme source links | Refresh summaries, correct a theme membership, save a view or report. |
| Workspace | Open tabs and inspect current context | Save or close a tab. |

Tools must return typed data for rich cards. A card should state its source, affected record/version, proposed edit, approval status, and final result. An employee can refuse, revise, or carry out the change manually.

## 4. Interfaces and design

### Shared visual language

Take interaction cues from ChatGPT, Stripe, Notion, Anthropic, and modern ticketing products while creating an original civic identity. Use readable typography, warm neutral surfaces, restrained blue/teal accents, modest radii, clear borders, and semantic status colors. Design tokens, copy, and status names are shared across web, mobile, and video.

Prioritize meaningful states: empty, loading, listening, missing detail, awaiting approval, failed, retryable, completed, and read-only. Avoid decorative dashboards and fake AI activity.

### Staff web workspace

Use a left rail with recent agent threads and manual tabs for Overview, Themes, Inbox, Submissions, Taxonomy, and Settings. The central surface shows a conversation or working tab. A context panel shows the selected theme or submission, source reports, audit history, and tool results.

The default overview should answer “What are people telling us?” before showing a queue: total submissions in the selected period, category and intent distribution, rising topics, repeated requests, unanswered volume, and a short summary of each theme. Counts come from database queries; summaries link to the submissions that support them. Staff can change time range, category, department, and status, and drill from a theme into original feedback.

Agent responses may render theme cards, submission cards, tables, charts, source links, taxonomy diffs, and approval cards. Every card should show its status and let the employee open the underlying object for manual editing. Keyboard navigation, search, visible focus, and clear error recovery are required.

### Resident web experience

Use a modern, calm feedback layout with one primary “Share feedback” action. Prompt for a concrete experience and an improvement that would help; let residents submit criticism without forcing a category, account, or location. Show the original wording and editable summary before submission. After submission, use a ticket-style receipt and timeline with department ownership and next steps in plain language. Keep internal confidence scores, model names, and routing rules out of the resident view.

### React Native app

Use Expo/React Native for the resident mobile experience. It can cover a narrower set of screens than the web app, but every screen shown in the video must work:

- Text or voice intake.
- Follow-up questions.
- Review and correction.
- Submission through the live Worker API.
- Secure guest receipt and status timeline loaded from the API.
- Optional Presage consent and accessibility adjustment, if entered for that prize.

Do not use local mock responses or a prerecorded success state in the shipped app. Mobile can be less polished outside the recorded flow, but the demonstrated path must be complete.

Store the guest receipt secret in secure device storage on mobile. The web app should present the private link clearly at submission time and avoid exposing its secret to analytics, logs, or public pages.

### Accessibility

Target WCAG 2.2 AA patterns where relevant: keyboard access and visible focus on web, labeled controls, status text that does not depend on color alone, captions/transcripts, a text alternative to voice, adequate touch targets, reduced motion, and plain-language errors. Presage must be opt-in, immediately disableable, and must never alter eligibility, priority, or department routing.

## 5. System architecture

```text
Resident web + React Native app       Staff web workspace
                 \                     /
                  Cloudflare Worker API
                  ├─ Auth0 staff roles / optional resident account
                  ├─ secure guest receipts and rate limits
                  ├─ domain commands and agent tools
                  ├─ Workers AI extraction, theme summaries, staff agent
                  ├─ Jev intent and category decisions
                  ├─ Tiger Cloud feedback, taxonomy, themes, events
                  ├─ R2 attachments and transcripts
                  ├─ Vectorize similar-feedback candidates
                  ├─ ElevenLabs voice agent webhooks
                  └─ Presage client data only when consented
```

The Worker owns authorization, validation, orchestration, and external secrets. Clients do not call privileged providers directly. Tiger Cloud is the authoritative database for submissions, category configuration, theme membership, and metrics; avoid a second feedback store. R2 stores attachments and transcript artifacts with access controlled through the Worker.

The product can run for a fictional municipality without an external government integration. It must never imply that reports are being sent to a real public agency. Within its own resident and staff accounts, submission, assignment, communication, and resolution must all work.

### AI responsibilities

- **Workers AI:** extract structured details, generate aggregate theme summaries from redacted source submissions, and power the staff conversation.
- **Jev:** make bounded intent, category, and routing choices from the currently published taxonomy. It is not the summarizer or the staff chat model.
- **Vectorize and Tiger:** find semantically similar feedback as candidate theme members, then store reviewed membership and exact counts in Tiger.
- **Application rules:** validate all model output, keep original submissions, enforce authorization and state transitions, and send uncertain or sensitive reports to staff review.

Classification contract:

```ts
type ClassificationInput = {
  feedbackText: string
  extractedFields: Record<string, unknown>
  taxonomyVersion: string
  categories: Array<{
    id: string
    groupId: string
    description: string
    examples: string[]
    exclusions: string[]
  }>
}

type ClassificationResult = {
  intent: 'complaint' | 'suggestion' | 'question' | 'positive'
  categoryId: string
  confidence: number
  alternatives: string[]
  provider: 'jev' | 'workers-ai'
  modelVersion: string
}
```

Build Jev `choice` questions dynamically from the current published category descriptions and examples. First choose a broad group, then a category in that group; keep an `other_or_unsure` path at each step. This keeps a growing taxonomy and Jev's compact request within the documented 32 KiB body limit. The selected ID must exist in the published taxonomy. Store the intent, category, provider, confidence, model version, taxonomy version, and review outcome. A production Workers AI fallback may be used when Jev is unavailable; it must perform a real classification and disclose degraded provider status to staff. Tests may use a fixture provider. Neither the video nor the live product should present a fixture result as a live model result. See the [Jev native Decisions API](https://www.jevai.org/docs).

### Aggregation and summaries

The staff landing page must make large volumes of feedback readable without forcing staff to open every submission:

1. Query exact counts and trends from Tiger by time window, category, intent, department, and status.
2. Find similar submissions within a category using Workers AI embeddings and Vectorize; persist theme membership in Tiger. A submission may belong to one primary theme and retain its original category.
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

Core entities: organizations, users, departments, feedback submissions, guest access tokens, messages, attachments, classifications, category groups, categories, taxonomy versions, routing rules, themes, theme memberships, theme summaries, status transitions, voice sessions, agent threads/messages/tool calls, workspace tabs, and audit events.

At minimum, each event stores submission ID, event type, timestamp, actor, organization, and validated payload. Persist an event for creation, classification, correction, theme membership, assignment, status change, message, outcome, reopening, taxonomy publication, and agent approval/execution.

Create a Tiger `feedback_events` hypertable and continuous aggregates for intake volume over time, category/intent counts, and at least one operational metric such as acknowledgement time. Dashboard charts must query those aggregates. Historical synthetic submissions may seed the database, but new user and staff actions must produce real events visible in the same charts.

### Feedback state machine

```text
draft → submitted → categorized or needs_review → assigned → acknowledged
→ in_review → waiting_on_resident → outcome_recorded → closed
                               outcome_recorded → reopened → assigned
```

An outcome can be action taken, planned action, referral, or no action with an explanation. Criticism should not be marked “resolved” merely because staff read it. Each transition has an allowed actor/role, required fields, and an audit event. Rejected transitions return a clear error. Staff must be able to complete the full path and residents must see its result.

### Integrations

- **Auth0:** real staff and administrator sign-in, optional resident accounts, organization/department roles, Worker-side JWT and scope validation, protected mutations, and an observable access-denied path. Guest feedback and private receipt links work without Auth0; their access tokens are checked by the Worker. Use step-up authentication for high-impact actions if available within the build time.
- **ElevenLabs:** actual conversational agent that invites constructive detail (“What happened?” and “What would improve it?”), asks relevant follow-ups, confirms the summary, and submits feedback through a signed Worker webhook. Handle retries and duplicate webhooks.
- **Tiger Data:** real PostgreSQL connection, schema migrations, feedback-event hypertable, continuous aggregates, and dashboard queries. Verify Worker connectivity early.
- **Presage:** real SDK integration in the mobile app, explicit consent, one measurable interaction adaptation (for example, shorter prompts or a pause offer), and no service decision based on biometric output. Validate SDK/device feasibility early.
- **Jev:** real bounded decision call through an adapter; validate probabilities and category IDs; use Workers AI as a production fallback.

External calls need timeouts, request IDs, idempotency where relevant, retry/error states, and audit visibility. A provider outage may degrade that feature but must not silently create false success.

### Minimum API surface

The Worker should expose versioned, schema-validated routes for:

- Guest submission, attachment upload, and private receipt/status access.
- Guest follow-up messages and optional account claim.
- Staff overview counts, trends, theme summaries, and filtered source submissions.
- Staff assignment, response, state transition, theme correction, and summary refresh.
- Category/group drafts, preview, publication, and retirement.
- Agent threads, tool results, rich approval cards, and approved tool execution.
- ElevenLabs signed webhook delivery and idempotent session completion.

Each route needs an explicit auth mode: public submission with abuse controls, guest receipt token, authenticated resident, staff role, or administrator role. Do not let a public category count endpoint expose raw text or personally identifying details.

## 6. pnpm workspace and CI

Use one pnpm lockfile and typed package boundaries:

```text
apps/
  web/          # resident and staff web UI
  worker/       # Cloudflare API, guest access, auth, tools, webhooks
  mobile/       # React Native/Expo resident app
  remotion/     # five-minute video composition
packages/
  contracts/    # request/response, events, tool and card schemas
  domain/       # feedback states, permissions, taxonomy rules
  db/           # Tiger migrations and queries
  ai/           # Workers AI and Jev adapters
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

CI runs on every push to `main`: frozen install, formatting/lint, typecheck, domain/permission/provider tests, migrations against a disposable database, application builds, and a Worker smoke test. Add an end-to-end test that submits guest feedback, categorizes it, groups it, assigns it, updates status, and verifies both the resident receipt and staff aggregate view. Provider adapters can be stubbed in automated tests; run a separate pre-submission integration check with real sponsor services.

Deployment is a separate job after checks pass. Secrets stay in Cloudflare/GitHub secret stores. The deployed app and video must use the same contracts and status vocabulary.

## 7. Subagent delivery protocol

Use only Luna subagents at `high` or `xhigh` reasoning. All agents may work in the same checkout and `main` branch. The orchestrator assigns one file owner per active unit and maintains an ownership ledger; agents must not edit another active unit’s files.

### Sequential foundation gate

One core subagent first builds a working vertical slice: pnpm workspace, contracts, feedback state machine, Worker/API, Tiger persistence, secure guest submission/receipt, Auth0 staff protection, a seeded editable taxonomy, manual staff queue, assignment/status mutation, and resident status view. It runs relevant checks, commits, and pushes before feature agents begin.

The orchestrator verifies this live path and CI. Only then does it delegate feature-sized units with explicit package/file ownership, dependencies, acceptance behavior, and test commands. Suggested later units: ElevenLabs intake, Workers AI/Jev decisions, theme grouping and summaries, staff agent and rich cards, Tiger dashboard, mobile/Presage, design polish, and Remotion capture/render.

For shared interface changes, commit a contract update first, then release dependent units. Synchronize `main` before pushing. Resolve cross-owner conflicts through the orchestrator; never discard another agent’s work. Run `pnpm check` after each integration wave.

Each completed unit is committed and pushed to `main` with a Conventional Commits subject only: `type(scope): imperative summary`. No commit body, description, or co-author trailer. Report the commit, files changed, checks run, and any remaining limitation.

## 8. Presentation and five-minute video

### In-person Civic presentation

Five minutes to present and show the working product, followed by three minutes of questions. Show a resident submitting constructive criticism without choosing a category or signing in. Then show Jev categorizing it, the staff overview counting it inside a recurring theme, a department acknowledging or responding, and the resident viewing that response through the private receipt. Demonstrate an agent action with an approval card and a manual taxonomy edit if both are complete. Use real service integrations for any sponsor claim made during judging. Rehearse with network and device setup already complete.

### Remotion Devpost video

Remotion is an editor/compositor for a five-minute account of the **working** product. Capture actual web and mobile interactions, real voice audio/transcripts, real database-backed state changes, and real sponsor integration results. Use motion graphics to explain the architecture and transitions; do not animate a feature that has no working implementation.

Suggested timing:

1. 0:00–0:35 — why residents need an easier way to give constructive criticism.
2. 0:35–1:25 — guest web/mobile intake and ElevenLabs follow-up.
3. 1:25–2:05 — resident confirmation and Jev categorization from the live taxonomy.
4. 2:05–3:05 — staff aggregate overview, source-linked summaries, agent rich cards, Auth0 approval, taxonomy edit.
5. 3:05–3:50 — Tiger category trends, department response, and private resident status update.
6. 3:50–4:25 — real Presage accessibility interaction, if working.
7. 4:25–5:00 — feedback outcome, architecture, and limitations.

Keep captions readable and the recorded UI legible at normal playback size. If a sponsor feature is incomplete, remove its segment and prize selection. The video cannot stand in for the in-person live evaluation.

## 9. Build order and acceptance

### Gate A — complete civic loop

- A guest submits constructive criticism on the deployed site without choosing a category or creating an account.
- Worker persists the original text, secure receipt token hash, submission, and event in Tiger.
- Staff signs in via Auth0, assigns and acknowledges it, then records an outcome.
- Guest opens the private receipt link and sees the department, update, and outcome.
- Guest can provide more information; authorized staff can reopen or close the submission.
- Invalid token, role, and state transition are rejected.

### Gate B — categorization, aggregation, and configuration

- Workers AI extracts useful fields from a real submission without replacing the resident's original words.
- Jev chooses intent and a published category; low confidence reaches human review.
- The database ships with the full starter taxonomy described above.
- Admin adds, edits, and retires categories; the next submission uses the newly published version, while history remains readable.
- Two related submissions appear in one theme with an exact count; the summary links back to both source records.
- A new submission updates Tiger counts and eventually refreshes the relevant theme summary.
- Agent tools and manual tabs perform the same authorized commands.
- Approval cards show exact changes and cannot execute after stale previews.

### Gate C — side-challenge integrations

- ElevenLabs voice session submits feedback with a transcript and a useful follow-up question.
- Tiger dashboard reflects actual feedback events through a continuous aggregate.
- Auth0 role denial and permitted mutation both work.
- Presage changes one consented mobile interaction from a real SDK signal.
- Resident and staff UI are usable with keyboard/text alternatives.

### Gate D — delivery

- Deployed web and Worker routes pass smoke tests.
- Mobile app performs each recorded interaction against the deployed API.
- Five-minute Remotion video is captured from the working build and rendered with captions.
- Draft Devpost submission is created by Sunday 12:00 AM and final selection, roster, links, and video are submitted by Sunday 10:00 AM Eastern, per the event guide.

If time is short, finish Gate A and the strongest achievable integrations before expanding the agent or adding screens. Do not mark an incomplete feature as functional.

## 10. Configuration and source references

Expected configuration includes Auth0 domain/audience/client ID, Tiger connection settings, Cloudflare AI/R2/Vectorize bindings, ElevenLabs agent ID and webhook secret, Jev API credentials, and Presage SDK configuration. Use environment-specific secrets; never commit credentials, `.dev.vars`, or recordings containing real personal information.

- [Hack the Hill III competition guide](https://tracker.hackthehill.com/resources)
- [MLH Hack the Hill prize categories](https://www.mlh.com/events/hack-the-hill-30/prizes)
- [Cloudflare Workers AI documentation](https://developers.cloudflare.com/workers-ai/)
- [ElevenLabs Agents documentation](https://elevenlabs.io/docs/eleven-agents/overview)
- [Tiger Data documentation](https://www.tigerdata.com/docs)
- [Auth0 documentation](https://auth0.com/docs)
- [Presage SmartSpectra documentation](https://smartspectra.presagetech.com/)
- [Remotion documentation](https://www.remotion.dev/docs/)
