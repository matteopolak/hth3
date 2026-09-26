# CivicResolve — Hack the Hill III implementation plan

## 1. Decision and product

**Main track: Civic Technology.** A team may enter only one of Civic Technology, General, or CGI. CivicResolve will enter Civic Technology and the side challenges for which its finished product qualifies. The product will not claim a CGI or General entry.

CivicResolve is a working civic service-request platform. A resident reports an issue by text or voice, reviews what was collected, submits it, receives a case number, and follows its status. Staff receive the case, correct or assign it, communicate with the resident, and resolve it. Authorized staff can configure categories and routing through manual screens or an agentic conversation. The system records every consequential action and shows operational trends.

The end-to-end path is:

```text
Resident intake → confirmation → persisted case → classification → staff review
→ department assignment → resident update → resolution → measured outcome
```

The civic connection must be visible in the running product: a named public department owns the case, staff can act on it, and the resident can see the result. Use a clearly fictional municipality for the hackathon rather than imply that a real city has integrated its systems.

### What “fully functional” means

Every feature presented as working must execute against the deployed application and persist the result. Specifically:

- Resident and staff interfaces call the same live Cloudflare Worker API.
- Submitted cases, messages, taxonomy versions, assignments, and audit events survive refresh and sign-in.
- Role restrictions are enforced by the Worker, not only hidden in the UI.
- Voice intake submits a real case through the same API as text intake.
- The admin agent uses the same authorized commands as manual controls.
- Published taxonomy changes affect later classifications.
- The dashboard queries Tiger Data events written by actual case activity.
- A resident can see an assigned department, status changes, messages, and resolution.
- Any Presage feature shown uses the actual SDK and changes the mobile interaction.
- The React Native app performs the flows shown in the video against the live API.
- The Remotion video records or composes evidence from functioning product flows; it does not invent successful calls or display fabricated integration results.

Synthetic people, locations, and reports are appropriate test content. Test fixtures and mocked providers may be used in automated tests. They must not substitute for a claimed live feature in judging or the final video.

## 2. Challenge coverage and judging

The [official competition guide](https://tracker.hackthehill.com/resources) permits one main track and multiple qualifying mini-challenges. Civic Technology asks teams to improve an interaction between people and a public institution. The running resident-to-department loop is the eligibility evidence.

Civic and General use the same **45-point** rubric:

| Criterion | Points | Product evidence |
| --- | ---: | --- |
| Technical execution | 15 | Complete live case flow, provider integrations, authorization, persistence, and audit trail. |
| Idea and impact | 10 | Easier reporting and clearer public-service accountability for residents and staff. |
| Design and usability | 10 | Plain-language intake, clear status timeline, accessible alternatives, and useful staff workspace. |
| Learning and technical decisions | 5 | Explain model boundaries, workflow safety, provider failures, and trade-offs made during the event. |
| Presentation | 5 | Timed live demonstration and direct answers during questions. |

Depth matters more than feature count. Judges assess what actually works in the normal in-person session. Mini-challenges are considered during that same session; there is no separate side-challenge presentation. The Devpost video supports the submitted project but does not replace the live demonstration.

### Targeted side challenges

| Challenge | Required working evidence |
| --- | --- |
| Best Project Built with ElevenLabs / MLH Best Use of ElevenLabs | A real conversational voice session asks for missing details, confirms the report, and creates a case. The guide combines these into one challenge. |
| MLH Best Use of Tiger Data | Case events enter a Tiger hypertable; a continuous aggregate powers a visible operations chart. |
| MLH Best Use of Auth0 | Real staff login, role checks, protected API actions, and a denied unauthorized action. |
| MLH Best Use of Presage | A consented mobile interaction uses a real Presage SDK output to offer an accessibility adjustment, without changing case priority or eligibility. |
| Best UI/UX | A coherent, tested resident journey and staff workspace with clear states and accessible controls. |

Cloudflare Workers AI and Jev are product technologies rather than prize entries. Do not enter Gemini, Solana, Vultr, or GoDaddy. The planned proprietary services make Best FOSS inapplicable. The current product does not qualify for Best Hardware Hack or MathemaTech; do not add token features just to enter them.

Only select a side challenge on Devpost after its working evidence exists. If a provider cannot be integrated, remove that claim and its prize selection rather than showing a simulation.

## 3. Scope and complete user journeys

### Initial municipal scope

Start with three concrete request types, such as sidewalk hazards, missed waste collection, and damaged streetlights. Each needs a department, a small set of required fields, an example routing rule, and a meaningful status timeline. Administrators may add categories after the initial set works.

This focused scope makes classification, routing, and progress understandable in five minutes. The platform remains category-driven so the architecture can support more services later.

### Resident journey

1. Sign in through Auth0 on web or mobile, then choose text or voice.
2. Describe the issue and provide location and optional evidence.
3. Answer context-specific follow-up questions for missing required fields.
4. Review and correct the extracted summary and location.
5. Submit and receive a persistent case number in the resident account.
6. See category, responsible department, expected next step, and status history.
7. Add information or reply when staff request clarification.
8. Receive a visible resolution and reopen the case when appropriate.

A resident should be able to complete the journey without a microphone or camera. The app must explain when the report has not yet been submitted and when a department has actually accepted it.

### Staff journey

1. Sign in through Auth0 and see only authorized organization/department data.
2. Review the inbox, filter cases, and inspect evidence and history.
3. Accept, correct, categorize, assign, or request more information.
4. Send a case update to the resident and move the case through valid states.
5. Resolve the case with a reason, then handle a later reopening.
6. Inspect backlog, intake, routing, and resolution trends from Tiger Data.
7. Draft, preview, and publish a taxonomy or routing change when authorized.

The manual UI must support these operations even when the admin agent is unavailable.

Do not expose a button, tab, or action as available unless it has a working API path and an honest loading, success, and failure state. Hide unfinished settings or policy features rather than leaving inert controls.

### Agentic staff journey

The ChatGPT-like interface can operate the entire **authorized** staff workspace through typed tools. It can search cases, explain backlog trends, open a filtered tab, draft a category, prepare a reply, propose reassignment, preview a taxonomy diff, and request approval for a write. Staff can edit the same objects manually in adjacent tabs.

Read tools may run immediately. Writes require a rich preview card with affected records, changes, and an explicit approval action. The Worker rechecks Auth0 claims, record versions, organization scope, and idempotency keys at execution time. The agent cannot bypass permissions or silently publish a change.

Chat and manual tabs share server state and version IDs. A manual edit appears in the agent context; an agent proposal appears in the relevant manual view. Conversation history and pending approvals persist across refreshes.

The agent tool set must cover the same useful operations as the manual workspace:

| Area | Read tools | Write tools requiring preview and approval |
| --- | --- | --- |
| Cases | Search, open, inspect history and evidence | Correct fields, categorize, assign, change status, resolve, reopen. |
| Residents | Read case conversation | Draft and send a message; request more information. |
| Taxonomy | List categories and versions; compare changes | Draft, edit, and publish categories and routing rules. |
| Analytics | Query backlog, trends, and department metrics | Save a filtered view or report. |
| Workspace | Open tabs and inspect current context | Save or close a tab. |

Tools must return typed data for rich cards. A card should state its source, affected record/version, proposed edit, approval status, and final result. An employee can refuse, revise, or carry out the change manually.

## 4. Interfaces and design

### Shared visual language

Take interaction cues from ChatGPT, Stripe, Notion, Anthropic, and modern ticketing products while creating an original civic identity. Use readable typography, warm neutral surfaces, restrained blue/teal accents, modest radii, clear borders, and semantic status colors. Design tokens, copy, and status names are shared across web, mobile, and video.

Prioritize meaningful states: empty, loading, listening, missing detail, awaiting approval, failed, retryable, completed, and read-only. Avoid decorative dashboards and fake AI activity.

### Staff web workspace

Use a left rail with recent agent threads and manual tabs for Inbox, Cases, Analytics, Taxonomy, Policies, and Settings. The central surface shows a conversation or working tab. A context panel shows the selected case, sources, audit history, and tool results.

Agent responses may render case cards, tables, charts, citations, taxonomy diffs, and approval cards. Every card should show its status and let the employee open the underlying object for manual editing. Keyboard navigation, search, visible focus, and clear error recovery are required.

### Resident web experience

Use a modern service-ticket layout with one primary “Report an issue” action, short progressive intake, clear review-before-submit, and a case timeline. Show department ownership and next steps in plain language. Keep internal confidence scores, model names, and routing rules out of the resident view.

### React Native app

Use Expo/React Native for the resident mobile experience. It can cover a narrower set of screens than the web app, but every screen shown in the video must work:

- Text or voice intake.
- Follow-up questions.
- Review and correction.
- Submission through the live Worker API.
- Case receipt and status timeline loaded from the API.
- Optional Presage consent and accessibility adjustment, if entered for that prize.

Do not use local mock responses or a prerecorded success state in the shipped app. Mobile can be less polished outside the recorded flow, but the demonstrated path must be complete.

### Accessibility

Target WCAG 2.2 AA patterns where relevant: keyboard access and visible focus on web, labeled controls, status text that does not depend on color alone, captions/transcripts, a text alternative to voice, adequate touch targets, reduced motion, and plain-language errors. Presage must be opt-in, immediately disableable, and must never alter eligibility, priority, or department routing.

## 5. System architecture

```text
Resident web + React Native app       Staff web workspace
                 \                     /
                  Cloudflare Worker API
                  ├─ Auth0 token/role checks
                  ├─ domain commands and agent tools
                  ├─ Workers AI extraction and staff agent
                  ├─ Jev bounded category/routing decision
                  ├─ Tiger Cloud cases, taxonomy, events, analytics
                  ├─ R2 attachments and transcripts
                  ├─ Vectorize policy/category retrieval if used
                  ├─ ElevenLabs voice agent webhooks
                  └─ Presage client data only when consented
```

The Worker owns authorization, validation, orchestration, and external secrets. Clients do not call privileged providers directly. Tiger Cloud is the authoritative database for cases and configuration; avoid a second case store. R2 stores attachments and transcript artifacts with access controlled through the Worker.

The product can run for a fictional municipality without an external government integration. It must never imply that reports are being sent to a real public agency. Within its own resident and staff accounts, submission, assignment, communication, and resolution must all work.

### AI responsibilities

- **Workers AI:** extract fields and summarize natural-language reports; power the staff conversation and retrieval-assisted explanations.
- **Jev:** choose among published category IDs or routing options as a bounded decision.
- **Application rules:** validate model output, check required fields, enforce routing and state transitions, and send uncertain cases to staff review.

Classification contract:

```ts
type ClassificationInput = {
  report: string
  extractedFields: Record<string, unknown>
  taxonomyVersion: string
  categories: Array<{ id: string; description: string; examples: string[] }>
}

type ClassificationResult = {
  categoryId: string
  confidence: number
  alternatives: string[]
  provider: 'jev' | 'workers-ai'
  modelVersion: string
}
```

The selected ID must exist in the published taxonomy. Store the classification, provider, model version, taxonomy version, and review outcome. A production Workers AI fallback may be used when Jev is unavailable; it must perform a real classification and disclose degraded provider status to staff. Tests may use a fixture provider. Neither the video nor the live product should present a fixture result as a live model result.

### Data and events

Core entities: organizations, users, departments, cases, messages, attachments, classifications, categories, taxonomy versions, routing rules, status transitions, voice sessions, agent threads/messages/tool calls, workspace tabs, and audit events.

At minimum, each event stores case ID, event type, timestamp, actor, organization, and validated payload. Persist an event for creation, classification, correction, assignment, status change, message, resolution, reopening, taxonomy publication, and agent approval/execution.

Create a Tiger `case_events` hypertable and continuous aggregates for intake over time and at least one operational metric such as routing or resolution time. Dashboard charts must query those aggregates. Historical synthetic cases may seed the database, but new user and staff actions must produce real events visible in the same charts.

### Case state machine

```text
draft → submitted → needs_review or assigned → acknowledged
→ in_progress → waiting_on_resident → resolved → closed
                                      resolved → reopened → assigned
```

Each transition has an allowed actor/role, required fields, and an audit event. Rejected transitions return a clear error. Staff must be able to complete the full path and residents must see its result.

### Integrations

- **Auth0:** real resident and staff sign-in on web and mobile, organization/department roles, Worker-side JWT and scope validation, resident ownership checks, protected mutations, and an observable access-denied path. Use step-up authentication for high-impact actions if available within the build time.
- **ElevenLabs:** actual conversational agent, dynamic follow-up based on required fields, spoken confirmation, signed webhook, and case creation through the Worker. Handle retries and duplicate webhooks.
- **Tiger Data:** real PostgreSQL connection, schema migrations, hypertable, continuous aggregate, and dashboard queries. Verify Worker connectivity early.
- **Presage:** real SDK integration in the mobile app, explicit consent, one measurable interaction adaptation (for example, shorter prompts or a pause offer), and no service decision based on biometric output. Validate SDK/device feasibility early.
- **Jev:** real bounded decision call through an adapter; validate probabilities and category IDs; use Workers AI as a production fallback.

External calls need timeouts, request IDs, idempotency where relevant, retry/error states, and audit visibility. A provider outage may degrade that feature but must not silently create false success.

## 6. pnpm workspace and CI

Use one pnpm lockfile and typed package boundaries:

```text
apps/
  web/          # resident and staff web UI
  worker/       # Cloudflare API, auth, tools, webhooks
  mobile/       # React Native/Expo resident app
  remotion/     # five-minute video composition
packages/
  contracts/    # request/response, events, tool and card schemas
  domain/       # case states, permissions, taxonomy rules
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

CI runs on every push to `main`: frozen install, formatting/lint, typecheck, domain/permission/provider tests, migrations against a disposable database, application builds, and a Worker smoke test. Add an end-to-end test that submits a case, assigns it, updates status, and verifies the resident view and audit events. Provider adapters can be stubbed in automated tests; run a separate pre-submission integration check with real sponsor services.

Deployment is a separate job after checks pass. Secrets stay in Cloudflare/GitHub secret stores. The deployed app and video must use the same contracts and status vocabulary.

## 7. Subagent delivery protocol

Use only Luna subagents at `high` or `xhigh` reasoning. All agents may work in the same checkout and `main` branch. The orchestrator assigns one file owner per active unit and maintains an ownership ledger; agents must not edit another active unit’s files.

### Sequential foundation gate

One core subagent first builds a working vertical slice: pnpm workspace, contracts, domain state machine, Worker/API, Tiger persistence, Auth0 resident and staff protection, resident text submission, staff case queue, assignment/status mutation, and resident status view. It runs relevant checks, commits, and pushes before feature agents begin.

The orchestrator verifies this live path and CI. Only then does it delegate feature-sized units with explicit package/file ownership, dependencies, acceptance behavior, and test commands. Suggested later units: ElevenLabs intake, Workers AI/Jev decisions, staff agent and rich cards, Tiger dashboard, mobile/Presage, design polish, and Remotion capture/render.

For shared interface changes, commit a contract update first, then release dependent units. Synchronize `main` before pushing. Resolve cross-owner conflicts through the orchestrator; never discard another agent’s work. Run `pnpm check` after each integration wave.

Each completed unit is committed and pushed to `main` with a Conventional Commits subject only: `type(scope): imperative summary`. No commit body, description, or co-author trailer. Report the commit, files changed, checks run, and any remaining limitation.

## 8. Presentation and five-minute video

### In-person Civic presentation

Five minutes to present and show the working product, followed by three minutes of questions. Show the same deployed case moving through resident intake, department assignment, staff action, and resident-visible update. Demonstrate one agent action with an approval card and one manual tab edit if both are complete. Use real service integrations for any sponsor claim made during judging. Rehearse with network and device setup already complete.

### Remotion Devpost video

Remotion is an editor/compositor for a five-minute account of the **working** product. Capture actual web and mobile interactions, real voice audio/transcripts, real database-backed state changes, and real sponsor integration results. Use motion graphics to explain the architecture and transitions; do not animate a feature that has no working implementation.

Suggested timing:

1. 0:00–0:35 — resident problem and civic interaction.
2. 0:35–1:25 — live web/mobile intake and ElevenLabs follow-up.
3. 1:25–2:05 — Workers AI extraction, Jev classification, resident confirmation.
4. 2:05–3:05 — department queue, staff agent rich cards, Auth0 approval, manual edit.
5. 3:05–3:50 — Tiger analytics and case resolution/status update.
6. 3:50–4:25 — real Presage accessibility interaction, if working.
7. 4:25–5:00 — final resident outcome, architecture, and limitations.

Keep captions readable and the recorded UI legible at normal playback size. If a sponsor feature is incomplete, remove its segment and prize selection. The video cannot stand in for the in-person live evaluation.

## 9. Build order and acceptance

### Gate A — complete civic loop

- Resident submits a text report on the deployed site.
- Worker persists case and event in Tiger.
- Staff signs in via Auth0, assigns and updates it.
- Resident refreshes and sees the department and update.
- Staff resolves it; resident can reopen it.
- Invalid role and invalid state transition are rejected.

### Gate B — intelligence and configuration

- Workers AI extracts missing fields from a real report.
- Jev or a real Workers AI fallback selects a published category.
- Low confidence reaches a human queue.
- Admin publishes a taxonomy version; the next report uses it.
- Agent tools and manual tabs perform the same authorized commands.
- Approval cards show exact changes and cannot execute after stale previews.

### Gate C — side-challenge integrations

- ElevenLabs voice session creates a case with a transcript.
- Tiger dashboard reflects actual case events through a continuous aggregate.
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
