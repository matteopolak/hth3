# Auth0 and organization authorization

## What it is

The Worker verifies Auth0 access tokens and applies an action-specific permission, active organization, and persisted D1 membership check before staff actions. Applicant access is tied to the authenticated subject; an applicant does not need membership in the employer's Auth0 organization.

## How it works

Requests send `Authorization: Bearer <access-token>`. The Worker accepts only RS256 JWTs signed by the configured Auth0 issuer. It fetches signing keys from the issuer's JWKS endpoint, caches them according to the response cache policy, and validates the signature, exact issuer, API audience, expiry, not-before time, and optional issued-at time.

Auth0 RBAC supplies the `permissions` array (the standard `scope` string is also parsed as a fallback) and the Post-Login Action supplies `https://civicresolve.example/roles`. Role names are matched exactly:

| Auth0 role claim value            | D1 role              | Worker actions                                                                                        |
| --------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- |
| `CivicResolve Applicant`          | `applicant`          | Create, submit, and read applications and manage the profile and résumés owned by the token's `sub`.  |
| `CivicResolve Civic Reviewer`     | `civic_staff`        | Read and respond to feedback in the active organization.                                              |
| `CivicResolve Hiring Reviewer`    | `hiring_reviewer`    | Read and review applications in the active organization.                                              |
| `CivicResolve Organization Admin` | `organization_admin` | Manage postings, organization settings, hiring review, and civic feedback in the active organization. |
| `CivicResolve Platform Curator`   | `curator`            | Manage source registry, taxonomy, and organizations through global curator actions.                   |

Each action also requires its Auth0 API permission: `read:applications`, `write:applications`, `submit:applications`, `read:profile`, `write:profile`, `review:applications`, `manage:postings`, `read:feedback`, `respond:feedback`, `manage:taxonomy`, `manage:sources`, or `manage:organizations`. The role-to-action matrix and token grant are both checked. Civic reviewers may read/respond to feedback but cannot read the hiring application queue. Hiring reviewers may read/update applications but cannot access civic feedback. Organization admins can perform both within their active organization.

For organization staff, the token must contain standard `org_id`. The Worker joins it to `organizations.auth0_org_id` and intersects the token's allowlisted roles with `organization_memberships` for the same subject and organization. Organization-scoped actions require the resulting D1 organization ID to equal the target resource's organization ID. A token role claim alone never creates membership. For applicants, `sub` identifies the owner and `application:*_own` and `profile:*_own` permissions do not require `org_id` or employer membership. Guest feedback stays unauthenticated and uses the separate receipt-token boundary.

## How to change it

When Auth0 display names or role assignments change, update the explicit mapping in `packages/domain/src/permissions/index.ts` and the identity tests. When an API action changes, add it to the domain action matrix and map it to the exact API permission; then use the organization or owner authorization helper at the Worker route. Keep membership checks in `apps/worker/src/auth/identity.ts` even when Auth0 organizations emit `org_id`.

The local authorization smoke seeds only local D1 state from `apps/worker/scripts/local-authz-seed.sql`. It uses fixed `dev-*` bearer values, never accepts a caller-selected subject or role, and is enabled only for `APP_ENV=development` plus `DEV_AUTH_ENABLED=true`. Feature smoke assertions also exercise allowed sandbox staff reads, cross-tenant/cross-role denials, applicant owner reads without employer membership, civic denial from application records, and employer review. Wrangler sets the flag false by default and in the production environment. The production check rejects local identities even if a deployment mistakenly sets the flag true while `APP_ENV=production`.

## Configuration

- `AUTH0_DOMAIN`: the Auth0 issuer host, without a secret. Current development tenant: `dev-ole6i03kzvf3yb8z.us.auth0.com`.
- `AUTH0_AUDIENCE`: the API audience `https://civicresolve.example/api`.
- `https://civicresolve.example/roles`: namespaced role array added by the tenant's Post-Login Action for the CivicResolve clients.
- `permissions` (or standard `scope`): exact API grants configured with Auth0 RBAC.
- `APP_ENV`: `development` or `production`; production disables the local test identities.
- `DEV_AUTH_ENABLED`: local smoke override only. Keep false in checked-in Wrangler vars and production.
- Auth0 client IDs, callbacks, API scopes, Action, organization, and role membership are provisioned in the Auth0 tenant; credentials are not stored in this repository. Web callbacks include `http://localhost:5173/callback`, the current LAN dev origin, and `https://civicresolve-api-production.matteopolak.workers.dev/callback`; native callback is `civicresolve://auth/callback`.
- The staff sandbox uses Auth0 organization `org_43G1B1RhPwac7EjS` and a matching production D1 `organizations.id` and `auth0_org_id`. A sandbox staff member also needs a matching `organization_memberships` row with the intended D1 role. The workspace is unaffiliated with a government account.

## Live acceptance status

The production D1 sandbox membership and its organization admin Auth0 role were checked on September 26, 2026. The tenant's post-login Action and API permissions were also checked. A real staff access token and one allowed plus one denied Worker request have not yet been verified: Auth0's organization-scoped Universal Login requests the existing test member's credentials, which were not available to the automated run. A separate temporary QA identity was created for a further attempt, but the CLI device grant for organization membership expired before approval; that identity was deleted before receiving any Auth0 organization or D1 membership, and its temporary credentials were removed. Keep the live-auth issue open until real tokens complete the applicant, hiring, civic, and admin checks, including permitted and denied actions.

## Dependencies

The boundary depends on the Web Crypto API and `fetch` in Cloudflare Workers, the Auth0 issuer/JWKS and access-token claims, the D1 organization/membership tables, `@civicresolve/domain/permissions`, and the fixed local Wrangler configuration. Local smoke identities demonstrate the D1 and policy boundary; they are not live Auth0 acceptance evidence.
