# Deployment

## What it is

Envoy's web client is hosted on Cloudflare Pages at `https://envoy-web.pages.dev`. The API runs on the existing Workers Free deployment at `https://civicresolve-api-production.matteopolak.workers.dev`; the internal Worker name is retained for continuity.

## How it works

Build the static Vite client with `VITE_API_BASE_URL=https://civicresolve-api-production.matteopolak.workers.dev/api/v1` and deploy `apps/web/dist` to the `envoy-web` Pages project. The production Worker allows only the Pages origin through `ALLOWED_ORIGINS`. Auth0's public SPA client allows that origin and `/callback` for Universal Login; the staff organization remains an explicitly unaffiliated practice workspace. Guest conversations and feedback do not require Auth0.

The Worker uses production D1, private R2, Workers AI, and Hyperdrive. Its five-minute cron delivers the feedback outbox and refreshes due official sources. The product exposes source provenance and sample state; a practice record never represents a real municipal or employer submission. Pages, Worker, D1, and Workers AI should remain on no-charge allocations. Do not enable a paid plan or provider overage to work around a quota failure.

## How to change it

Update `apps/worker/wrangler.toml` when the public Pages origin changes. Update the Auth0 SPA callback, logout, and web-origin allowlists to the same HTTPS host. Set `VITE_API_BASE_URL` for each web build; never bake secrets into Vite variables. Apply D1 migrations with `wrangler d1 migrations apply civicresolve-prod --remote --env production` before deploying Worker code that reads new tables. Deploy the Worker with `wrangler deploy --env production`, and Pages with `wrangler pages deploy apps/web/dist --project-name envoy-web --branch main`.

Keep the previous Cloudflare Worker version and Pages deployment available for rollback through their dashboards or Wrangler deployment tooling. Check `wrangler tail --env production` and D1 source/outbox state when a live route fails. Do not treat a local development principal as evidence of a real Auth0 role token.

## Configuration

`apps/worker/wrangler.toml` holds public binding IDs, Auth0 domain/audience, cron, and allowed origin. `FEEDBACK_ABUSE_HMAC_KEY` is a Worker secret. The web build uses public `VITE_API_BASE_URL`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, and `VITE_AUTH0_STAFF_ORGANIZATION_ID`. The exact Auth0 SPA and organization setup is in [Web sign-in](auth/web-sign-in.md). `pnpm-workspace.yaml` enforces a strict two-week minimum package release age.

## Dependencies

Cloudflare Pages, Workers, D1, R2, Workers AI, and Hyperdrive host the web/API stack. Auth0 provides login; Tiger receives feedback outbox analytics when connected. ElevenLabs voice and native Presage have separate acceptance requirements documented in their feature pages.
