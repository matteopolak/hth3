# Guest browser smoke

## What it is

`tests/e2e/guest-smoke.pw.ts` is a short English/French browser check for Envoy's public web journeys. It runs four cases in a separate headless installed Chrome session and creates no feedback or application records.

## How it works

Each language checks a direct Jobs route, in-app navigation and browser back, a labeled practice posting, and an official source handoff. The handoff API response comes from the local Worker; the external HTTPS page is intercepted so the test only verifies the destination URL. A second case checks Nearby list/map switching, feedback review with a mocked duplicate-check response, and the disabled send action until the user confirms recurrence and destination. It edits the report again instead of submitting. Keyboard checks open and close chat search, then repeat focus return and horizontal-overflow checks at a 390-pixel viewport.

The duplicate response is deliberately mocked to exercise a stable review state without seeding private reports. Other data reads use the running local Worker and its source fixtures. Passing these checks shows the tested guest paths work locally; it does not establish live Auth0, staff, résumé submission, agent approval, real duplicate detection, screen-reader, or physical-device acceptance for issue #42.

## Production guest follow-up

On September 26, 2026, an isolated headless Chrome session opened the live Envoy Worker at `https://envoy.matteopolak.workers.dev`. Assistant, Jobs, Feedback, and Nearby returned HTTP 200 in English at 1280 pixels and French at 390 pixels. Both languages showed 25 job results, 78 Nearby results, the Nearby map and list, a usable chat composer, and the feedback editor. Visual inspection found no document overflow or page exceptions at either width. This checks rendering and basic navigation, not an AI reply or submission.

A live English job handoff returned HTTP 200 and opened an HTTPS posting at `bcpublicservice.hua.hrsmart.com`. English and French feedback review requests initially received HTTP 200 from duplicate checking without creating a report. Repeated probes in the same short interval later received HTTP 429, so no further feedback requests were made and the production review screen was not asserted. Local browser tests still cover the review state with an intercepted duplicate response.

Native Discovery had already passed simulator build and visual checks for its map/list flow under issue #32. This production follow-up does not cover a physical device. Authenticated applicant, employer, civic staff and admin journeys, real résumé-assisted apply, feedback receipt and staff response, agent approval, comprehensive screen-reader checks, and live native interaction remain unverified for issue #42.

## How to change it

Keep assertions on user-visible labels and stable semantic controls. If a route or label changes, update both entries in the test's `copy` table. If the handoff API changes, preserve the assertion that the popup URL equals the Worker response and uses HTTPS. Do not add a real feedback send to this smoke; use a dedicated isolated test with cleanup for that stateful flow.

Run `pnpm test:e2e:guest` from the repository root. The runner reuses a local app at port 5173 or starts `pnpm dev -- --host`. It serializes the four cases to keep local Worker load low. The ordinary `pnpm test` unit command does not run this browser suite.

## Configuration

`ENVOY_E2E_BASE_URL` points the suite at an already running app and disables its local web-server startup. The default is `http://127.0.0.1:5173`. The runner uses the installed Google Chrome channel in headless mode; it does not download a browser. `@playwright/test@1.52.0` is pinned under pnpm's strict two-week `minimumReleaseAge: 20160` policy.

## Dependencies

Playwright Test, installed Google Chrome, Vite, the local Cloudflare Worker, and seeded public source records. The duplicate-review case uses Playwright request interception rather than a stored report.
