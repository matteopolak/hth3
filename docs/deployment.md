# Deployment

## What it is

Envoy is one Cloudflare Worker application. The Worker serves the built Vite site and handles its API at `/api/` on the same origin: `https://envoy.surf/`. The existing `envoy.matteopolak.workers.dev` URL remains available as a fallback. The Worker was renamed in place from `civicresolve-api-production`, retaining its immutable ID, deployed versions, bindings, and installed secrets.

## How it works

`pnpm deploy:production` builds `apps/web/dist`, then Wrangler uploads those assets with `apps/worker/src/platform/index.ts` as one Worker deployment. `[env.production]` sets the stable script name `envoy`, and `[[env.production.routes]]` attaches the `envoy.surf` apex as a custom domain on that same Worker. Cloudflare manages its DNS and TLS certificate. Static assets fall back to `index.html` for SPA navigation; `/api` and `/api/*` run the Worker script first. The Vite build defaults to `/api/v1`, so browser requests stay on the same origin and need no separate API host. `pnpm dev -- --host` continues to run the Cloudflare Vite plugin with the Worker and local D1/R2 on port 5173 for LAN use.

Production bindings attach D1, private R2, Workers AI, Vectorize, and Hyperdrive to that Worker. The five-minute cron delivers feedback events and refreshes due official sources. The production CORS allowlist contains the apex and workers.dev fallback origins. The former `envoy-web` Pages project has been deleted after the combined Worker was verified.

## Live verification

On 2026-09-27 UTC, Wrangler reported production Worker version `378cf242-42cf-48f6-8f67-ba1a97408317` at 100% traffic. `GET /`, `/callback`, `/api/healthz`, `/api/v1/sources`, and `/api/v1/nearby?limit=1` returned HTTP 200. A same-origin `/api/v1/sources` preflight returned 204 with the Envoy origin. Remote D1 reported no pending migrations. The iOS Release API setting points at the same Worker; this is configuration evidence, not a physical-device run.

Cloudflare reported `envoy.surf` as an active zone and a custom domain attached to the existing `envoy` Worker. Deployment `ee282f85-cce7-4b42-9bf0-c49cedbe8c6a` kept the D1/R2/AI/Vectorize/Hyperdrive bindings and five-minute cron. HTTPS `GET /`, `/profile`, `/explore/jobs`, `/api/healthz`, and `/api/v1/sources` returned HTTP 200 on the apex. A feedback preflight from `https://envoy.surf` returned 204 with the matching CORS origin. These checks establish DNS, TLS, SPA deep-link, and API routing on the new host; they do not establish a signed-in Auth0 or voice flow.

The subsequent web build deployed as Worker version `49ae17f8-e1a9-4b69-afae-9802457d924f`. On that version, the apex returned HTTP 200 for `/`, `/profile`, `/favicon.svg`, and `/api/healthz`; the favicon had SVG content type, and feedback preflight still returned 204 with the apex origin. Public DNS resolved to Cloudflare nameservers `raquel.ns.cloudflare.com` and `reese.ns.cloudflare.com`.

The private R2 guest evidence upload and token-protected download passed with a 68-byte synthetic image, as recorded in [Guest civic feedback](guest-feedback.md). A read-only Tiger query reported 15 `feedback_events` rows, with the latest event at `2026-09-27 00:16:06 UTC`. A deployed Workers AI classification of a fictional report is recorded in [Taxonomy and classification](feedback/taxonomy.md). Both existing Worker secret names were present; their values were not read.

Provider acceptance remains incomplete. The Auth0 verifier rejects a deliberately invalid signature, but an authorized staff token with allowed and denied organization actions has not passed live review. ElevenLabs issued a signed session and handled a fictional spoken exchange, while no post-call webhook is registered and browser-to-feedback submission remains unverified. Presage compiled and launched in the simulator; no consented physical-iPhone reading is available. Jev was explicitly deferred in favor of a no-charge Workers AI model. See [Web sign-in](auth/web-sign-in.md), [ElevenLabs voice intake](voice/elevenlabs-intake.md), and [Native Presage accessibility](native-presage.md).

## How to change it

Apply pending D1 migrations before deploying code that reads new tables: from `apps/worker`, run `./node_modules/.bin/wrangler d1 migrations apply civicresolve-prod --remote --env production`. Run `pnpm deploy:production` at the repo root. Check `/`, a deep SPA route such as `/profile`, `/api/healthz`, a representative `/api/v1/` read, and an asset URL on `https://envoy.surf`. Confirm the Auth0 SPA's callback, logout, and web-origin allowlists contain the apex before using login there. Update the native iOS Release API URL to the apex when publishing a new build.

Keep `VITE_API_BASE_URL` unset for a same-origin web build; set it only to intentionally target another API. If the Worker URL changes, update the Auth0 allowlists, native Release configuration, and `ALLOWED_ORIGINS`. Never place service secrets in a `VITE_` variable or the repository. Wrangler/Cloudflare deployment history provides rollback for the Worker.

For a live failure, check `./node_modules/.bin/wrangler tail --env production` from `apps/worker`. Narrow console output to one request with `--format json --search '<requestId>'`; the Worker records only the request ID and fixed error metadata, never request content or tokens. Auth0 JWKS failures include only `source` (`network` or `http`) and an HTTP status when present. Compare the request time with D1 migration state and the active Worker deployment. Avoid printing private receipts, voice URLs, or uploaded evidence while troubleshooting. Restore a known good version through Cloudflare's Worker deployment history if a code rollback is needed; database migrations require a separate forward repair.

## Configuration

`apps/worker/wrangler.toml` defines the custom-domain route, asset directory, SPA and API routing, public binding IDs, Auth0 audience/domain, cron, and CORS origins. `FEEDBACK_ABUSE_HMAC_KEY` and `ELEVENLABS_API_KEY` are existing Worker secrets. The web build uses the public `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, and `VITE_AUTH0_STAFF_ORGANIZATION_ID` settings, with defaults in `apps/web/src/platform/auth0.ts`. `pnpm-workspace.yaml` enforces a strict two-week minimum package release age.

## Dependencies

Cloudflare Workers Static Assets, D1, R2, Workers AI, Vectorize, and Hyperdrive host the web/API stack. Auth0 provides login; Tiger receives feedback outbox analytics through Hyperdrive. ElevenLabs voice and native Presage have separate acceptance requirements documented in their feature pages. Keep the Cloudflare plan and provider use within free or already available credits.
