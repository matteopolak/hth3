# Web sign-in

## What it is

The Envoy web app uses Auth0 Universal Login for applicant and employee sessions. Guest feedback and resident chat remain available without an account. The access token stays in the Auth0 SPA SDK's in-memory cache and the current page state; it is never written to `localStorage`.

## How it works

`apps/web/src/platform/auth0.ts` owns the SPA SDK client and exposes `webAuth.initialize()`, `subscribe()`, `snapshot()`, `login()`, `logout()`, and `getAccessToken()`. On startup it processes an Auth0 `/callback` response or checks for an existing Auth0 session. Applicant login requests the Worker API audience without an organization. Employee login includes the configured Auth0 organization ID. The SDK uses authorization code with PKCE; the Worker verifies the resulting RS256 access token, role claim, API grants, and D1 membership on each protected request. A client-side employee mode never grants staff access by itself.

The callback returns to `/` after the SDK consumes `code` and `state`. The app can use `snapshot().accessToken` for an immediate API request and `getAccessToken()` before later calls to renew an expired token. If silent renewal fails, the session changes to an error state and the user can sign in again. Logging out clears local session state and redirects through Auth0 logout.

## How to change it

Update the `webAuth` module if the SDK lifecycle changes; keep UI controls in `apps/web/src/platform/main.ts` and API resource calls in `api.ts`. Add a new staff organization only after its Auth0 organization, D1 organization row, and membership records agree. Keep the SDK cache in memory. When moving the web app to a new origin, add that origin's exact `/callback`, web origin, and logout URL to the Auth0 SPA application's allowed callbacks, web origins, and logout URLs respectively.

The hosted Universal Login theme is in `docs/auth/universal-login-theme.json`. Change that file, then use `auth0 api patch branding/themes/koQyvDM37rCzjRXszvJysFeosnfecvzP --data @docs/auth/universal-login-theme.json` from the repository root. The tenant branding and staff organization colors are separate settings; update both when changing the palette. The theme hides Auth0's generated letter badge with `widget.logo_position: "none"`.

## Configuration

See `apps/web/.env.example`. Vite reads the following build-time public values:

| Variable                           | Purpose                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `VITE_AUTH0_CLIENT_ID`             | Public SPA client ID; defaults to the existing Envoy web application.               |
| `VITE_AUTH0_DOMAIN`                | Auth0 issuer host; defaults to the current development tenant.                      |
| `VITE_AUTH0_AUDIENCE`              | Worker API audience; defaults to `https://civicresolve.example/api`.                |
| `VITE_AUTH0_STAFF_ORGANIZATION_ID` | Auth0 organization for employee login; defaults to the seeded sandbox organization. |
| `VITE_API_BASE_URL`                | Worker HTTP base URL used by the API client.                                        |

The SPA allowlists contain `http://localhost:5173/callback` and `https://envoy-web.pages.dev/callback` as callbacks; `http://localhost:5173` and `https://envoy-web.pages.dev` are both allowed logout returns and web origins. The Pages project belongs to the authorized matteopolak Cloudflare account. No client secret belongs in Vite variables or the repository.

The hosted Auth0 SPA display name and tenant `friendly_name` are both `envoy`, so Universal Login does not show the tenant slug. The existing staff organization retains its stable Auth0 ID and slug; its login display name is `Envoy Staff Workspace`. Tenant branding and staff organization branding both use primary `#111111` and page background `#FAFAFA`; the default theme controls the remaining widget colors, borders, and logo visibility. These settings are in Auth0, so changing the product name or palette again requires an Auth0 CLI update as well as repository copy edits.

The `google-oauth2` connection uses Auth0 development keys, so it is disabled only for the Envoy web SPA through `PATCH /api/v2/connections/con_oUpclMf5drva1SKc/clients` with `{ "client_id": "pZ0Uiv6Vgo47xte582Yx5YUzwjvVt1tK", "status": false }`. Auth0's dedicated connection-client endpoint is used because the older `enabled_clients` connection field is deprecated. The `Username-Password-Authentication` connection remains enabled for this SPA; Google remains enabled for the other tenant clients. To restore Google later, supply production Google OAuth credentials first, then change this status to `true`. No login path has yet completed an end-to-end Worker token acceptance check.

## Dependencies

`@auth0/auth0-spa-js`, the configured Auth0 SPA application and organization, the Worker Auth0 JWT verifier and D1 membership table, and browser Web Crypto/redirect support.
