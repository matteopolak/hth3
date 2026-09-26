# Staff workspace

## What it is

The employee web workspace exposes the organization’s feedback overview, recurring themes, taxonomy, hiring postings, applicants, and analytics. It uses a compact two-column detail layout for applicant and posting records, with status and other properties beside the main activity.

## How it works

`staffWorkspace` in `apps/web/src/features/staff/index.ts` mounts one of six views in an existing employee page. It receives the active staff token, organization ID, locale, and an optional callback for opening a source feedback submission. Each view loads its own Worker route. The Worker remains responsible for Auth0 scope, role, membership, and organization checks. The web client never treats the local identity selector as authorization.

The overview and themes screens use `/staff/organizations/{id}/themes` for exact D1 submission counts and persisted theme memberships. Opening a theme loads its linked original submissions. The taxonomy screen reads the published version and, for an administrator, creates a draft, edits bilingual category names and descriptions, previews routing against a typed complaint, then publishes it. Advanced JSON editing covers the full taxonomy document, including routes and new categories. Hiring staff create/edit/publish/close postings; reviewers inspect submitted answers, read and send application messages, change supported states, record shortlist/offer/decline decisions, and request a résumé only if the applicant explicitly shared one with that application. Analytics uses Tiger’s `/analytics` endpoint and shows synchronization time and pending events. If Tiger is unavailable, it shows current D1 counts from `/themes` and labels the historical analytics as disconnected.

Practice records are labeled at the individual record or grouped theme, since the current organization is fictional. This label is derived from server `sample` fields. The UI does not claim the organization represents a real municipality or employer.

## How to change it

The route client and response shapes live in `apps/web/src/features/staff/client.ts`; individual screens live beside it. `staff.css` owns only `.staff-*` selectors so the platform shell can change independently. Add a new view to `StaffWorkspaceView` and dispatch it from `staffWorkspace`, then wire its sidebar entry in `apps/web/src/platform/main.ts`. When adding a manual write action, add a matching employee agent tool in the Worker so the two staff interfaces retain tool parity. Application status transitions in the client mirror the Worker’s state machine; update both when changing that workflow.

Theme source buttons need the platform’s `onOpenFeedback(id)` callback to open the protected feedback detail. The Worker’s direct API links require a bearer token and should not be opened as public links. Posting and applicant details load on selection. A detached view can finish a request harmlessly after navigation; it cannot update another page.

## Configuration

- `VITE_API_BASE_URL` points the browser at the Worker v1 API. It defaults to `http://localhost:8787/api/v1`.
- The caller supplies an active bearer token, organization ID, and `en` or `fr` locale. The local development identities work only under the Worker’s development authentication switch.
- Apply the taxonomy, theme, employer, application, profile, and analytics database migrations before using those views. Tiger analytics also needs the Worker’s `HYPERDRIVE` binding; the other screens run from D1.

## Dependencies

The workspace uses the v1 Worker routes for themes, taxonomy, employer postings, applications, explicitly shared résumés, and Tiger analytics. It depends on Cloudflare D1, optional Tiger Data via Hyperdrive, Worker authentication and organization permissions, and the shared application status contract.
