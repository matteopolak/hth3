# CivicResolve implementation status

This is the handoff for work completed against [PLAN.md](../PLAN.md) through September 26, 2026. The plan describes the intended product; this document records what the repository actually contains. The build is a local prototype and several planned live integrations and submission artifacts remain outstanding.

## Delivered

| Area                       | Implemented behavior                                                                                                                                                                                | Evidence or limit                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Resident intake            | Web form creates a D1 case, returns a case number and private status token, and supports status lookup.                                                                                             | Local browser flow exercised.                                                                                             |
| Classification and routing | Published taxonomy versions, bounded category/department decisions, deterministic demo classifier, confidence-based human review, Jev adapter, and Workers AI adapter with validation and fallback. | Unit tests cover adapters and domain decisions. Jev and Workers AI have not been exercised with live credentials.         |
| Staff operations           | Case queue and detail, department-scoped review and lifecycle transitions, append-only case events, taxonomy drafts, simulation, and publication.                                                   | Local browser flows exercised.                                                                                            |
| Identity                   | Auth0 web SDK wiring and Worker verification of access-token signature, issuer, audience, expiry, permissions, department claim, and recent MFA for taxonomy publication.                           | No Auth0 tenant has been configured for a live login test. Local demo mode provides a labeled demo owner role.            |
| Voice intake               | Signed ElevenLabs post-call webhook validates collected fields, stores transcript, creates a case, and deduplicates by conversation ID.                                                             | Local signed webhook smoke test passed; no live agent or public webhook is configured. See [voice setup](VOICE_AGENT.md). |
| Analytics and value case   | Reproducible 600-case synthetic scenario, Saturday surge, scenario dashboard, and assumption-based cost sensitivity.                                                                                | These are fixtures, not observed CGI outcomes. See [value case](CGI-VALUE-CASE.md).                                       |
| Infrastructure             | Cloudflare Worker API, four D1 migrations, React/Vite web app, workspace packages, and CI check workflow.                                                                                           | Worker build is a dry run. No production deployment is recorded.                                                          |

## Local verification

The last implementation run passed `pnpm check` (Prettier, TypeScript, unit tests, and production builds). Browser smoke checks covered resident submission and tracking, staff queue and case detail, taxonomy publication followed by classification using the new version, and the synthetic analytics page. A signed local voice webhook created one case; a replay returned the same case, an invalid signature returned HTTP 401, and protected admin detail exposed its transcript. These checks demonstrate the local paths only. GitHub Actions runs `pnpm check` on pushes and pull requests.

## Run and configuration

Use the [README](../README.md) for local startup. `pnpm --filter @civicresolve/worker db:local` applies the four D1 migrations to local storage, and `pnpm dev` starts the web app and Worker. `wrangler.demo.jsonc` starts the deterministic demo without remote AI. `wrangler.jsonc` is the production configuration template; its D1 ID is a placeholder.

For a live deployment, configure a real D1 binding and web origin, the Auth0 web variables and Worker secrets described in the README, and provider credentials as needed. `JEV_API_KEY` enables Jev classification; the `AI` binding enables Workers AI fallback. Live mode rejects case creation when neither is available. `ELEVENLABS_WEBHOOK_SECRET` and `ELEVENLABS_AGENT_ID` are required for the voice webhook. Keep all secrets outside the repository.

## Outstanding plan work

- Configure and verify live Auth0, Jev, Workers AI, and ElevenLabs services and a public Worker deployment. The signed webhook exists, but the conversational agent and dynamic follow-up path are not yet live.
- Connect the dashboard to Tiger Data. `packages/db/migrations/0001_tiger.sql` is an unrun starting migration; analytics currently comes from synthetic fixtures.
- Obtain and reconcile all six official CGI CSVs, incorporate the official Saturday update, replace assumptions with measured baseline data, and finalize the value case and pitch.
- Build the planned Remotion demo and mobile experience. Vectorize retrieval, admin agent tools, and Presage accessibility mode are also outstanding.
- Before public service use, review department scope, retention, rate limiting, anonymous status-token handling, and operational controls.

The implementation commits are `e189e13` (core workflow), `5773706` (AI and audit), `8a84f85` (voice), and `3a99b2e` (analytics). Read the commit history for the exact code diff in each increment.
