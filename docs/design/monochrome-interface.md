# Monochrome web interface

## What it is

The public feedback and opportunities flows and the staff queues share a compact black-and-white web shell. A left rail on desktop becomes a horizontal navigation row on narrow screens. One breadcrumb-sized title identifies the active page.

## How it works

`apps/web/src/platform/main.ts` creates the shared shell and renders real API responses for guest feedback, applications, and staff queues. The resident assistant is the default page; the staff assistant lives inside the staff workspace. Both use the Worker's conversation API. Messages and tool results appear in a centered thread. Write tools return a proposal card showing the method, target, and input before the user approves or declines it. Creating feedback also requires a separate sandbox acknowledgement. The guest conversation token stays in tab-scoped storage and is sent only as an API header.

The feedback form previews the resident's words before submission, requires an explicit acknowledgement of the fictional Toronto sandbox, and keeps the private receipt in tab-scoped storage. The emergency action requests the Worker's `emergency: true` response, displays its 911 guidance, and never creates a report. The optional voice control requests a short-lived ElevenLabs session URL from the Worker. Finalized user utterances fill the editable message field; stopping voice or editing text does not submit anything. Staff queue data loads when a development identity changes and again when a queue tab is selected.

The neutral visual layer is in `apps/web/src/platform/styles.css`. It avoids nested decorative cards, large display headings, and color-coded status badges. The posting still has a concise practice label because no real employer receives applications. A persistent desktop rail scope label and explicit final confirmation explain the sandbox boundary; mobile keeps this context in the feedback information section and final confirmation.

## How to change it

Add navigation entries in `navigation()` and the matching page branch in `mainPage()`. Keep one title in `header()` and use small section headings only where a page has distinct subviews. Update both `packages/i18n/src/en.ts` and `fr.ts` for any new visible copy. If an API error code is introduced, map it in `formatError()` so it has a localized explanation. Add new assistant tools in the Worker; the generic proposal card will present their method, target, and JSON input. If a tool returns a private credential, extend `visibleToolResult()` to redact it and handle any session storage explicitly. Test the active route at desktop, 390 px, and 320 px; inspect long French labels and error/empty states.

The development identity selector is available only in Vite development builds. It is a local API role probe, not authentication. Replace it with the planned Auth0 sign-in flow before using the staff or applicant pages in production.

## Configuration

`VITE_API_BASE_URL` selects the Worker API base URL; the default is `http://localhost:8787/api/v1`. `civicresolve.locale` in `localStorage` selects English or French. The private receipt uses `sessionStorage` under `civicresolve.private-receipt.v1`; agent conversations use `civicresolve.chat.<mode>.<identity>.<locale>.v1`. Breakpoints are 850, 620, and 360 px in `styles.css`. Voice is optional and requires the Worker's ElevenLabs signing secret. No paid service is needed to render the shell or type feedback.

## Dependencies

The web app uses shared contracts, i18n messages, design typography tokens, and the Worker feedback, applications, staff, agent, voice-session, and emergency guidance endpoints. The emergency action needs the feedback endpoint to return a 422 response containing `emergencyRedirect` without creating a submission. `@elevenlabs/client` is loaded only after the user chooses voice.
