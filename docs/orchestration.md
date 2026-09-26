# Orchestration and GitHub work breakdown

Execution status: the user authorized implementation, commits, pushes, deployment, and provider setup. The tracker records acceptance and blockers; a closed local implementation issue does not by itself prove live provider acceptance.

## What it is

This is the execution protocol for building the bilingual CivicResolve web/mobile product with Luna subagents. It defines the dependency gate, safe parallelism in one shared `main` checkout, issue ownership, integration checks, and handoff evidence.

## Tracker structure

The [repository issue tracker](https://github.com/matteopolak/hth3/issues) has five milestones, seven parent epics, and 40 native sub-issues. Dependencies are recorded as GitHub blocking relationships, not just prose. Do not assign an issue to an agent until its blockers have passed acceptance.

| Gate | Milestone                                                                                   | Parent epic                                                                                                                                                                                             | Issue range and purpose                                                                                                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | [Foundation and civic loop](https://github.com/matteopolak/hth3/milestone/1)                | [#1 Shared foundation and security](https://github.com/matteopolak/hth3/issues/1)                                                                                                                       | [#8–#13](https://github.com/matteopolak/hth3/issues/8): workspace, contracts/i18n, Worker/D1/R2, roles, two vertical slices, web/mobile shells.                                                                                                                                                                           |
| B    | [Discovery and applications](https://github.com/matteopolak/hth3/milestone/2)               | [#2 Real-source catalog](https://github.com/matteopolak/hth3/issues/2), [#3 Applications](https://github.com/matteopolak/hth3/issues/3), [#5 Experiences](https://github.com/matteopolak/hth3/issues/5) | [#14–#23](https://github.com/matteopolak/hth3/issues/14) and [#29–#33](https://github.com/matteopolak/hth3/issues/29): adapters, search/map, résumé, native/external applications, public web/mobile UI.                                                                                                                  |
| C    | [Categorization and conversational agents](https://github.com/matteopolak/hth3/milestone/3) | [#4 Civic feedback](https://github.com/matteopolak/hth3/issues/4), [#5 Experiences](https://github.com/matteopolak/hth3/issues/5), [#6 Integrations](https://github.com/matteopolak/hth3/issues/6)      | [#24–#28](https://github.com/matteopolak/hth3/issues/24), [#34–#35](https://github.com/matteopolak/hth3/issues/34), [#37](https://github.com/matteopolak/hth3/issues/37), [#47](https://github.com/matteopolak/hth3/issues/47): feedback depth, taxonomy, themes, resident/staff agents with tool parity, and Workers AI. |
| D    | [Sponsor integrations](https://github.com/matteopolak/hth3/milestone/4)                     | [#6 Sponsor and AI integrations](https://github.com/matteopolak/hth3/issues/6)                                                                                                                          | [#36](https://github.com/matteopolak/hth3/issues/36), [#38–#41](https://github.com/matteopolak/hth3/issues/38): Tiger, ElevenLabs, Presage, Auth0 and no-charge Workers AI live acceptance.                                                                                                                               |
| E    | [Delivery and judging](https://github.com/matteopolak/hth3/milestone/5)                     | [#7 Quality and presentation](https://github.com/matteopolak/hth3/issues/7)                                                                                                                             | [#42–#46](https://github.com/matteopolak/hth3/issues/42): E2E, security audit, deployment, Remotion video and in-person/Devpost evidence.                                                                                                                                                                                 |

Milestones indicate the principal acceptance gate; cross-gate dependencies are authoritative. A feature can be coded with a fixture while its provider is unavailable, but its live-integration issue and prize claim remain open until real acceptance.

## How it works

### Stage 0: preflight

The orchestrator confirms credentials and provider access, the current `main` state, issue blockers, and the documentation requirements. Missing external credentials are recorded as blockers on the relevant integration issues, not concealed with a mock. The user's authorization starts implementation; the plan and tracker define the sequence.

### Stage 1: one sequential foundation agent

Assign **one Luna xhigh** agent [#8–#13](https://github.com/matteopolak/hth3/issues/8) in order. It owns the root workspace/CI, shared contracts/i18n, Worker platform, core role boundary, and minimal API-backed web and native SwiftUI iOS slices. After #12 passed local D1/role checks and CI, the user authorized parallel agents; the orchestrator released disjoint backend lanes #14, #20, and #24 while #13 finishes the client shells. UI/design lanes still wait for #13 acceptance. The orchestrator reviews its focused commits, runs `pnpm check`, verifies local D1 persistence and role denial, and separates that evidence from deployed Auth0/Tiger acceptance. When web/iOS contracts and extension points are stable, record the Gate A checkpoint in epic #1 and release the remaining queue.

### Stage 2: bounded parallel feature lanes

After Gate A, start with **four active feature agents** in disjoint paths. Once the first wave integrates cleanly, expand to at most **eight active feature agents** when blockers and exclusive file ownership permit. Use Luna `high` for bounded UI/adapters and `xhigh` for auth, sensitive data, agent tools, or cross-service state. A useful first wave is [source registry #14](https://github.com/matteopolak/hth3/issues/14), [applicant profile #20](https://github.com/matteopolak/hth3/issues/20), [feedback depth #24](https://github.com/matteopolak/hth3/issues/24), and [UI system #29](https://github.com/matteopolak/hth3/issues/29). These write disjoint paths. Subsequent issues enter a ready queue only when native GitHub blockers close; for example federal and BC/Ontario adapters can run concurrently after #14, while the public UI can use agreed contracts and fixtures until the API is available.

Assign one agent to one issue-sized feature or tightly related pair. The issue prompt must include: parent epic and blocker links, exact owned paths, contracts/API version, acceptance checks, corresponding documentation path, and whether a real-provider test is required. Do not give two active agents a shared file owner. The orchestrator owns integration wiring, shared contracts, root manifests, `PLAN.md`, `docs/README.md`, and cross-feature overview docs after the foundation gate. If a feature needs a shared contract changed, pause that dependent feature; the orchestrator lands the contract first, then resumes consumers.

| Lane              | Primary exclusive paths after Gate A                                                                                                              | Examples                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Sources/discovery | `packages/sources/**`, `apps/worker/src/features/sources/**`, `discovery/**`, `nearby/**`, `consultations/**`                                     | #14–#19                                       |
| Applications      | `packages/domain/src/profile/**`, `applications/**`, `program-intake/**`, matching Worker feature folders                                         | #20–#23                                       |
| Civic backend     | `packages/domain/src/feedback/**`, `themes/**`, `apps/worker/src/features/feedback/**`, `taxonomy/**`, `themes/**`, `civic-review/**`, `agent/**` | #24–#28                                       |
| Public web        | `apps/web/src/features/discovery/**`, `nearby/**`, `applications/**`, `feedback/**`                                                               | #30–#31                                       |
| Public iOS        | `apps/mobile/ios/CivicResolve/Features/Discovery/**`, `Nearby/**`, `Applications/**`, `Feedback/**`, `ResidentAssistant/**`                       | #32–#33, #47                                  |
| Staff web         | `apps/web/src/features/staff/**`, `employer/**`, `agent/**`                                                                                       | #34–#35                                       |
| Integrations      | Provider-specific paths named in #36–#41                                                                                                          | Tiger, Workers AI, ElevenLabs, Presage, Auth0 |
| Release/media     | `tests/**`, deployment/runbooks, `apps/remotion/**`, presentation docs                                                                            | #42–#46                                       |

The design-system agent owns only `packages/ui/**`, web styles, and SwiftUI theme in `apps/mobile/ios/CivicResolve/Design/**` as in #29; it does not rewrite feature screens while UI agents work. Provider agents own their integration folders, not the feature route that consumes them. An issue's explicit path list wins over this summary when narrower.

### Stage 3: integration and release waves

At the end of each small wave, the orchestrator reviews diffs, runs `pnpm check`, exercises one real cross-feature flow, updates blockers/epics, and records gaps. Important joins are: source record → search/detail → truthful application destination; applicant submission → employer queue → status; resident feedback → Workers AI/theme/Tiger → staff response → receipt; and web/mobile locale parity. Live provider checks are separate from fixture-backed tests. Only after those joins pass should #42–#46 close.

## Shared-main Git and issue protocol

- All agents use `main` in the shared checkout. No agent discards or resets another agent's work. Each agent inspects `git status` before editing, claims its issue and exact paths in the issue comments, and stages **only those paths**. Do not use `git add .` in a shared dirty tree.
- One writer at a time commits/pushes through an orchestrator-managed short Git lane. Agents may commit and push after a meaningful completed unit; they do not have to wait for an entire epic. A commit may include earlier shared-main commits, but must never include another agent's unstaged files. Avoid pull/rebase while another agent has uncommitted changes; the orchestrator coordinates remote divergence.
- Use a subject-only Conventional Commit: `type(scope): imperative summary`. No body, description, or co-author attribution. An issue closes only after its acceptance criteria, relevant docs and tests, and commit/deployed evidence are recorded. If a provider credential is missing, leave that issue open and explain the verified boundary.
- Concurrent agents create a **feature-specific** doc such as `docs/data/federal-jobs.md` or `docs/applications/resume-extraction.md`. They do not all edit `docs/README.md` or shared overview docs; the orchestrator updates those after a wave. Every doc covers what, how, how to change, configuration, and dependencies per the repository documentation rule.
- Never describe sample content, an external link click, a fixture model response, or a local-only smoke test as a live government/provider submission. Prize evidence requires the actual provider and API-backed user flow.
- Agents inspect every page or surface they change in the running product at desktop, narrow, and mobile widths. They also inspect French text lengths, empty/error/loading states, and role-specific views. They fix visible defects and report exact routes, widths/devices, and screenshots. Static checks alone do not satisfy visual acceptance.
- The resident and employee conversational agents each maintain a parity inventory against their audience’s website actions. Resident chat works for guests and offers a reviewed complaint draft when a service problem appears. Both agents use the same Worker commands and authorization as manual controls. Any write requires an editable preview and explicit confirmation.
- AI inference stays within verified no-charge allocation. Do not upgrade Cloudflare Workers or purchase credits. Workers Free stops at its daily limit; a Workers Paid account may bill overage, so check plan and usage before a live call and leave provider acceptance open if that cannot be established.

## How to change it

Add or split an issue when its path ownership or acceptance cannot be stated without overlapping active work. Keep the parent epic, milestone, blocked-by relationships and docs updated. If a cross-cutting requirement changes, first update `PLAN.md` and shared contracts, then revise affected issues before dispatch. Do not silently move a task between gates or close a provider issue based solely on static tests.

## Configuration

The agent model is limited to `gpt-6-luna` with `high` or `xhigh` reasoning. The initial active-agent cap is four after the sequential foundation gate; it can rise to eight after a clean integration wave with disjoint ownership. The orchestrator may use fewer when files or credentials are contested. Source and provider credentials are never embedded in issue bodies or agent prompts. CI's `pnpm check` is the local gate; deployment and real-service acceptance have separate evidence.

## Dependencies

GitHub Issues native sub-issues/blocking links, the five repository milestones, `PLAN.md`, `docs/README.md`, pnpm CI, and the shared `main` checkout. External provider access is required for the corresponding Gate D acceptance issues.
