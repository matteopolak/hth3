# CivicResolve — Hack the Hill III Project Plan

## 1. Project summary

CivicResolve is a civic complaint-intake and resolution platform. Residents can submit an issue through a web/mobile form or a conversational ElevenLabs voice agent. The platform extracts the relevant facts, classifies the case using an administrator-defined taxonomy, routes it to the right team, and gives administrators an agentic interface for configuring and operating the system.

The product is designed to demonstrate one complete loop:

```text
Resident report → conversational follow-up → AI classification → human review
→ routing and resolution → time-series impact analytics → taxonomy improvement
```

The project is judged as an operations-improvement product, not as a collection of disconnected integrations. Every retained sponsor technology must have a necessary role in this loop and a visible moment in the demo.

The deployment target is Cloudflare Workers. Workers AI replaces Gemini as the AI provider. This intentionally gives up the Gemini-specific side prize in exchange for a more coherent Cloudflare-native deployment.

## 2. Goals

### Primary goals

- Build a working civic technology product that visibly connects residents with government operations.
- Address the CGI complaint-backlog problem with a measurable, feasible workflow.
- Provide an administrator-configurable classification system rather than hard-coding categories.
- Demonstrate useful AI with structured outputs, retrieval, and tool calling.
- Use ElevenLabs for conversational intake and Tiger Data for operational analytics.
- Provide secure authentication and authorization with Auth0.
- Include Presage as an accessibility/well-being signal where appropriate and consented.
- Render a deterministic Remotion demo showing the complete product across desktop, mobile, and voice flows.

### Explicit exclusions

- No Gemini API integration or Gemini prize submission.
- No Solana integration.
- No Vultr integration.
- No GoDaddy integration.
- No automated government decision-making based solely on an AI result.
- No biometric or physiological signal used to determine eligibility, priority, or access to government services.

### Scope tiers

The team must finish P0 before starting P1 or P2. If time runs short, P2 is cut without compromising the core product.

#### P0 — required

- Resident case submission and confirmation.
- Admin case queue and case detail.
- Configurable taxonomy with published versions.
- Workers AI extraction and Jev classification, with a deterministic fallback.
- Human review for low-confidence cases.
- Case lifecycle through resolution.
- Tiger-backed event metrics and at least one continuous aggregate.
- Auth0 login, roles, and protected administrative mutations.
- One working ElevenLabs conversational intake path.
- One polished Remotion demo in 16:9.
- CGI dataset, scenario update, baseline metrics, and value case.

#### P1 — after P0 is reliable

- Admin agent read tools.
- Taxonomy simulation and bulk reclassification preview.
- Vectorize policy/category retrieval.
- ElevenLabs dynamic follow-up tools and spoken confirmation.
- Responsive mobile polish.
- Taxonomy publication with step-up authentication.

#### P2 — optional

- Presage accessibility mode.
- Bulk mutations from the admin agent.
- Multiple Remotion aspect ratios.
- Resident notifications beyond the core status page.
- Advanced organization/tenant support.

## 3. Challenge coverage

### Official competition structure

The team must select exactly one main track: General, CGI, or Civic Technology. The same project may enter any number of qualifying mini-challenges, but a team cannot submit the same project to both General and Civic Technology as main tracks.

This plan therefore uses one shared product with two presentation angles:

- **Selected main-track entry:** choose either General or Civic Technology on the final Devpost submission. The recommendation is Civic Technology if the resident-to-government flow is the strongest working path; choose General if the technical system and agentic operations workflow are stronger than the civic interaction.
- **CGI entry:** enter CGI only if the team is prepared to satisfy its separate live pitch, working-build, question period, and one-page value-case requirements.
- **Mini-challenges:** select only categories for which the final build has a visible, working proof point. A video alone does not create technical credit for an unimplemented feature.

The public resources page states that General and Civic Technology judging is in person, with five minutes to present and demonstrate followed by three minutes of questions. It also states that judges evaluate the project actually demonstrated, that mockups do not receive technical credit as implemented functionality, and that depth matters more than breadth. The project must therefore maintain one reliable core demo even if the Devpost video shows additional sponsor features.

The official hacking period is 36 hours. Planning and architecture work are permitted before the event, but substantive project-specific implementation must take place during the hacking period. Confirm any ambiguity with organizers.

### CGI — complaint backlog

The product must show:

- A clear complaint-backlog problem statement.
- A working intake, classification, routing, and review workflow.
- Synthetic or supplied data that resembles the challenge scenario.
- An adaptation mechanism for the Saturday scenario update.
- A one-page value case covering costs, benefits, assumptions, and payback.
- A concise executive pitch with every team member participating.

The official CGI deliverables are a five-minute executive-style pitch followed by three minutes of questions, a working build demonstrated live, and a one-page value case. Every team member must speak for at least 30 seconds during the pitch. The final Devpost submission must include the repository or folder link, the value case, and any slides used.

The CGI challenge is based on Northwind Utilities, which has 1,599 open complaints, average resolution time increasing from 9.1 to 38.2 days, 77% of complaints breaching service-level targets, and regulator satisfaction falling from 4.3 to 2.6 out of 5. The official data pack contains six synthetic CSV files. We must read and connect all six rather than using only the complaints file:

- complaints
- systems
- monthly KPIs
- meter reads
- the 2025 AI pilot
- unit costs

The CGI proposal must be willing to conclude that an AI triage system is not sufficient by itself. The diagnosis should determine which combination of process change, integration, data, and AI is justified by the evidence. The plan must state what the first phase does not fix.

CGI judging is scored out of 100: Problem Framing 20, Solution & Feasibility 20, The Build 25, Value Case 20, and Pitch 15. The CGI presentation and demo therefore need their own live-ready package, even if the five-minute Remotion video is used as the Devpost artifact.

The implementation must include a reproducible scenario rather than a generic ticket queue. It needs a seeded backlog, a measurable manual baseline, a Saturday update, and a simulated improvement after configuration.

Required CGI metrics:

- Total unresolved backlog.
- Median time to first triage.
- Median time to department assignment.
- Percentage of cases routed to the wrong department.
- Percentage requiring human review.
- Median time to resolution.
- Estimated staff hours saved.
- Estimated cost per case and payback period.

The Saturday update must materially change the operating situation, such as a surge in one complaint type, a new department, or a new service-level rule. The demo must show the administrator adapting the taxonomy or routing configuration and then re-running the simulation.

### Civic Technology

The resident intake flow brings people closer to government by making reporting accessible through ordinary language, voice, and mobile interfaces. The administration flow makes government operations more responsive by exposing routing, backlog, service-level, and taxonomy information to staff.

To satisfy Civic Technology eligibility, the in-person demo must clearly demonstrate the people-government connection. The audience must see a resident submit a report, receive a case number or status, and see the report reach a government department or representative. This is an eligibility requirement, not merely a narrative claim.

### Best Overall / general judging

The implementation should prioritize depth over a collection of shallow integrations. The core loop must be working end to end before optional sponsor features are added.

General and Civic Technology use the same rubric:

- Technical Execution: 15 points.
- Idea & Impact: 10 points.
- Design & Usability: 10 points.
- Learning & Technical Decisions: 5 points.
- Presentation: up to 5 bonus points.

The in-person presentation must make the implementation understandable, demonstrate the strongest working functionality, explain key trade-offs, and leave time for questions. The core demo should be optimized for reliability rather than feature count.

### Sponsor integrations

- **ElevenLabs:** conversational voice intake, follow-up questions, transcript delivery, and optional spoken confirmation.
- **Tiger Data:** case/event storage or an authoritative analytics store, hypertable-backed event history, and continuous operational aggregates.
- **Auth0:** Universal Login, role-based access, protected APIs, and step-up authentication for sensitive actions.
- **Presage:** optional consented accessibility/well-being signals in the mobile experience; never a case eligibility or triage decision.
- **Cloudflare Workers AI:** extraction, retrieval-assisted answers, and administrator agent tools.
- **Jev:** typed category selection, routing decisions, and confidence-aware classification.

Each integration must have a proof point:

| Integration | Required proof point |
| --- | --- |
| ElevenLabs | A voice conversation asks a context-specific follow-up and creates a case through a signed webhook. |
| Tiger Data | A time-series dashboard uses a hypertable and continuous aggregate. |
| Auth0 | A role-restricted administrator publishes a taxonomy change after step-up authentication. |
| Presage | An explicitly consented accessibility mode changes the interaction without affecting priority or eligibility. |
| Jev | A bounded typed category/routing decision is validated against the active taxonomy. |
| Workers AI | Extraction, retrieval, and admin-agent responses remain useful independently of Jev. |

### Mini-challenge eligibility audit

The resources page lists these Hack the Hill mini-challenges in addition to the MLH categories:

- Best Project Built with ElevenLabs.
- Best FOSS Project.
- Best UI/UX.
- Best Hardware Hack.
- MathemaTech — Education for Everyone.

The current product clearly targets Best Project Built with ElevenLabs and Best UI/UX. It does not automatically qualify for the others:

- **Best FOSS:** the planned use of Workers AI, ElevenLabs, Auth0, Tiger, Presage, and Jev means the complete stack is not an open-source-only project. Enter this only if the rules permit the specific service mix or if we intentionally produce an open-source-only variant.
- **Best Hardware:** the current plan has no meaningful hardware component. Do not add hardware solely to claim the category unless it becomes part of the core civic interaction.
- **MathemaTech:** a complaint-resolution platform does not currently address education access. Enter only if the product gains a genuine education-focused use case, not a superficial educational screen.

The current MLH targets are Best Use of ElevenLabs, Best Use of Tiger Data, Best Use of Presage, and Best Use of Auth0. Gemini, Solana, Vultr, and GoDaddy are excluded by team choice. Mini-challenge selections must be finalized on Devpost and supported by the actual submitted build.

## 4. Product surfaces

### Resident web/mobile intake

Residents can:

1. Select or describe a problem in natural language.
2. Attach a photo, audio clip, or document when relevant.
3. Answer only the follow-up questions needed to complete the report.
4. Review the extracted summary before submission.
5. Receive a case number, category explanation, expected next step, and status updates.

The mobile layout is the primary resident experience. Desktop supports the same flow and is useful for the Remotion demo.

### ElevenLabs conversational intake

The voice agent should:

- Greet the resident and explain what information is needed.
- Ask dynamic follow-up questions based on missing fields.
- Avoid claiming that a case is resolved.
- Read back the extracted report before submission.
- Call a Worker webhook with the transcript and structured intake fields.
- Handle uncertainty by asking a clarifying question or escalating to a human review state.

The Worker, not the voice agent, is the source of truth for validation, classification, persistence, and routing.

The first scripted golden path should be:

```text
Resident: “The sidewalk near the library is dangerous.”
Agent: “What makes it dangerous?”
Resident: “A large section is lifted and someone could trip.”
Agent: “Is anyone injured right now?”
Resident: “No.”
Agent: “I’ll record this as a sidewalk obstruction near the library. Is that correct?”
Resident: “Yes.”
Agent: submits the transcript and structured fields to the Worker.
```

The agent must not claim that an issue is resolved or independently determine emergency eligibility. It collects information, confirms the report, and escalates uncertainty.

### Administrator workspace

The admin workspace contains:

- Backlog overview and service-level metrics.
- Case queue with filters for status, category, confidence, priority, and age.
- Case detail with transcript, evidence, extracted fields, classification rationale, and audit history.
- Taxonomy editor for categories, descriptions, examples, exclusions, required fields, and routing rules.
- Simulation mode for testing a taxonomy change against historical cases.
- Publish flow with a diff, impact preview, confirmation, and versioning.
- Agentic chat interface for querying data and operating approved tools.
- Resolution controls for acknowledgement, assignment, progress, resident follow-up, resolution, and reopening.

### Agentic administrator interface

The interface should feel like a focused ChatGPT-style operations console, but its capabilities must be constrained by explicit tools and authorization.

Read-only tools:

- `search_cases`
- `get_case`
- `get_backlog_metrics`
- `get_category_definitions`
- `search_policies`
- `get_audit_history`
- `simulate_classification`

Confirmation-gated write tools:

- `draft_category`
- `publish_taxonomy_version`
- `reclassify_cases`
- `update_routing_rule`
- `send_case_update`
- `archive_case`

The agent must show the proposed action, affected records, and relevant assumptions before executing a write.

The agent is not the authorization layer. The Worker re-checks the authenticated user, organization, scope, and current record state for every tool call.

### Agentic operations and rich cards

The agent should be able to operate the whole employee workspace through typed tools, not just answer questions. The initial tool inventory should cover:

#### Navigation and context

- `open_workspace_tab`
- `focus_case`
- `save_view`
- `get_current_workspace_state`

#### Cases and workflow

- `search_cases`
- `get_case`
- `update_case_fields`
- `assign_case`
- `transition_case_status`
- `request_resident_information`
- `draft_case_response`
- `preview_bulk_case_change`

#### Taxonomy and routing

- `get_category_definitions`
- `draft_category`
- `simulate_classification`
- `preview_taxonomy_diff`
- `publish_taxonomy_version`
- `update_routing_rule`

#### Analytics and knowledge

- `get_backlog_metrics`
- `compare_time_windows`
- `search_policies`
- `explain_metric_change`
- `get_audit_history`

Every tool call returns a typed result that the UI renders as a rich card. Cards should include:

- A concise title and human-readable summary.
- The action or result type.
- Affected records, category/version IDs, and time range.
- Source links or query details for factual answers.
- Confidence and uncertainty where relevant.
- A preview of changed fields before mutation.
- A clear status: proposed, awaiting approval, approved, executing, completed, failed, or cancelled.
- Undo or recovery guidance where the operation supports it.

Examples:

```text
Case search card
  247 unresolved cases · East region · sidewalk category
  [Open in Cases tab] [Save view]

Taxonomy change card
  Draft: “Sidewalk obstruction near public facilities”
  86 historical cases would change category
  Estimated routing impact: +12% to Roads queue
  [View diff] [Simulate] [Publish]

Bulk-action approval card
  Reclassify 86 cases and update routing
  Requires organization-owner approval
  [Review affected cases] [Approve] [Reject]
```

The approval card is not itself authorization. Clicking approve calls the Worker, which revalidates the user’s Auth0 claims, current taxonomy version, affected-record set, and idempotency key. If the underlying state changed since the preview, the operation must be rejected and regenerated rather than applied blindly.

### Agent/manual parity

Anything the agent can do should have a corresponding manual view, and anything consequential done manually should be visible in the agent’s context. The system should use shared commands and domain services beneath both surfaces:

```text
Agent tool call ─┐
                 ├─> authorized command/service ─> event/audit log ─> shared UI state
Manual tab edit ─┘
```

This prevents the chat interface from becoming a privileged back door and makes the product easier to explain to judges.

## 5. Product design and UX specification

### Design direction

The product should feel like one coherent system with two different modes:

- **Staff/workforce mode:** a calm, dense, ChatGPT-like operations workspace for thinking, querying, reviewing, and taking controlled actions.
- **Resident/citizen mode:** a modern, approachable ticketing experience inspired by the clarity of Jira, Linear, and contemporary service portals, but with less technical vocabulary and more reassurance.

The visual language may take cues from ChatGPT, Stripe, Notion, Anthropic, Jira, and Linear, but it must not be a direct clone of any product. We should borrow interaction patterns—persistent navigation, command/search entry points, contextual side panels, readable timelines, inline status, progressive disclosure, and explicit action confirmation—while creating an original civic visual identity.

The design must optimize for clarity and trust before visual novelty. Avoid excessive gradients, decorative glassmorphism, dense dashboard-card walls, fake AI typing, and animations that obscure state or slow task completion.

### Shared design system

Use one token system across the web app, mobile demo app, and Remotion scenes:

- **Typography:** system UI or Geist/Inter-like sans-serif; readable body text; restrained weight hierarchy.
- **Palette:** warm neutral canvas, graphite text, cool blue/teal primary action, and semantic success/warning/danger colors. Color must never be the only status signal.
- **Shape:** modest 10–14px radii, thin borders, low-elevation surfaces, and consistent control heights.
- **Spacing:** a small spacing scale used consistently rather than arbitrary margins.
- **Motion:** short transitions for navigation, panel changes, and confirmation; respect reduced-motion preferences.
- **Icons:** one consistent icon set with labels or tooltips for unfamiliar actions.
- **Content:** plain language, explicit system status, helpful empty states, and human-readable error recovery.

The shared system should define tokens and primitives for buttons, inputs, selects, badges, tabs, dialogs, drawers, avatars, timelines, tables, charts, chat messages, tool-call cards, status indicators, audio controls, and confirmation panels.

### Admin/workforce web workspace

The admin experience should use a ChatGPT-like workspace where the agent can operate the full authorized product surface, while employees can switch to manual tabs whenever they want direct control.

The agent is the primary operating layer, not a help widget. Subject to the user’s role and confirmation policy, it can inspect and update cases, configure taxonomies, query analytics, search policies, manage routing, prepare resident messages, and navigate the employee to the relevant manual screen. Every operation still passes through the same Worker APIs and authorization checks as manual interaction.

The desktop layout should use a three-region layout:

```text
┌──────────────┬──────────────────────────────┬─────────────────┐
│ Workspace    │ Conversation / work surface  │ Context panel   │
│ navigation   │ chat, queue, case, or report │ case, tools,    │
│              │                              │ sources, audit  │
└──────────────┴──────────────────────────────┴─────────────────┘
```

#### Workspace tabs

The left rail should contain persistent workspace tabs, similar to ChatGPT’s conversation list but oriented around operational work:

- **New task:** start an agent conversation with suggested actions.
- **Inbox:** assigned and unreviewed cases.
- **Cases:** manual queue and case detail tabs.
- **Analytics:** saved dashboards and metric investigations.
- **Taxonomy:** category editor and version history.
- **Policies:** searchable reference material.
- **Settings:** organization, routing, integrations, and permissions.
- **Recent agent tasks:** resumable conversations with status indicators.

Opening a case, simulation, dashboard, or taxonomy draft should create or focus a tab without losing the agent conversation. Tabs need unsaved-change indicators, close/reopen behavior, a recent-history list, and a clear indication of whether the view is live, draft, or read-only demo mode.

The agent should be able to open and populate a manual tab:

```text
Admin: “Show me the unresolved sidewalk complaints from the east region.”
Agent: searches cases, then opens a filtered Cases tab with the results.
Admin: edits one category manually.
Agent: notices the changed draft state and can explain the difference.
```

Chat and manual tabs must share the same server state and version identifiers. A manual edit must appear in the conversation context, and an agent proposal must be visible in the relevant manual tab before approval.

Core patterns:

- Persistent left navigation for Inbox, Cases, Analytics, Taxonomy, Policies, and Settings.
- A ChatGPT-like command entry point for asking questions or starting actions.
- Conversation messages that can contain tables, charts, citations, case links, and proposed tool calls.
- Tool-call cards that show what the agent wants to do, why, which records are affected, and the approval control.
- A right-side context panel that keeps case details, retrieved sources, taxonomy versions, and audit history visible without losing the conversation.
- Queue views with saved filters, keyboard navigation, bulk-selection previews, and clear assignment/status controls.
- A dashboard that uses a compact KPI row plus a few meaningful modules rather than oversized cards.
- A taxonomy editor with draft/published state, version diff, example cases, simulation results, and an explicit publish action.
- Rich cards for every meaningful agent operation rather than raw JSON or opaque prose.

Admin interface states must be designed explicitly:

- Loading and streaming.
- No results.
- Low confidence.
- External service unavailable.
- Unsaved draft.
- Pending approval.
- Successful mutation.
- Failed mutation with retry and recovery.
- Read-only/offline demo mode.

The admin interface should support keyboard-first operation. Provide a command palette, search shortcut, visible focus states, predictable Escape behavior, and shortcuts only where they do not conflict with platform/browser conventions.

### Resident/citizen web experience

The resident surface should feel like a modern service ticket rather than an internal operations dashboard:

- A single clear primary action: “Report an issue”.
- A short, conversational intake flow instead of a large form.
- Progressive disclosure: ask only for fields required by the current category.
- A visible microphone option with an equivalent text path.
- Attachment upload with previews and clear privacy language.
- A review-before-submit screen showing the resident’s words, extracted summary, category, location, and what happens next.
- A case page with a prominent status, department ownership, expected response window, timeline, messages, attachments, and “add information” action.
- Human-readable explanations such as “We sent this to Roads because it describes a raised sidewalk near a public facility.”
- No internal confidence scores, model names, routing rules, or administrative jargon in the resident view.

The resident experience must make the government connection visible: department name, case number, responsible service, expected next step, and a path to correct the report or request human help.

### Mobile app scope

Build a small React Native app, preferably with Expo, only for the Remotion scenes and supporting live-demo fixtures. It does not need production-level parity with the web app.

Required mobile screens:

1. Welcome/consent screen.
2. Voice or text report intake.
3. Follow-up question state.
4. Review and confirm report.
5. Submitted case receipt.
6. Case status timeline.
7. Optional Presage accessibility-mode moment, only if implemented.

The mobile app may use deterministic fixture data and mocked provider responses for video capture. It must still show realistic loading, error, permission, and confirmation states. Reuse the shared tokens and copy style, but prioritize the exact demonstrated flows over broad navigation or feature completeness.

### Accessibility and inclusive UX

Target WCAG 2.2 AA patterns for the demonstrated web and mobile surfaces:

- Full keyboard operation on the web.
- Visible, high-contrast focus indicators.
- Minimum 24×24 CSS-pixel pointer targets, with larger primary controls on mobile.
- Proper labels, headings, landmarks, live-region announcements, and error associations.
- Do not use color alone to communicate status.
- Captions and transcript for voice interactions.
- Text alternative for every voice action.
- Reduced-motion support.
- Plain-language copy and a clear language switch path if time permits.
- Large touch targets and adequate spacing in the mobile demo.

The design should use accessibility as part of the product story, not only as a compliance checklist. Voice, text, mobile, and human-review paths should all be treated as first-class ways to participate.

### UX acceptance checks

Before recording the demo, test that:

- A first-time resident can understand what to do without explanation.
- A resident can complete intake without using a microphone.
- An administrator can find a case, understand its state, and see why it was categorized.
- An administrator can preview a write before it happens.
- Every destructive or consequential action has an explicit confirmation.
- The interface remains understandable at mobile width and projected presentation size.
- Keyboard focus is visible and never hidden behind sticky UI.
- Error states explain how to recover.
- The video scenes and live UI use the same labels, statuses, and terminology.

## 6. Technical architecture

```text
React web/mobile UI
        │
        ▼
Cloudflare Worker API ─── Auth0 JWT/RBAC validation
        │
        ├── Workers AI: extraction, retrieval, admin agent
        ├── Jev: bounded category and routing decisions
        ├── Vectorize: semantic policy/category/case retrieval
        ├── R2: attachments, audio, transcripts, demo assets
        ├── Tiger Cloud PostgreSQL: cases, taxonomy, events, analytics
        ├── ElevenLabs: voice agent and signed webhook callbacks
        └── Presage: optional client-side derived signals
```

### Cloudflare components

- **Workers:** API routes, authentication middleware, webhook handlers, tool execution, and server-rendered or static frontend delivery.
- **Workers AI:** extraction, streaming conversational responses where supported, and embeddings for retrieval. It also provides the fallback classifier.
- **Vectorize:** semantic search over policies, category examples, and approved historical cases.
- **R2:** object storage for uploaded evidence, voice recordings, transcripts, and rendered Remotion videos.
- **D1 or Durable Objects, if needed:** lightweight session/state support where it is simpler than using the primary database. Do not duplicate authoritative case state unnecessarily.

### External services

- **Tiger Cloud:** primary case/event data path for the Tiger challenge. Use PostgreSQL-compatible access from Workers, preferably through an appropriate connection-pooling or serverless connection path.
- **Auth0:** identity, roles, organizations, and step-up authentication.
- **ElevenLabs:** voice agent runtime and post-call/webhook events.
- **Presage:** optional mobile SDK integration for the accessibility scenario.

The Tiger implementation must include:

- A `case_events` hypertable keyed by `occurred_at` and `case_id`.
- Continuous aggregates for hourly intake, backlog by department, routing time, and resolution time.
- A dashboard query comparing metrics before and after a taxonomy publication.
- Seeded event data large enough to make the time-series view meaningful.

If direct Worker-to-Tiger connectivity is not reliable, retain a seeded read-only demo mode. Do not describe seeded data as live Tiger analytics.

## 7. Repository and delivery workflow

### pnpm workspace

The repository should be a single pnpm workspace. Use one lockfile at the repository root and keep shared contracts, fixtures, design tokens, and domain logic in packages rather than duplicating them across the web, Worker, mobile, and Remotion projects.

Recommended layout:

```text
apps/
  web/                 # resident and workforce web application
  worker/              # Cloudflare Worker API and integrations
  mobile/              # React Native/Expo demo app
  remotion/            # deterministic five-minute Devpost video

packages/
  contracts/           # API schemas, tool schemas, event types
  domain/              # case lifecycle, taxonomy, permissions, pure logic
  db/                  # migrations, queries, Tiger adapters
  ai/                  # Workers AI, Jev, and fixture provider adapters
  ui/                  # shared web components and workforce/resident primitives
  design-tokens/       # colors, typography, spacing, motion, status tokens
  fixtures/            # Northwind data, demo cases, transcripts, video scenes
  config/              # shared TypeScript, ESLint, formatting, and test config

docs/
PLAN.md
pnpm-workspace.yaml
pnpm-lock.yaml
package.json
```

The exact package names may change, but the boundaries should remain clear:

- `contracts` is the source of truth for API, events, agent tools, and rich-card payloads.
- `domain` contains provider-independent business rules and must be testable without network access.
- `ai` hides Workers AI, Jev, and fixture implementations behind stable interfaces.
- `fixtures` drives both offline UI demos and Remotion so the video cannot drift from the product vocabulary.
- `ui` and `design-tokens` keep the admin workspace, resident site, mobile demo, and video visually consistent.
- `worker` owns authorization, orchestration, persistence, webhooks, and tool execution; clients never call privileged providers directly.

### Root scripts

The root `package.json` should expose a small, predictable command surface:

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm build
pnpm check
pnpm demo:render
pnpm deploy:worker
```

`pnpm check` is the local equivalent of CI and must run linting, typechecking, unit tests, contract validation, and production builds. Commands should be safe to run repeatedly and should not require production credentials for unit or fixture-based checks.

### CI

CI should run on every push to `main` and on any review workflow the team chooses to use. The required check sequence is:

1. Install with the committed pnpm version and `--frozen-lockfile`.
2. Validate workspace/package metadata.
3. Run lint and formatting checks.
4. Run TypeScript checks for every package.
5. Run domain, schema, provider-mock, and permission tests.
6. Build the web, Worker, mobile, and Remotion packages.
7. Verify that fixtures, captions, and generated demo manifests are present.
8. Run a smoke test against the Worker in local/fixture mode.

Production deployment must be a separate explicitly triggered job or workflow after all checks pass. It must use Cloudflare environment secrets, never print secrets, and deploy the Worker and static assets as one versioned release. Remotion rendering may run in CI, but a failed optional mobile/square render must not hide a failed primary 16:9 render.

Minimum CI protections:

- Frozen lockfile.
- No uncommitted generated files after checks.
- No committed secrets or `.dev.vars` files.
- Contract compatibility check between Worker and clients.
- Migration check against a disposable database or migration fixture.
- Deterministic fixture test for the CGI metrics and value-case numbers.
- Agent permission tests proving that unauthorized roles cannot execute write tools.
- Build artifact size and startup smoke checks where practical.

### Subagent execution model

Work should be divided into independently verifiable units and assigned to subagents. Use only the configured Luna model with `high` or `xhigh` reasoning for these subagents. Do not delegate project work to a lower reasoning setting or a different model.

The orchestrator must build the project in dependency order. It must not immediately dispatch many agents into an empty repository.

#### Orchestration sequence

1. **Core bootstrap subagent — sequential gate.** Assign one Luna high/xhigh subagent to create the complete core vertical slice: pnpm workspace, shared contracts, Worker shell, database/domain model, Auth0 middleware, resident case submission, admin queue, fixture provider, and one end-to-end case lifecycle. This unit establishes the conventions and interfaces that every later feature uses.
2. **Core verification gate.** The orchestrator runs the workspace install, lint, typecheck, tests, builds, and local smoke test. It does not delegate feature work until the core is committed, pushed, and green.
3. **Feature decomposition.** The orchestrator divides the remaining work into feature-sized units with explicit ownership, dependencies, files/packages, acceptance checks, and a commit boundary.
4. **Parallel feature work.** Independent agents may work in parallel only when their units do not overlap in files or unstable interfaces. Each agent works within its owned package or directory and consumes the core contracts rather than changing them opportunistically.
5. **Integration gates.** After each feature wave, the orchestrator synchronizes `main`, runs `pnpm check`, and assigns a focused integration/review unit before starting the next dependent wave.
6. **Demo freeze.** Once the P0 flow is stable, freeze the shared contracts and fixtures. Later agents may improve styling or add P1/P2 features, but may not silently change the core behavior shown in the live demo or Remotion video.

The core subagent is not expected to implement every sponsor integration. It is expected to leave clean extension points, typed contracts, test fixtures, and a working vertical slice so subsequent agents can add features without rewriting the foundation.

Good subagent units include:

- Worker/API foundation.
- Database schema and Tiger analytics.
- Resident web intake.
- Workforce agent workspace and rich cards.
- Auth0 authorization.
- ElevenLabs integration.
- Jev/Workers AI provider adapter.
- React Native demo screens.
- Remotion scenes and captions.
- CI and workspace tooling.

The first core-bootstrap unit is special and must be assigned before these feature units. After bootstrap, use ownership boundaries such as:

| Feature unit | Primary ownership | Must not edit casually |
| --- | --- | --- |
| Core bootstrap | `apps/worker`, `packages/domain`, `packages/contracts`, workspace root | Feature UI packages |
| Resident intake | `apps/web` resident routes, resident UI primitives | Worker authorization/domain internals |
| Workforce agent | admin routes, agent thread UI, rich cards | Resident flow and provider implementations |
| Case workflow | lifecycle commands, status UI, audit events | Design tokens and unrelated integrations |
| Tiger analytics | `packages/db`, migrations, metric queries, analytics UI | Agent conversation components |
| AI providers | `packages/ai`, provider tests, schemas | Case UI and database migrations unless contract changes are approved |
| Auth0 | auth middleware, role tests, protected UI states | Domain semantics and visual redesign |
| ElevenLabs | voice agent configuration, signed webhook adapter, voice fixtures | Taxonomy semantics |
| Presage/mobile | `apps/mobile`, Presage adapter, accessibility fixtures | Core web layout |
| Remotion | `apps/remotion`, shared demo scene fixtures | Live application behavior |
| CI/workspace | workflow files, package scripts, config package | Feature implementation |

Each unit must have a clear file/package boundary, acceptance checks, and a short handoff note in the task conversation. Subagents should inspect the current shared tree before editing, preserve unrelated work, and avoid broad formatting or dependency upgrades.

### Shared main-branch protocol

All subagents may work directly in the same checkout and `main` branch. Do not create feature branches or separate worktrees for this project unless the team explicitly changes this policy.

Shared `main` does not mean shared files without coordination. The orchestrator maintains a lightweight ownership ledger containing:

- Feature/unit name.
- Assigned subagent and model/reasoning setting.
- Owned packages and directories.
- Dependencies and expected interface inputs/outputs.
- Start status and current commit.
- Validation commands.
- Completion status and pushed commit.

Only one active unit may own a file at a time. If two features need the same interface, the orchestrator schedules a contract unit first, commits it, and then releases the dependent feature units. Agents must not “temporarily” edit another unit’s files to unblock themselves.

Before editing:

1. Read the relevant plan and current package state.
2. Check the working tree and recent commits.
3. Announce or record the unit being claimed.
4. Confirm the ownership ledger shows no overlap with another active unit.
5. Avoid files currently being changed by another active unit.

After completing a unit:

1. Run the narrowest relevant tests first.
2. Run `pnpm check` or the affected package checks.
3. Review the diff for unrelated changes, generated secrets, and accidental formatting churn.
4. Commit the completed unit to `main`.
5. Push `main` when the unit is complete and validated.
6. Report the commit, checks run, remaining risks, and files touched.

If another subagent has pushed since work began, synchronize before pushing and resolve conflicts deliberately. Prefer short units and frequent synchronization so conflicts remain small. Never reset, discard, or overwrite another unit’s changes. If a conflict crosses ownership boundaries, stop and return it to the orchestrator instead of guessing. A unit is not complete merely because its code compiles; its acceptance behavior and CI checks must pass.

Interface changes require a contract-first handoff:

1. The owning agent documents the proposed change in `packages/contracts` or the relevant package.
2. The change is committed independently with tests or fixtures.
3. The orchestrator synchronizes `main` and updates dependent unit instructions.
4. Dependent agents consume the new contract without duplicating or redefining it.

### Commit policy

Every commit must use a Conventional Commits subject with no body and no co-author attribution:

```text
feat(worker): add protected case transition tool
fix(ai): validate Jev category against taxonomy version
test(cgi): add Northwind scenario metrics
docs(plan): define workspace and CI workflow
chore(ci): add frozen pnpm check
```

Rules:

- Use `type(scope): imperative summary`.
- Keep the subject concise and specific.
- Do not add a commit description/body.
- Do not add `Co-authored-by` or any other attribution trailer.
- Do not combine unrelated units into one commit.
- Do not commit secrets, local credentials, generated media, or temporary debugging output.

## 8. AI design

### Taxonomy configuration

Categories are data, not code. Each published category has:

```ts
type CategoryDefinition = {
  id: string
  name: string
  description: string
  examples: string[]
  exclusions: string[]
  requiredFields: string[]
  routingTeam: string
  priorityRules: string[]
  publicExplanation: string
  version: number
  status: "draft" | "published" | "archived"
}
```

Administrators can create a draft category and provide a description in plain language. The system converts that description into a reviewed, versioned definition. A category cannot affect production classification until an administrator publishes it.

### Classification contract

Jev should be used for the final bounded decision when the active taxonomy is available. Its decision-oriented interface is a good fit for choosing among administrator-defined categories, routing teams, and escalation states. It should not be responsible for the full conversational experience or long-form explanations.

Workers AI remains responsible for extracting fields from natural-language reports, summarizing transcripts, retrieving relevant context, and powering the administrator copilot. This gives each model a narrow role:

```text
Workers AI extraction → Jev category/routing decision → Workers AI explanation
```

The Jev integration must be isolated behind a provider interface so the project can fall back to a Workers AI structured-output classifier if the Jev API, model availability, or network path is unavailable during judging.

```ts
interface ClassificationProvider {
  classify(input: {
    text: string
    extractedFields: Record<string, unknown>
    taxonomy: CategoryDefinition[]
  }): Promise<ClassificationResult>
}
```

Required implementations:

- `JevClassificationProvider` for live bounded decisions.
- `WorkersAIClassificationProvider` as the live fallback.
- `FixtureClassificationProvider` for Remotion and offline judging.

The normalized classifier interface should return a validated structure similar to:

```ts
type ClassificationResult = {
  categoryId: string
  confidence: number
  extractedFields: Record<string, string>
  missingFields: string[]
  alternativeCategories: string[]
  rationale: string
}
```

Application rules:

- `categoryId` must exist in the active taxonomy version.
- `confidence` is advisory and cannot directly decide eligibility.
- Low-confidence or conflicting results enter human review.
- Model output is never trusted as executable instructions.
- The final case record stores the model, prompt/config version, taxonomy version, and timestamp used for the decision.
- JSON output is validated with a runtime schema before persistence.

Jev should provide the bounded choice and probability/confidence information. The application must still validate that the selected category exists in the active taxonomy version. If the fallback Workers AI classifier is used, its JSON output must be schema-validated because model schema adherence is not guaranteed. Classification must be non-streaming, retryable, and auditable. The conversational admin response can use a separate streaming path.

### Retrieval

Use embeddings and Vectorize to retrieve:

- Public service policies.
- Category descriptions and examples.
- Approved historical cases.
- Routing and service-level guidance.

Retrieved context must be labeled as reference material. It must not be allowed to override tool permissions, system policies, or administrator confirmation requirements.

## 9. Case lifecycle and CGI scenario

### Case lifecycle

Cases must support these states:

```text
draft → submitted → classified → needs_review → assigned → acknowledged
→ in_progress → waiting_on_resident → resolved → reopened → closed
```

Not every case uses every state, but every transition produces an immutable event. AI may recommend a category or route; only an authorized human or explicitly approved workflow may advance a sensitive case state.

### Seeded scenario

The repository should contain a deterministic scenario fixture with:

- At least 500 generated cases.
- At least four departments.
- At least six categories.
- Duplicates, incomplete reports, ambiguous reports, and misrouted historical cases.
- Case timestamps covering several weeks.
- A Saturday surge that changes category volume or service-level expectations.

The fixture must include the baseline assumptions used in the value case. The simulation compares manual triage with CivicResolve using the same cases and service-level rules.

### Value case

The one-page CGI value case must state:

- Staff cost assumption.
- Average manual triage time.
- Expected automated classification rate.
- Human-review rate.
- Expected routing-error reduction.
- Estimated implementation and operating cost.
- Monthly benefit estimate.
- Payback period.
- Sensitivity range for optimistic, expected, and conservative assumptions.

Every number shown in the pitch must be traceable to the fixture or an explicitly labeled assumption.

## 10. Data model

Minimum relational entities:

- `users`
- `organizations`
- `cases`
- `case_messages`
- `case_attachments`
- `case_classifications`
- `category_definitions`
- `taxonomy_versions`
- `routing_rules`
- `service_level_policies`
- `audit_events`
- `ai_runs`
- `voice_sessions`
- `departments`
- `case_status_transitions`
- `agent_threads`
- `agent_messages`
- `agent_tool_calls`
- `workspace_views`
- `workspace_tabs`

Minimum event fields:

```ts
type CaseEvent = {
  caseId: string
  eventType: string
  occurredAt: string
  actorType: "resident" | "agent" | "admin" | "system"
  actorId?: string
  payload: Record<string, unknown>
}
```

Agent and workspace state should retain enough information to resume work safely:

- `agent_threads` stores the organization, owner, title, status, and last activity.
- `agent_messages` stores user/agent messages and referenced entities.
- `agent_tool_calls` stores tool name, validated arguments, preview, approval, result, and audit linkage.
- `workspace_tabs` stores the tab type, route, entity/version IDs, draft state, and owner.

Conversation history and tabs are user-facing workflow state, but case and taxonomy data remain authoritative in the primary database. Never let a transcript alone define a successful mutation.

The event history should be time-series-friendly so the dashboard can show intake volume, backlog age, classification confidence, routing time, resolution time, and taxonomy changes over time.

## 11. API surface

### Resident APIs

- `POST /api/cases`
- `POST /api/cases/:id/attachments`
- `POST /api/cases/:id/classify`
- `GET /api/cases/:id`
- `POST /api/cases/:id/confirm`
- `GET /api/cases/:id/events`
- `POST /api/cases/:id/status`
- `POST /api/cases/:id/reopen`

### Admin APIs

- `GET /api/admin/cases`
- `GET /api/admin/metrics`
- `GET /api/admin/taxonomy`
- `POST /api/admin/taxonomy/drafts`
- `POST /api/admin/taxonomy/simulate`
- `POST /api/admin/taxonomy/publish`
- `POST /api/admin/agent`
- `GET /api/admin/agent/threads`
- `POST /api/admin/agent/threads`
- `GET /api/admin/agent/threads/:id`
- `POST /api/admin/agent/threads/:id/messages`
- `POST /api/admin/agent/tool-calls/:id/approve`
- `POST /api/admin/agent/tool-calls/:id/reject`
- `GET /api/admin/workspace/tabs`
- `POST /api/admin/workspace/tabs`
- `PATCH /api/admin/workspace/tabs/:id`

### Integration APIs

- `POST /api/integrations/elevenlabs/webhook`
- `POST /api/integrations/jev/classify` or an internal provider call from the Worker
- `POST /api/integrations/presage/events`
- `POST /api/integrations/auth0/actions` where needed

All integration webhooks must verify their provider signature or secret, reject replayed events, and be idempotent.

## 12. Security and privacy

- Use Auth0 Universal Login and validate JWT issuer, audience, expiration, and required scopes in the Worker.
- Separate resident, reviewer, administrator, and organization-owner permissions.
- Require step-up authentication for taxonomy publication, bulk reclassification, exports, and destructive actions.
- Store only the minimum personally identifying information needed for the demo.
- Keep resident-facing explanations separate from internal model rationale.
- Encrypt or protect uploaded evidence and use short-lived signed URLs.
- Redact sensitive fields before sending content to optional analytics or demo systems.
- Log every AI run, tool call, approval, mutation, and integration callback.
- Treat transcripts, uploaded evidence, retrieved documents, and tool results as untrusted input.
- Do not use Presage signals to determine government-service eligibility, urgency, or punishment.

### Auth0 authorization model

Required roles:

- `resident`
- `reviewer`
- `department_admin`
- `organization_owner`

Required demonstrations:

- Residents can access only their own cases.
- Reviewers can correct classifications but cannot publish taxonomy changes.
- Department administrators can manage their department’s queue.
- Organization owners can publish taxonomy and routing changes.
- Taxonomy publication and bulk reclassification require step-up authentication.
- The audit record stores the Auth0 subject, organization, role, action, and affected version.

### Presage accessibility boundary

Presage is P2 and must not be added as a decorative biometric dashboard. If implemented, it is an opt-in interaction aid that can offer slower speech, shorter prompts, larger controls, pause/resume, or a text alternative based on a derived engagement/accessibility signal. It must display consent, provide an immediate disable control, minimize retention, and explicitly state that the signal does not affect case priority, eligibility, or routing.

## 13. Submission and presentation strategy

The project needs two coordinated deliverables, not two unrelated products. They share the same build, fixtures, terminology, and evidence, but optimize for different judging contexts.

### Deliverable A — in-person main-track presentation

This is the primary live demo for the selected General or Civic Technology track. It is five minutes followed by three minutes of questions.

Recommended angle if selecting Civic Technology:

1. Resident reports a real civic issue by voice or mobile.
2. The resident reviews and confirms the extracted report.
3. The system creates a case and explains its next step.
4. A government department receives ownership.
5. The resident sees a status update.
6. The administrator demonstrates one safe correction or review decision.

Recommended angle if selecting General:

1. Open with the difficult technical problem: configurable decisioning over messy, changing operational data.
2. Demonstrate Workers AI extraction, Jev bounded classification, retrieval, tool calls, and auditability.
3. Show the administrator drafting a taxonomy change, simulating its effect, and publishing it securely.
4. Show Tiger metrics proving the operational effect.
5. Explain the key trade-offs and what was learned during the build.

The in-person demo should use only the strongest P0 path. It should not attempt to show every sponsor integration. Slides are optional; the working build is mandatory. Prepare a backup seeded mode that preserves the same visible flow if an external service fails.

The team must assign speaking roles so every member speaks for at least 30 seconds where the selected challenge requires it. Rehearse to finish the presentation before the five-minute limit and reserve the remaining time for the demo transition.

### Deliverable B — five-minute Remotion Devpost video

The Devpost video is the polished evidence package for CGI and the selected mini-challenges. It may cover more integrations than the live presentation, but every claimed feature must exist in the submitted build.

Suggested structure:

1. 0:00–0:35 — CGI diagnosis using the Northwind data and the core problem.
2. 0:35–1:20 — Resident voice/mobile intake with ElevenLabs.
3. 1:20–2:00 — Workers AI extraction and Jev classification.
4. 2:00–2:45 — Admin taxonomy configuration, simulation, Auth0 authorization, and audit trail.
5. 2:45–3:30 — Tiger time-series dashboard and before/after operational metrics.
6. 3:30–4:10 — Presage accessibility mode, only if the feature is actually implemented and consented.
7. 4:10–4:40 — CGI value case: cost, benefit, payback, assumptions, and limitations.
8. 4:40–5:00 — Architecture, challenge entries, and the strongest outcome.

The video must include captions, readable UI at normal playback size, visible sponsor/product names where appropriate, and no claims that are not supported by the build or the synthetic data. The video supplements rather than replaces any required live CGI pitch or selected-main-track judging.

## 14. Remotion demo specification

The rendered demo should be fixture-driven and deterministic. It should not depend on live Workers AI, Tiger, Auth0, ElevenLabs, Jev, or Presage calls during rendering.

Every scene must correspond to a real application state or a typed fixture shared with the application. The transcript, voice audio, displayed classification, metrics, taxonomy diff, and value-case numbers must agree with one another.

### Suggested 5-minute sequence

1. **CGI diagnosis:** Northwind’s evidence-backed complaint problem.
2. **Resident mobile intake:** a resident describes an issue and uploads evidence.
3. **Voice intake:** ElevenLabs asks a context-specific follow-up question.
4. **AI decisioning:** Workers AI extracts fields, Jev selects an administrator-defined category, and Workers AI explains the result.
5. **Human safety check:** low confidence is routed to review.
6. **Admin agent:** an administrator asks why cases are accumulating.
7. **Taxonomy configuration:** the administrator drafts a new category and sees a simulation preview.
8. **Approval:** Auth0-protected publication applies the new taxonomy version.
9. **Tiger dashboard:** backlog, response time, and routing metrics update.
10. **Accessibility mode:** Presage is shown only if the consented interaction aid is implemented.
11. **Value case:** projected time saved, backlog reduction, assumptions, and payback.
12. **Closing:** architecture, challenge entries, and limitations.

Required render outputs:

- 16:9 presentation video.
- 9:16 mobile/social video.
- 1:1 square cut if time permits.
- SRT captions generated from the same fixture timeline.
- A short silent fallback version in case venue audio is unreliable.

The 16:9 cut is mandatory. Mobile and square cuts are produced only after the primary cut is complete.

## 15. Build phases

### Phase 1 — Foundation

- Assign one core-bootstrap subagent to create the complete first vertical slice before parallel feature delegation.
- Create the Worker, web, and package workspace skeleton.
- Configure environments and secrets.
- Add Auth0 login and role checks.
- Create database migrations and seed data.
- Add the basic resident and admin routes.
- Create the deterministic scenario fixture and baseline metric calculator.
- Commit and push the verified bootstrap unit before releasing feature units.

### Phase 2 — Core case loop

- Implement case creation and attachments.
- Implement taxonomy storage and versioning.
- Add Workers AI extraction and Jev classification behind a provider interface.
- Add validation, confidence thresholds, review state, and audit events.
- Build the admin case queue.
- Implement the full case lifecycle and resolution transitions.

### Phase 3 — Sponsor integrations

- Connect Tiger Data and implement time-series metrics.
- Add Vectorize policy/category retrieval.
- Configure ElevenLabs voice intake and signed webhooks.
- Add Auth0 step-up protection to taxonomy publishing.
- Add Presage only after the core flow is stable.
- Verify Tiger hypertable and continuous aggregate queries with real dashboard output.

### Phase 4 — Agentic administration

- Implement read-only tools first within the workforce-agent ownership boundary.
- Add persistent agent threads and side workspace tabs.
- Make the agent able to open and populate manual Cases, Analytics, Taxonomy, Policies, and Settings tabs.
- Render typed results as rich cards with sources, affected records, diffs, and status.
- Add tool-call confirmation UI.
- Add draft taxonomy and simulation tools.
- Add publishing and bulk mutation tools with authorization and audit logging.
- Add the golden-path ElevenLabs conversation and signed webhook replay protection.

### Phase 5 — Demo and submission

- Freeze deterministic fixtures.
- Build Remotion scenes for desktop, mobile, and voice flows.
- Render MP4s and captions.
- Prepare the one-page CGI value case.
- Prepare the five-minute pitch and assign speaking roles.
- Build the focused React Native demo screens for mobile intake, confirmation, case status, and any demonstrated Presage flow.
- Test the demo without network access where possible.
- Run a final challenge evidence checklist for every sponsor integration.

## 16. Definition of done

The project is ready for judging when:

- A resident can submit a case end to end.
- A voice conversation can collect missing intake details.
- Workers AI produces validated extracted fields and Jev produces a validated category/routing decision.
- An administrator can create, simulate, and publish a category.
- A published taxonomy version changes subsequent classifications.
- Low-confidence cases reach a human review queue.
- A case can progress from assignment through resolution and reopening.
- Tiger-backed metrics show backlog and time-based operational trends using a hypertable and continuous aggregate.
- Auth0 prevents unauthorized administrative actions.
- Auth0 roles visibly change what each user can do, and sensitive publication requires step-up authentication.
- The agent can answer questions using tools and cannot silently perform writes.
- The agent can open and populate manual workspace tabs without losing conversation context.
- Rich cards show proposed edits, affected records, sources, approvals, and execution status.
- Manual edits and agent actions stay synchronized through shared commands and version identifiers.
- Audit events explain who changed what and why.
- The resident web surface and workforce web surface use the same design system but have distinct information architecture.
- The React Native app demonstrates the required mobile flows with realistic loading, error, consent, and confirmation states.
- The Remotion demo presents the complete loop with reproducible output.
- A concise value case explains costs, benefits, assumptions, and payback.
- The Saturday CGI scenario can be replayed from a clean fixture.
- Every retained sponsor integration has an observable, working proof point.

## 17. Offline mode and failure handling

The demo must remain usable when external services fail. Implement:

- `FixtureClassificationProvider` for deterministic classification.
- Seeded Tiger metrics for read-only dashboard fallback.
- A local transcript/audio fixture for the ElevenLabs scene.
- A visible integration status indicator.
- Timeouts and retries for all external providers.
- Idempotency keys for ElevenLabs, Jev, Presage, and Auth0 callbacks.
- A read-only demo account with pre-seeded cases.

Fallback mode must be labeled as demo/offline mode rather than silently pretending to be live.

## 18. Key risks and mitigations

| Risk | Mitigation |
|---|---|
| AI output does not match the schema | Runtime validation, retries, enum checks, and human review |
| Jev is unavailable or cannot be reached from the Worker | Provider adapter with a Workers AI structured-output fallback and seeded demo fixtures |
| Scope becomes too broad | Finish the core case loop before Presage and advanced agent features |
| Sponsor integrations look superficial | Give each retained integration a visible, necessary role in the product |
| External APIs fail during judging | Seed data, local fixtures, graceful degraded mode, and a pre-rendered demo |
| Admin agent makes unsafe changes | Explicit tool allowlist, Auth0 roles, confirmation UI, and audit logs |
| Privacy concerns around voice or biometrics | Consent, minimal data retention, redaction, and no eligibility decisions from biometrics |
| Tiger integration is difficult from Workers | Validate PostgreSQL connectivity in Phase 1 and keep a seeded fallback for the demo |
| Remotion rendering drifts from the product | Share typed fixtures and event definitions between the app and video renderer |
| The project violates event rules about pre-event work | Confirm the current rules with organizers and treat this plan as private preparation until permitted |

## 19. Configuration inventory

Expected secrets/configuration:

```text
AUTH0_DOMAIN
AUTH0_AUDIENCE
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET
ELEVENLABS_API_KEY
ELEVENLABS_AGENT_ID
ELEVENLABS_WEBHOOK_SECRET
JEV_API_KEY
TIGER_DATABASE_URL or Hyperdrive binding
PRESAGE configuration, if enabled
R2 bucket bindings
VECTORIZE index binding
WORKERS_AI binding
```

Secrets must be configured through Wrangler/Cloudflare environment secrets and never committed to the repository or embedded in Remotion fixtures.

## 20. Submission evidence checklist

Before submission, capture evidence for each judging claim:

- CGI: baseline, Saturday update, before/after metrics, value case, and working resolution flow.
- Civic Technology: resident submission, case number, department ownership, status update, and resident-visible outcome.
- Best Overall: live working path, design rationale, technical tradeoffs, and a stable demo.
- ElevenLabs: transcript of the dynamic follow-up conversation and webhook-created case.
- Tiger Data: hypertable schema, continuous aggregate definition, and dashboard query/result.
- Auth0: role matrix, protected route, step-up authentication, and audit event.
- Presage: consent screen, SDK-derived accessibility adaptation, and proof that it does not affect service decisions.
- Jev: bounded input, typed decision, confidence/probability result, taxonomy validation, and fallback behavior.
- Remotion: rendered video, captions, and mapping from scenes to working features.

## 21. Official references

- [Hack the Hill III resources, rules, challenges, and judging](https://tracker.hackthehill.com/resources)
- [Cloudflare Workers AI models](https://developers.cloudflare.com/workers-ai/models/)
- [Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- [Workers AI JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- [Workers AI function calling](https://developers.cloudflare.com/workers-ai/features/function-calling/)
- [Workers AI embeddings with Vectorize](https://developers.cloudflare.com/vectorize/get-started/embeddings/)
- [Workers AI RAG tutorial](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/)
- [Jev API documentation](https://www.jevai.org/docs)
- [ElevenLabs Agents](https://elevenlabs.io/docs/eleven-agents/overview)
- [ElevenLabs webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools)
- [Tiger Data documentation](https://www.tigerdata.com/docs)
- [Auth0 documentation](https://auth0.com/docs)
- [Presage SmartSpectra documentation](https://smartspectra.presagetech.com/)
- [Remotion documentation](https://www.remotion.dev/docs/)
- [Stripe Dashboard](https://support.stripe.com/topics/dashboard)
- [Notion keyboard shortcuts and navigation patterns](https://www.notion.com/help/keyboard-shortcuts)
- [WCAG 2.2](https://www.w3.org/TR/wcag/)
