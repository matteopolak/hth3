# Envoy web interface

## What it is

The web app uses one monochrome shell for resident discovery, feedback, applications, profile management, agent chat, and staff work. The desktop rail becomes a drawer on narrow screens. Page names appear in a small breadcrumb; chat starts with a centered prompt and composer.

## How it works

`apps/web/src/platform/main.ts` owns the rail, breadcrumb, resident and employee chat, feedback receipt, and staff case detail. The rail exposes only connected routes. Resident Explore mounts `apps/web/src/features/discovery/`; Profile mounts `apps/web/src/features/profile/`. Staff workspace views mount `apps/web/src/features/staff/`. Staff Inbox loads the real feedback queue and opens a case through the Worker's detail route.

The chat composer sends to the Worker's conversation API. Its plugin picker lists tools returned by that conversation, so the resident and employee see their own authorized tools. Read tools with no arguments run directly; other tools fill an editable request for the assistant. Write actions still show a proposal card and require approval. Creating feedback also requires explicit acknowledgement that the destination is a fictional Toronto sandbox. The sidebar omits that disclosure because the relevant submission step and record show it. Recent authenticated conversations come from the Worker; guest conversation IDs and bearer tokens remain in tab-scoped storage. The area picker currently selects Toronto and includes that context in the sent message.

The Files tray uses the actual résumé upload endpoint for signed-in users. The microphone requests a signed ElevenLabs voice session and inserts finalized user utterances into the editable text field; nothing sends automatically. The model label names the Worker's configured `@cf/ibm-granite/granite-4.0-h-micro` model. The private feedback receipt and staff case detail show real activity and properties. Reply and status controls call existing Worker routes. Evidence filenames are displayed as metadata because protected downloads require an authenticated request.

## How to change it

Update `navigation()` and `mainPage()` together when adding a route, and keep the destination backed by a working API or module. Update both `packages/i18n/src/en.ts` and `fr.ts` for visible text. New chat tools belong in the Worker tool registry; the UI reads its list at conversation creation. Add a zero-argument read tool to `DIRECT_READ_TOOLS` only if it can be invoked without arguments. Keep the approval preview for writes. Case properties come from `FeedbackClientReceipt`; add fields in the Worker and API type before showing them here. The shell CSS is in `apps/web/src/platform/styles.css`; feature modules own scoped CSS.

Use real Auth0 tokens before the development identity fallback. The fallback selector appears only in Vite development builds. A guest may use resident chat and submit feedback without signing in; staff pages require an employee token and organization role. Keep the final sandbox acknowledgement when changing submission copy or flow.

## Configuration

`VITE_API_BASE_URL` selects the Worker API base URL; local default is `http://localhost:8787/api/v1`. The Auth0 SPA client, audience, domain, and staff organization are configured in `apps/web/src/platform/auth0.ts` with `VITE_AUTH0_*` overrides. Locale persists in `localStorage` as `civicresolve.locale`. Private receipts and guest chats use `sessionStorage`. `pnpm-workspace.yaml` enforces a 14-day minimum release age for dependencies. The rail switches to a drawer at 620 px; case properties stack at 760 px.

## Dependencies

The shell uses shared contracts, i18n, design tokens, Lucide static SVGs, and the Worker feedback, application, staff, discovery, profile, agent, voice, and emergency endpoints. Auth0 SPA handles sign-in. ElevenLabs browser code loads only after the microphone is chosen. The emergency action asks the Worker for `emergency: true` guidance and does not create a report.
