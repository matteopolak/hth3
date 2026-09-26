# Documentation

This repository contains the product plan and the shared workspace/CI foundation. Feature documents identify the parts that are implemented locally and distinguish them from planned behavior and live provider acceptance.

| Document                                                                     | Description                                                                                                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Project plan](../PLAN.md)                                                   | Canada-wide bilingual web/mobile product scope, source provenance, native applications, civic feedback, architecture, challenge coverage, and delivery gates. |
| [Deployment](deployment.md) | Pages and Worker URLs, production configuration, migrations, monitoring, and rollback. |
| [Presentation run](presentation.md) | Honest live demo sequence and fallback paths. |
| [Submission checklist](submission-checklist.md) | Required challenge evidence, links, roster, and final submission checks. |
| [Video storyboard](video-storyboard.md) | Five-minute sequence using actual product captures and verified provider results. |
| [Source catalog and coverage](source-catalog.md)                             | Official starting sources, collection boundaries, freshness, and sample-data labeling.                                                                        |
| [Source registry and provenance](data/source-registry.md)                    | D1 source metadata, honest sample visibility, terms review state, and public registry API.                                                                    |
| [Official source ingestion](data/official-ingestion.md)                      | Federal finder links and Service BC locations, scheduled collection, provenance, and coverage limits.                                                         |
| [Discovery search and handoff](discovery/search-and-handoff.md) | Source-backed search, official handoff, saved items, and private checklists. |
| [In-app applications](applications.md)                                       | Applicant review, native versus external submission, employer scope, and résumé privacy.                                                                      |
| [Employer workspace](applications/employer-workspace.md) | Posting lifecycle, applicant messages, and organization-scoped decisions. |
| [External application preparation](applications/external-preparation.md) | Reusable answers, checklist, export, and truthful official handoff. |
| [Program intake](applications/program-intake.md) | Sponsor publishing, applicant submissions, messages, and decisions for Envoy-native programs. |
| [Applicant profile and résumé extraction](applications/resume-extraction.md) | Owner-scoped profile, private résumé storage, extraction provenance, and retention.                                                                           |
| [Experience principles](experience-principles.md)                            | Distinct task-focused web/mobile patterns, bilingual UI, and accessibility guardrails.                                                                        |
| [Web shell](web-shell.md)                                                    | API-backed bilingual guest, applicant, and staff starter flows and local configuration.                                                                       |
| [Web sign-in](auth/web-sign-in.md) | Auth0 Universal Login, guest mode, applicant tokens, and staff organization selection. |
| [Web discovery and profile](web/discovery-and-profile.md) | Source-backed opportunity browsing, private applicant profile, and résumé controls. |
| [Staff workspace](web/staff-workspace.md) | Feedback operations, source-linked themes, taxonomy, hiring, applicants, and analytics. |
| [Native iOS shell](native-mobile.md)                                         | SwiftUI feedback/applications, Auth0 sign-in, private profiles/résumés, and build configuration.                                                                         |
| [Native discovery and applications](native-discovery.md) | SwiftUI source search, nearby map/list, saved checklists, official handoff, and application review. |
| [Native resident assistant](native-assistant.md) | Guest and signed-in SwiftUI conversations, role tools, approval cards, and private receipts. |
| [Native Presage accessibility](native-presage.md) | Consented breathing check and optional calmer feedback layout in SwiftUI. |
| [Monochrome interface](design/monochrome-interface.md)                       | Envoy's compact black-and-white layout, conversation shell, responsive rules, and copy decisions.                                                             |
| [Resident and employee conversations](agents/conversations.md)               | Persistent Workers AI conversations, role-scoped tools, write previews, and guest access.                                                                     |
| [Agent capability inventory](agents/capability-inventory.md) | Resident and employee tool parity with manual website actions and remaining gaps. |
| [Taxonomy and classification](feedback/taxonomy.md)                          | Versioned bilingual taxonomy, staff edits, and feedback classification flow.                                                                                  |
| [Feedback themes and overview](feedback/themes.md) | Exact staff counts, persisted themes, and source-linked summaries. |
| [Grounded theme clustering](ai/grounded-themes.md) | Optional Workers AI embeddings, Vectorize candidates, evidence summaries, and deterministic fallback. |
| [Tiger analytics](analytics/tiger-data.md)                                   | Outbox delivery and organization-scoped feedback trends via Tiger Data.                                                                                       |
| [ElevenLabs voice intake](voice/elevenlabs-intake.md)                        | Private agent session signing, transcript review, limits, and configuration.                                                                                  |
| [Orchestration and work breakdown](orchestration.md)                         | Shared-worktree agent schedule, file ownership, issue hierarchy, Git coordination, and acceptance gates.                                                         |
| [Workspace and CI](workspace-and-ci.md)                                      | pnpm workspace, strict package-age policy, TypeScript defaults, local checks, and CI gate.                                                                    |
| [Shared contracts and locales](shared-contracts-and-locales.md)              | Versioned API requests/events, English/French messages, interpolation, and design tokens.                                                                     |
| [Worker platform](worker-platform.md)                                        | D1 schema, private R2 scopes, idempotent outbox, local smoke harness, and configuration.                                                                      |
| [Auth0 and organization authorization](authorization.md)                     | JWT verification, API scopes, role mapping, D1 membership, organization isolation, and local identity smoke.                                                  |
| [Guest civic feedback](guest-feedback.md)                                    | Guest receipt-token boundary, staff responses, state transitions, sample labeling, and local evidence.                                                        |
