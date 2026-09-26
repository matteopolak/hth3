# Staff settings

## What it is

Employees can choose which authorized tab opens when they sign in. Organization administrators can set the default window offered when staff create a saved view or report.

## How it works

`GET /api/v1/staff/organizations/:orgId/workspace/settings` returns the employee's default tab and the organization's reporting window. `PATCH` changes one field at a time: `{ "defaultView": "themes", "expectedVersion": 0 }` for a personal preference, or `{ "reportingWindowDays": 90, "expectedVersion": 0 }` for an organization setting. The Worker checks that the selected tab is available to the actor's role and reserves organization changes for `organization_admin` with its own organization scope. A missing row has version 0; a successful write advances it. The shell applies the personal tab on the next staff sign-in; new saved view/report forms use the organization's window.

The request requires an `Idempotency-Key`, and a stale version returns `409`. The response exposes both current versions so independent personal and organization edits do not conflict. Changes write metadata-only audit events and never place staff private data in the public source catalog.

## How to change it

The schema is in `0025_staff_workspace.sql`, authorization and persistence in `apps/worker/src/features/staff-workspace/settings.ts`, and the manual form in `apps/web/src/features/staff/settings.ts`. `apps/web/src/platform/main.ts` selects the default tab after loading the protected workspace summary. When adding another preference, show its effect in a real manual workflow and validate its role at the Worker boundary.

## Configuration

Apply the migration before deployment. The default reporting window is 30 days; choices are 7, 30, or 90 days. Auth0 organization membership and existing `DB` binding provide authorization and persistence. No new secret is needed.

## Dependencies

Cloudflare D1, Worker authentication and permission helpers, the staff workspace summary route, and shared v1 contracts.
