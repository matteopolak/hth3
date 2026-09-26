# Security and data audit

## What it is

This document records the privacy, tenant isolation, source-rights, and failure-state checks for Envoy. It distinguishes route-level tests and public production reads from staff and provider-outage flows that still need live acceptance.

## How it works

The Worker checks Auth0 identity and the actor's current organization and role before staff handlers read D1. Owner actions require the applicant's subject; résumé shares are joined to the application and posting's organization before a private R2 object is read. Guest feedback receipts use a 64-hex-character secret whose hash is matched with the case ID, and attachment reads also match the case and organization. The agent tool catalog binds routes to the conversation mode and organization, but the underlying feature handler always checks access again.

Private R2 keys include purpose, organization, owner, record, and asset ID. `readPrivateAsset` rejects a mismatched grant before calling R2. Résumé downloads set `Cache-Control: no-store, private` and `X-Content-Type-Options: nosniff`; receipt tokens are not sent to the model or stored in conversation messages.

Public source records carry publisher, URL, jurisdiction, licence when known, terms state, verification time, freshness, and a sample label. A record is `verified` only when it is not a sample, terms are permitted, verification time is valid, and freshness is current. Discovery defaults to hiding samples. Official handoffs are external links and do not record an application or consultation contribution. An official URL alone does not grant reuse rights; curated link-only records may have no licence name because Envoy is not republishing their page bodies.

Discovery and participation render distinct empty, stale, and unavailable states. Consultation records with stale or errored source state use `check_official_source` rather than presenting an open deadline as certain. Staff analytics can fall back from unavailable Tiger history to current intake with a visible notice. Theme candidate UX reports disabled, capacity, and provider-unavailable states without moving memberships.

### Evidence collected on 2026-09-26

| Boundary                           | Focused evidence                                                                                                                                                                                                                                                                                                  | Limit                                                                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cross-tenant and role access       | `tests/security/security-boundaries.test.ts` calls posting, feedback, and shared-résumé Worker handlers with wrong organization or role; each returns 403 before D1 or R2. Guest profile returns 401.                                                                                                             | A live employee Auth0 session was unavailable, so production staff role and organization acceptance remains open.                                                                                            |
| Private feedback and files         | Security test rejects wrong owner/organization asset grants before R2. Existing `feedback.test.ts` wrong-receipt test passes and observes no R2 read.                                                                                                                                                             | Negative receipt and shared-résumé requests were not exercised with two real production accounts.                                                                                                            |
| Source rights and labels           | Security test confirms attribution and licence fields survive mapping, while stale, restricted, and sample records are unverified. Production `source-records?includeSamples=true` returned 106 records: 105 official and one explicitly labeled sample; all 105 official records had publisher and terms fields. | Forty official records had no licence name; registry mapping indicates 36 manually curated links and four `official_link` records. Retain link-only presentation and review rights before any content reuse. |
| Truthful empty and external states | Production discovery query for an intentionally absent term returned HTTP 200, `total: 0`, and an empty `items` array. Production consultations returned seven records with `externalParticipationOnly: true` and `inAppSubmissions: false`.                                                                      | Browser rendering of that exact empty query and a forced provider outage were not exercised live.                                                                                                            |

## How to change it

Keep authorization in the Worker handlers when adding a route; UI hiding or agent tool filtering is only an additional guard. For staff queries, include the authorized organization in SQL predicates, and test a cross-organization request before any database or R2 access. For files, preserve the purpose/owner/record/organization scope and private response headers. For new source adapters, record the publisher and reviewed terms, keep source and evidence URLs, and show a separate sample or stale state. Update `tests/security/` and this table when a boundary or live acceptance result changes.

## Configuration

Auth0 audience/domain, role permissions, organization membership, `APP_ENV`, D1, and `PRIVATE_ASSETS` control identity and private storage. `DEV_AUTH_ENABLED` is only for local development. Source ingestion uses reviewed terms and freshness fields; no environment switch turns an unknown source into a verified one. Optional Workers AI and Vectorize theme grounding needs the explicit no-charge gate described in [Grounded theme clustering](ai/grounded-themes.md).

## Dependencies

The Auth0 identity mapper, `@civicresolve/domain/permissions`, D1 organization and owner predicates, `@civicresolve/db/d1` private-asset scopes, R2, `@civicresolve/sources` provenance mapping, and the web discovery, participation, analytics, and theme views.
