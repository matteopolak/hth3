# CivicResolve

CivicResolve is a civic issue reporting prototype. A resident can submit a report, receive a case number and private status token, and track its status. Staff can review a queue and move cases through the resolution workflow. The current local build uses a deterministic fixture classifier and Cloudflare D1 for demo storage.

## Run locally

Requires Node 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm --filter @civicresolve/worker db:local
pnpm dev
```

Open `http://localhost:5173`. The Worker runs at `http://localhost:8787`. Local development uses `wrangler.demo.jsonc` without remote AI and starts with `DEMO_MODE=true`; the staff workspace uses a labeled demo owner role. Production deployment uses `wrangler.jsonc` and does not enable that role header.

Run `pnpm check` before committing. `pnpm --filter @civicresolve/worker build` creates a Worker dry run; it does not deploy.

## Auth0 configuration

Set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` for the web app. Configure `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` as Worker secrets or variables. The API validates an RS256 Auth0 access token against tenant JWKS, issuer, audience, and expiry. Auth0 API permissions `cases:review`, `cases:manage`, and `taxonomy:publish` map to reviewer, department admin, and organization owner roles. Department admins also need the `https://civicresolve.org/department` access-token claim. Taxonomy publication requires a recent token carrying MFA authentication method and `auth_time` within five minutes. Tenant Actions must place these claims in the access token for that route to work.

## Current scope

The working local slice covers resident submission, a deterministic classification decision, human review for uncertain reports, status tracking, an admin queue, lifecycle transitions, taxonomy drafting/simulation/publication, and an append-only case event log. The 600-case scenario and value calculator are synthetic fixtures and must not be presented as observed CGI outcomes.

Jev and Workers AI classification adapters are implemented with schema and taxonomy validation; they have mock tests but have not been exercised with live service credentials. Set `JEV_API_KEY` as a Worker secret to enable Jev. The Worker has an `AI` binding for Workers AI fallback. Live mode rejects case creation if neither provider is available. A signed ElevenLabs post-call webhook handler is implemented and documented in [the voice setup guide](docs/VOICE_AGENT.md), but an agent and public webhook are not configured. Live Tiger, Vectorize, R2, mobile, Remotion, and Presage paths are not implemented yet. The Tiger SQL migration is a starting artifact and has not been run against a Tiger service. The repository does not include the six official CGI CSV files, so no claims are made from that pack.

Production setup also requires a real D1 binding ID, a defined web origin, Auth0 tenant configuration, and additional review of department scope, data retention, rate limiting, and anonymous case token handling. Do not deploy the prototype as a public government service in its current state.
