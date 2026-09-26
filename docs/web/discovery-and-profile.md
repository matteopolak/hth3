# Discovery and applicant profile on the web

## What it is

The resident web workspace has a source-backed discovery view for jobs, support, funding, nearby services, and participation, plus a private applicant profile and résumé workspace. The discovery view starts with reviewed records only; practice records require an explicit opt-in.

## How it works

`createDiscoveryPage({ area, locale, token })` renders an independently managed view. Areas are `all`, `jobs`, `support`, `funding`, `nearby`, `participation`, and `saved`. A keyword and city/location search calls `/api/v1/discovery` with `q`, `location`, freshness, and pagination filters. On wide screens, results and the selected record sit side by side; on a phone, choosing a result opens its detail with a return control. Result labels distinguish an official finder from a verified participating listing or a physical service location. A detail view shows publisher, freshness, review date, language, and terms links. The official action calls the handoff endpoint and opens the returned HTTPS publisher URL. Visitors finish any application or consultation on the publisher’s site; Envoy does not record that submission.

The Nearby area offers a list/map switch when records include verified coordinates. The map plots the source positions in a schematic coordinate view without a basemap or inferred distance. Search by city or location to narrow the alphabetical source directory; the client never represents the unfiltered directory as distance ranked. Service location rows show the source address without repeating the hours caveat, which remains on the detail.

Signed-in applicants can save a record and maintain up to 12 personal checklist steps. The view calls `/api/v1/discovery/saved` and passes `includeSamples=true` only after the person chooses to show practice records. Guest search works without a token; saving requires an applicant token.

The shell can pass `onPrepare(recordId)` to route a permitted `official_external` record to Envoy’s external preparation page. Jobs, support, and funding use a “Prepare application” action; service locations and consultations use visit/participation wording. The publisher handoff remains a separate action. Practice records and records without a permitted official handoff do not show this preparation action.

`createProfilePage({ locale, token })` loads the owner’s `/api/v1/profile`, résumé list, and applications. The form and document workspace appear in separate outlined sections on wide screens and stack on phones. Applicants can edit contact details, skills, education, and experience manually. The document area accepts a selected or dropped PDF/DOCX file; extraction shows literal suggestions alongside their source snippets. Choosing a suggestion changes the draft only. The applicant must save the profile. A separate action shares a selected résumé with a selected existing application through `PUT /api/v1/applications/{id}/resume`. Deleting a résumé also revokes its application links on the Worker.

## How to change it

The view factories and local state live in `apps/web/src/features/discovery/index.ts` and `apps/web/src/features/profile/index.ts`. Their CSS is scoped under `.discovery-*` and `.profile-*`; avoid adding a global card accent or oversized heading. The root shell imports the factories and chooses an area based on navigation. User-facing English and French strings are colocated in the modules. If the Worker response shape changes, update the local view types and the shared contract; if profile fields change, update `packages/domain/src/profile/index.ts` too.

The Worker owns permission and source trust checks. The client must keep sample records opt-in, must not fabricate live openings or deadlines, and must not treat an external handoff as a completed submission. Résumé extraction should continue to require a separate choice before updating the draft, and sharing should remain a separate explicit action.

## Configuration

`VITE_API_BASE_URL` selects the Worker API base URL and defaults to `http://localhost:8787/api/v1`. The factories receive the current `en` or `fr` locale and an applicant access token, or `null` for a guest. The Worker requires D1 discovery migration `0013_discovery.sql`, the profile migration `0004_profile.sql`, private `PRIVATE_ASSETS` R2, and Applicant role permissions. Upload size and storage limits are enforced by the Worker, with a 5 MB UI hint.

## Dependencies

The web views use browser `fetch`, `FormData`, and DOM APIs, the shared profile and locale contracts, the Worker discovery/profile/application routes, D1 source records, and private R2 résumé storage. No paid client service is needed to use these pages.
