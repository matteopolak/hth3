# Staff workspace

## What it is

The employee web workspace exposes the organization’s feedback overview, recurring themes, taxonomy, hiring postings, applicants, analytics, and an administrator activity log. Its monochrome dashboard emphasizes the next useful action, with compact record navigation and activity beside properties in detail views.

## How it works

`staffWorkspace` in `apps/web/src/features/staff/index.ts` mounts a selected view in the employee page. The shell first loads `GET /api/v1/staff/organizations/{id}/workspace`, which returns role-specific capabilities and up to 50 organization-scoped audit events. Navigation includes only allowed views and selects the first allowed manual view for that account. The module checks capabilities again before mounting a view. It receives the active staff token, organization ID, locale, and an optional callback for opening a source feedback submission. Each view loads its own Worker route. The Worker remains responsible for Auth0 scope, role, membership, and organization checks. The web client never treats the local identity selector as authorization.

The employee agent's starter cards use the same capability map. A reviewer sees applicant prompts; a civic staff member sees feedback prompts; a curator sees source and taxonomy prompts. The underlying agent tool still enforces its own permission. Taxonomy group tabs wrap on wide screens and scroll horizontally without a visible scrollbar on narrow screens.

The workspace response allows feedback read/respond, applicant review, posting management, taxonomy management, source management, and audit read independently. Taxonomy management follows the existing Worker rule: an organization admin can edit its own taxonomy, while a curator has global taxonomy access. Source management remains curator-only. Audit access requires organization administration or curator privileges. Audit rows contain only action, entity type, entity ID, and time; they never include a feedback body, applicant answer, actor subject, or event details. The endpoint returns `401` for guests, `403` for a different organization or a role without workspace access, and `Cache-Control: no-store`. Manual write controls expose a busy label and disabled state while awaiting the Worker; API `401` and `403` responses produce explicit permission messages.

The overview and themes screens use `/staff/organizations/{id}/themes` for exact D1 submission counts and persisted theme memberships. The dashboard pairs the current count and unanswered queue with a 30-day intake chart; it fills zero-count days without inventing activity. Opening a theme loads its linked original submissions. The taxonomy screen reads the published version and shows one group at a time through horizontal tabs. An administrator can create a draft, edit bilingual category names and descriptions, preview routing against typed feedback, then publish it. Advanced JSON editing covers the full document, including routes and new categories. Hiring staff create/edit/publish/close postings; reviewers inspect submitted answers, read and send application messages, change supported states, record shortlist/offer/decline decisions, and request a résumé only if the applicant explicitly shared one with that application. Posting and applicant collections keep the selected record alongside the list on desktop, then stack naturally on small screens. Analytics uses Tiger’s `/analytics` endpoint and shows synchronization time and pending events. If Tiger is unavailable, it shows the current D1 trend, category counts, and status counts from `/themes` and labels historical sync as unavailable.

Practice records are labeled at the individual record or grouped theme, since the current organization is fictional. This label is derived from server `sample` fields. The UI does not claim the organization represents a real municipality or employer.

Applicant subjects are account identifiers, not verified names. The list and properties use a short account label, with the full subject in the properties tooltip for staff who need the original identifier.

## How to change it

The route client and response shapes live in `apps/web/src/features/staff/client.ts` and `packages/contracts/src/v1/staff-workspace.ts`; individual screens live beside them. The protected endpoint lives in `apps/worker/src/features/staff-workspace/index.ts`. `staff.css` owns only `.staff-*` selectors so the platform shell can change independently. Add a new view to `StaffWorkspaceView`, dispatch it from `staffWorkspace`, add the permission mapping in `viewAllowed`, then wire its capability-filtered sidebar entry in `apps/web/src/platform/main.ts`. When adding a manual write action, add a matching employee agent tool in the Worker so the two staff interfaces retain tool parity. Application status transitions in the client mirror the Worker’s state machine; update both when changing that workflow.

Theme source buttons need the platform’s `onOpenFeedback(id)` callback to open the protected feedback detail. The Worker’s direct API links require a bearer token and should not be opened as public links. Posting and applicant details load on selection. A detached view can finish a request harmlessly after navigation; it cannot update another page.

The separate `staffFeedbackOperations` export mounts routing and lifecycle controls in the staff feedback detail sidebar. It loads active departments and assignable organization members from `/feedback/assignment-options`, saves a department with an optional assignee, and exposes request-details and record-outcome forms while the case is in review. The caller passes the case’s current `assignment` from the detail response and an `onChanged` callback that refreshes the case and queue. The Worker validates membership, state transitions, and idempotency keys. If a new feedback action is added, update this module and the platform case detail together.

The routing selector displays the Worker’s localized `displayLabel` for each staff member. The opaque Auth0 subject is retained only as the option value sent to the Worker. `staffRequest` can send `Accept-Language` for endpoints with localized response fields. Posting saves, posting transitions, and applicant decisions reopen the same record after refreshing the collection.

## Configuration

- `VITE_API_BASE_URL` points the browser at the Worker v1 API. It defaults to `http://localhost:8787/api/v1`.
- The caller supplies an active bearer token, organization ID, and `en` or `fr` locale. The local development identities, including platform curator for taxonomy/source review, work only under the Worker’s development authentication switch.
- The workspace endpoint uses existing `APP_ENV`, `DEV_AUTH_ENABLED`, Auth0 domain/audience, D1 membership, and audit-event configuration; it adds no new secret or binding.
- Apply the taxonomy, theme, employer, application, profile, and analytics database migrations before using those views. Tiger analytics also needs the Worker’s `HYPERDRIVE` binding; the other screens run from D1.

## Dependencies

The workspace uses the v1 Worker routes for themes, taxonomy, employer postings, applications, explicitly shared résumés, and Tiger analytics. It depends on Cloudflare D1, optional Tiger Data via Hyperdrive, Worker authentication and organization permissions, and the shared application status contract.
