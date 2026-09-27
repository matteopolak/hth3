# Deployment

## What it is

Envoy is one Cloudflare Worker application. The Worker serves the built Vite site and handles its API at `/api/` on the same origin: `https://envoy.matteopolak.workers.dev/`. It was renamed in place from `civicresolve-api-production`, retaining its immutable Worker ID, deployed versions, bindings, and installed secrets.

## How it works

`pnpm deploy:production` builds `apps/web/dist`, then Wrangler uploads those assets with `apps/worker/src/platform/index.ts` as one Worker deployment. `[env.production]` sets the stable script name `envoy`. Its asset settings serve static files and fall back to `index.html` for SPA navigation. `/api` and `/api/*` run the Worker script first. The Vite build defaults to `/api/v1`, so browser requests stay on the same origin and need no separate API host. `pnpm dev -- --host` continues to run the Cloudflare Vite plugin with the Worker and local D1/R2 on port 5173 for LAN use.

Production bindings attach D1, private R2, Workers AI, Vectorize, and Hyperdrive to that Worker. The five-minute cron delivers feedback events and refreshes due official sources. The production CORS allowlist contains the Worker origin. The former `envoy-web` Pages project has been deleted after the combined Worker was verified.

## How to change it

Apply pending D1 migrations before deploying code that reads new tables: from `apps/worker`, run `./node_modules/.bin/wrangler d1 migrations apply civicresolve-prod --remote --env production`. Run `pnpm deploy:production` at the repo root. Check `/`, a deep SPA route such as `/callback`, `/api/healthz`, a representative `/api/v1/` read, and an asset URL on the Worker origin. Confirm the Auth0 SPA's callback, logout, and web-origin allowlists contain this Worker origin before using login there. Update the native iOS Release API URL to the same origin when publishing a new build.

Keep `VITE_API_BASE_URL` unset for a same-origin web build; set it only to intentionally target another API. If the Worker URL changes, update the Auth0 allowlists, native Release configuration, and `ALLOWED_ORIGINS`. Never place service secrets in a `VITE_` variable or the repository. Wrangler/Cloudflare deployment history provides rollback for the Worker.

For a live failure, check `./node_modules/.bin/wrangler tail --env production` from `apps/worker`. Narrow console output to one request with `--format json --search '<requestId>'`; the Worker records only the request ID and a static error classification, never request content or tokens. Compare the request time with D1 migration state and the active Worker deployment. Avoid printing private receipts, voice URLs, or uploaded evidence while troubleshooting. Restore a known good version through Cloudflare's Worker deployment history if a code rollback is needed; database migrations require a separate forward repair.

## Configuration

`apps/worker/wrangler.toml` defines the asset directory, SPA and API routing, public binding IDs, Auth0 audience/domain, cron, and CORS origins. `FEEDBACK_ABUSE_HMAC_KEY` and `ELEVENLABS_API_KEY` are existing Worker secrets. The web build uses the public `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, and `VITE_AUTH0_STAFF_ORGANIZATION_ID` settings, with defaults in `apps/web/src/platform/auth0.ts`. `pnpm-workspace.yaml` enforces a strict two-week minimum package release age.

## Dependencies

Cloudflare Workers Static Assets, D1, R2, Workers AI, Vectorize, and Hyperdrive host the web/API stack. Auth0 provides login; Tiger receives feedback outbox analytics through Hyperdrive. ElevenLabs voice and native Presage have separate acceptance requirements documented in their feature pages. Keep the Cloudflare plan and provider use within free or already available credits.
