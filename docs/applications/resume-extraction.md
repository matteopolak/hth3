# Applicant profile and resume extraction

## What it is

The applicant profile stores editable, private career information and supports a manual entry path. Applicants can upload a PDF or DOCX résumé, review deterministic field suggestions with source spans, and explicitly share one résumé with one of their applications.

## How it works

`GET` and `PUT /api/v1/profile` read or replace the signed-in applicant's profile. Supported fields are name, email, phone, location, summary, skills, education, and experience. Unknown fields are rejected so this API does not collect protected traits or silently accept data the product does not use.

`POST /api/v1/profile/resumes` accepts a multipart `file` up to 5 MB. The Worker checks the extension, declared content type, and file signature, then stores the bytes in the private R2 bucket and metadata in D1. `GET /api/v1/profile/resumes` lists the applicant's files and their expiry date. The owner can download a file or delete it; deleting the profile also deletes the applicant's résumé objects and database references.

`POST /api/v1/profile/resumes/{id}/extract` reads PDF text operators or the DOCX main document XML using built-in Web APIs. It returns text-backed suggestions for explicitly labeled contact fields and content under summary, education, experience, or skills headings. Each suggestion has a character range and exact source text. The applicant can retrieve the last result from `GET /api/v1/profile/resumes/{id}/extraction`, review a suggestion, and save any chosen value through the ordinary profile update path. If there are more than 256 suggestions, the response sets `suggestionsTruncated` so the applicant knows to use the manual path for anything missing. The extractor never scores, ranks, infers eligibility, or adds a qualification. Image-only PDFs, PDF character maps and non-ASCII PDF encodings outside the supported cases, and unsupported document structures return an unreadable-document response; there is no OCR fallback.

Résumés remain private until the applicant links one to their own application with `PUT /api/v1/applications/{applicationId}/resume` and `{ "resumeId": "…" }`. Hiring staff can read that specific shared résumé only through the matching organization-scoped application route. The Worker checks the applicant owner, the posting's organization, the staff role and permission, and the résumé retention deadline before reading from R2. Removing the résumé revokes all links.

## How to change it

Keep manual profile fields and validation in `packages/domain/src/profile/index.ts`; keep PDF/DOCX text extraction in `packages/domain/src/profile/document-text.ts`. PDF support covers FlateDecode streams and basic `Tj`, `TJ`, single-quote, and double-quote text-show operators with ASCII literal/hex strings or BOM-marked UTF-16 hex strings. Encrypted PDFs, Type 0 fonts, `/ToUnicode` maps, encoding differences, and symbol fonts are rejected because this lightweight parser does not resolve their font maps. DOCX support covers the ZIP main document XML part with stored or deflated content. The parser accepts 5 MiB uploads, bounds decompressed document parts at 1.5 MB, and returns at most 250 KB of normalized text and 256 suggestions. The extraction response marks a capped suggestion list with `suggestionsTruncated`. Suggestions must remain literal, reviewable values whose `source.start` and `source.end` slice the returned extraction text. Add meaningful parser fixtures for each supported format and keep malformed, encrypted, oversized, scanned, and unsupported documents on a clear error path.

Profile routes and the share boundary live in `apps/worker/src/features/profile/index.ts`. If adding staff access, require an explicit applicant-to-application share and check the target organization through the application and posting records. Any new profile fields, response shapes, owner actions, or API permissions must be updated in the shared v1 contracts, domain authorization matrix, clients, and `docs/README.md` index.

## Configuration

- `PRIVATE_ASSETS` is the private R2 binding used for résumé bytes. It must not be configured as a public bucket or served through a public custom domain.
- `DB` is the D1 binding. Migration `0004_profile.sql` adds profile, résumé retention, extraction, and per-application share records.
- The accepted upload ceiling is 5 MiB, with at most 10 active résumés per applicant. Extraction bounds decompressed document parts at 1.5 MB, normalized extracted text at 250 KB, and suggestions at 256. The retention period is 365 days from upload. Expiry is checked on every read/share path and expired objects are purged on applicant profile/resume access; a scheduled global sweep is not wired yet, so an applicant who never returns can leave expired bytes in R2 until access cleanup or an operations sweep.
- Applicant profile read/write routes require the dedicated `profile:read_own` or `profile:write_own` owner action and its Auth0 permission. Staff reads require the organization-scoped application read action.

## Dependencies

The feature uses Cloudflare Workers request/form-data and Web Streams APIs, `DecompressionStream`, D1, private R2, `@civicresolve/domain/profile`, shared authorization, and the existing application/posting tables. It has no parser package or AI service dependency. Local document fixtures validate deterministic parsing only; live Auth0 and deployed R2 access still require separate acceptance.
