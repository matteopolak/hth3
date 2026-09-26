# Web shell

## What it is

`apps/web` is the bilingual, API-backed web shell for guest feedback, sample employer applications, and employee review queues. It is an early functional shell: employee/applicant login is represented by fixed development identities only while Vite runs in development; Auth0 sign-in is tracked separately.

## How it works

Vite serves one small TypeScript application. The feedback flow previews the resident's original words and optional improvement note, then requires an explicit acknowledgement that the destination is a fictional Toronto sandbox. A fresh 32-byte token from `crypto.getRandomValues` is sent only in `X-Receipt-Token`; receipt credentials are stored in `sessionStorage` for the current browser tab. Applications require an identity at submit time and explicit applicant confirmation. The employee page calls the same Worker staff queue and status endpoints as the future staff workspace.

API errors are rendered from known error codes in the shared EN/FR catalogue. Unknown failures, network errors, loading, empty queues, and role-denied responses remain visible; the client never fabricates successful data. All write requests use new idempotency keys.

## How to change it

Keep HTTP paths and request/response shapes in `src/platform/api.ts`; page state and rendering are in `src/platform/main.ts`; responsive styling is in `src/platform/styles.css`. Add user-facing copy to both shared locale catalogues and preserve key parity. If a Worker contract changes, update its shared contract and server first, then adapt this API client and verify the real local round trip.

The local identity selector is guarded by `import.meta.env.DEV`. Do not move it into a production bundle or replace it with caller-controlled role claims. Real Auth0 session handling belongs in the dedicated authentication work.

## Configuration

| Setting | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8787/api/v1` | Base URL for the Worker API; set it in the local shell environment when using another Worker host. |
| `civicresolve.locale` | `en` | Browser language choice, stored in `localStorage`; users can switch between English and French in the header. |

Run `pnpm --filter @civicresolve/web dev` for the web client. For local-only role controls, the Worker must run with `APP_ENV=development` and `DEV_AUTH_ENABLED=true`; those fixed tokens are rejected in production.

## Dependencies

Vite and TypeScript, shared `@civicresolve/contracts`, `@civicresolve/i18n`, and `@civicresolve/design-tokens` packages, and the Worker feedback/application APIs. No client-side database or mocked success adapter is used.
