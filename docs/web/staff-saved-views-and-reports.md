# Staff saved views and reports

## What it is

Employees with feedback read permission can save private queue filters and exact aggregate report definitions for their organization. Saved views reopen matching case IDs; reports calculate current counts when opened and link to recent source cases.

## How it works

`staff_saved_views` stores a name, 7/30/90-day window, optional status, and optional category ID. `GET /api/v1/staff/organizations/:orgId/workspace/views/:id/result` queries D1 for the exact match count and returns the 100 newest case IDs, statuses, and categories. The manual tab opens a case through the existing protected feedback detail callback. It does not expose report text in an aggregate response.

`staff_saved_reports` stores a name, window, and grouping (`status`, `category`, or `intent`). `GET .../reports/:id/result` computes exact D1 counts on demand. It returns up to 20 recent source IDs for manual drill-down, so the count remains exact even when the source preview is shorter. No AI inference or Tiger synchronization is involved in these saved report totals.

The collection and item routes are `GET/POST .../workspace/views` and `GET/PATCH/DELETE .../workspace/views/:id`, with matching `/reports` routes. Reads and writes require organization membership plus `feedback:read_organization`. Every saved item is scoped to the authenticated subject; one employee cannot open another employee's saved item by ID. Writes require a 16–128 character `Idempotency-Key`; item edits and deletion require the current `expectedVersion`, with `409 STALE_VERSION` on a race. The Worker logs metadata-only audit events for changes. The routes return `Cache-Control: no-store`.

## How to change it

The migration is `packages/db/migrations/0025_staff_workspace.sql`. Validation, D1 queries, and idempotent writes live in `apps/worker/src/features/staff-workspace/resources.ts`. Manual controls and result rendering live in `apps/web/src/features/staff/saved-workspace.ts`. Shared response shapes live in `packages/contracts/src/v1/staff-workspace.ts`. Keep the list limit separate from exact count and keep raw case text in the protected case-detail route.

## Configuration

Apply migration `0025_staff_workspace.sql` before deploying the Worker. No new environment variable or external service is required. The browser uses `VITE_API_BASE_URL` and the signed-in employee's bearer token.

## Dependencies

Cloudflare D1, Worker Auth0 membership and feedback permissions, the existing staff feedback detail route, shared v1 contracts, and the web staff workspace.
