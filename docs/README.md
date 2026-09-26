# Documentation

This repository contains the product plan and the shared workspace/CI foundation. Feature documents identify the parts that are implemented locally and distinguish them from planned behavior and live provider acceptance.

| Document                                                        | Description                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Project plan](../PLAN.md)                                      | Canada-wide bilingual web/mobile product scope, source provenance, native applications, civic feedback, architecture, challenge coverage, and delivery gates. |
| [Source catalog and coverage](source-catalog.md)                | Official starting sources, collection boundaries, freshness, and sample-data labeling.                                                                        |
| [In-app applications](applications.md)                          | Applicant review, native versus external submission, employer scope, and résumé privacy.                                                                      |
| [Experience principles](experience-principles.md)               | Distinct task-focused web/mobile patterns, bilingual UI, and accessibility guardrails.                                                                        |
| [Orchestration and work breakdown](orchestration.md)            | Luna-only subagent schedule, file ownership, issue hierarchy, Git coordination, and acceptance gates.                                                         |
| [Workspace and CI](workspace-and-ci.md)                         | pnpm workspace, strict package-age policy, TypeScript defaults, local checks, and CI gate.                                                                    |
| [Shared contracts and locales](shared-contracts-and-locales.md) | Versioned API requests/events, English/French messages, interpolation, and design tokens.                                                                     |
| [Worker platform](worker-platform.md)                           | D1 schema, private R2 scopes, idempotent outbox, local smoke harness, and configuration.                                                                      |
| [Auth0 and organization authorization](authorization.md)        | JWT verification, API scopes, role mapping, D1 membership, organization isolation, and local identity smoke.                                                  |
