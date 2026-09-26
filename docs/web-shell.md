# Web shell

## What it is

`apps/web` is Envoy's English/French resident, applicant, and staff interface. Guest discovery, chat, and practice feedback work without sign-in; protected applicant and employee actions use Auth0.

## How it works

Vite serves the web app and runs the Worker at `/api/*` through the Cloudflare Vite plugin during local development. Production serves both from one Worker origin. The app keeps the outer shell and navigation stable while changing pages. Auth0 handles applicant or employee sign-in through a dedicated page; protected sidebar items are disabled until an eligible session exists. The Worker checks each token, role, organization, and permission independently of the UI.

Resident feedback is previewed before submission. The person must acknowledge the destination and explicitly confirm. A private receipt token is sent in `X-Receipt-Token` and kept in tab `sessionStorage`; it is not placed in the URL. The receipt view retrieves current status and messages from the API. Applicant forms likewise require review and explicit confirmation before a native application. Official external links remain handoffs to their publisher.

The assistant uses guest or employee tool sets according to the server-side identity. The web client renders typed tool results and approval cards; a displayed suggestion does not itself authorize a write. API errors, loading, empty results, and permission denials remain visible instead of inventing successful data. Writes use idempotency keys where the API requires them.

## How to change it

Edit `apps/web/src/platform/main.ts` for routing and shell composition, `api.ts` for HTTP calls, and the relevant `src/features/` module for a feature's UI. Shared text belongs in both locale catalogues. Shared layout rules live in `styles.css` and feature stylesheets; keep the outer padding and scroll gutter stable across routes. If an API shape changes, update the shared contract and Worker first, then adapt the client and visually check desktop and narrow mobile widths.

Authentication lifecycle is in `auth0.ts`; see [Web sign-in](auth/web-sign-in.md). Preserve its in-memory token cache and keep development identities out of production.

## Configuration

| Setting                       | Purpose                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`           | API base; defaults to `/api/v1` for the combined Vite/Worker and production origins. |
| `VITE_AUTH0_*`                | Public SPA and organization values documented in [Web sign-in](auth/web-sign-in.md). |
| `APP_ENV`, `DEV_AUTH_ENABLED` | Worker-only development identity gate; never enables production test identities.     |
| `civicresolve.locale`         | Browser language selection in `localStorage`.                                        |

Run `pnpm dev -- --host` from the repository root. It applies local D1 migrations, starts Vite on port 5173, and exposes the Worker locally through `@cloudflare/vite-plugin`. The Vite config derives LAN origins for CORS; Auth0 callback allowlists still need the exact LAN host if its address changes. `pnpm deploy:production` builds the web assets and deploys the combined Worker.

## Dependencies

Vite, `@cloudflare/vite-plugin`, `@auth0/auth0-spa-js`, the shared contracts/i18n/design packages, browser Web Crypto, and the Worker APIs backed by D1 and optional provider integrations.
