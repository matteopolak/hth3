# Web page routing

## What it is

The Envoy web app gives each major resident and employee page a direct URL. Browser back and forward navigation restores the matching page without discarding chat or draft state.

## How it works

`apps/web/src/platform/router.ts` uses headless `@tanstack/router-core` with browser history. Its route tree recognizes public pages, discovery areas, program and application views, external preparation records, and staff workspace sections. `main.ts` applies the first URL before rendering. Every later render syncs programmatic page changes to history; the history listener applies back, forward, and direct navigation to the same app state.

Representative paths are `/`, `/feedback`, `/applications/mine`, `/explore/jobs`, `/explore/participation`, `/programs/sponsor`, `/external/{recordId}`, `/staff/agent`, `/staff/themes`, and `/staff/issues/{caseId}`. Unknown app paths show a localized not-found page. Record IDs are URL encoded. The feedback receipt secret remains in tab storage and is never encoded in a route.

Auth0 keeps `/callback` reserved. A plain sign-in can return to its original page, while an explicit sign-in action such as staff, résumé, or applications follows that intent. `/api/*` remains Worker traffic. Both production and local Wrangler configurations serve unknown page paths with the SPA fallback and send `/api/*` to the Worker first.

## How to change it

Add a route to `routePaths`, then update both `routeState()` and `routePath()` in `router.ts`. Add the page to `AppState` and render it in `main.ts`. Keep URL state limited to shareable page context; private receipt tokens, résumé data, and draft contents stay out of URLs. A new protected route still needs server-side authorization in its Worker endpoint.

When adding a nested staff or discovery view, update the corresponding union and sidebar action. Test direct load, an in-app transition, and browser back. Check both Vite dev and the built Worker asset fallback if deployment configuration changes.

TanStack history can notify subscribers before its queued `window.history.pushState` runs. The listener must parse the history event's location, and render-time synchronization must compare with `router.history.location`; reading `window.location` during that notification can restore the previous page under the new URL.

## Configuration

The package is pinned as `@tanstack/router-core@1.170.0` in `apps/web/package.json` under the workspace's strict `minimumReleaseAge: 20160` pnpm policy. `apps/worker/wrangler.dev.toml` and `apps/worker/wrangler.toml` use `not_found_handling = "single-page-application"` and `run_worker_first = ["/api", "/api/*"]`. Auth0's redirect URI remains `/callback`.

## Dependencies

TanStack Router Core, browser History API, Vite, Cloudflare Vite plugin, Worker static assets, and the existing Auth0 web client.
