# Public web applications and programs

## What it is

The public web application view connects people to participating employer postings and official job finders. A separate Programs view shows participating grant or benefit intake beside official support and funding sources. Each action preserves its destination: a participating organization's application can be submitted in Envoy, while an external source leads to preparation and the publisher's site.

## How it works

`createPublicApplicationsPage` in `apps/web/src/features/applications/` renders `browse` and `mine` views. It loads participating postings from `/postings` and source-backed official job finders from `/discovery?area=jobs`. The latter list accepts only `official_external` records with HTTPS source URLs; it cannot relabel a participating or practice record as an official finder. The entire result row selects the detail. Search and location filters apply to both types. An official finder offers the external preparation route and an outbound publisher link; it never enters the submitted-application list.

For a participating posting, an applicant signs in, writes experience and availability, optionally uploads/selects a private résumé, reviews a source-linked extraction suggestion, and checks the application preview before submission. The `POST /applications` request includes `confirmedByApplicant: true` and an idempotency key. A practice posting requires an additional visible acknowledgment in the web review. Résumé sharing is a distinct consent after the application is created; a share failure leaves the successfully submitted application visible and recoverable through the profile screen. The `mine` view reads the applicant's own applications and private message thread, and can send a reply or share a résumé later.

`createPublicProgramsPage` in `apps/web/src/features/programs/` wraps the participating program intake and adds a tab for official support/funding finders. The official tab filters `/discovery` by `support` or `funding`, shows publisher and freshness, and opens the external preparation route or source site. The intake itself remains in `features/program-intake/`; it requires applicant confirmation and a practice acknowledgment when the sponsor is the practice organization.

## How to change it

Update the local English/French copy and CSS in the relevant feature folder when changing a public step. Keep full-row buttons for results, and preserve the full-width stacked layout at mobile widths. If a new submission field or status is introduced, update the Worker contract and applicant message/status view together. Do not turn official finder records into individual open vacancies, awards, or submitted applications.

The shared route shell mounts these factories and supplies sign-in, profile, and external-preparation callbacks. The feature folders do not own the global sidebar or authentication state.

## Configuration

The API host is `VITE_API_BASE_URL`, defaulting to `http://localhost:8787/api/v1`. Applicant actions use the Auth0 access token supplied by the shell. The local development identity is available only when Worker development auth is enabled. The production sample posting and program are practice records; they do not imply a government vacancy or benefit.

## Dependencies

The shared web API client, Cloudflare Worker/D1 and private R2 résumé endpoints, Auth0, official discovery records, and the existing external preparation and participating program intake modules.
