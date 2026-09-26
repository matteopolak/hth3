# Native discovery and applications

## What it is

The SwiftUI app lets residents search source-backed jobs, public supports, funding, nearby services, and consultation entry points. Signed-in applicants can save a record with a private checklist. A separate applications tab handles participating employers' published postings, reviewed applicant answers, application status, and messages.

## How it works

`DiscoveryView` calls the Worker's `/api/v1/discovery` search and detail endpoints. Search supports area, text, province or territory, freshness, and pagination. The compact Explore screen keeps source records prominent: a location menu maps readable place names to API jurisdiction codes, while freshness and practice filters sit under Options. Practice records are excluded by default and disclosed on each record if explicitly included. The nearby map uses `MapKit` only when a source record has coordinates; it does not guess locations or request the device's location. Map mode fetches every matching page, while its visible list switch gives an accessible text alternative. Detail shows publisher, jurisdiction, source status, localized freshness, original source language, review date, evidence, and terms. Opening an official site first requests `/discovery/:id/handoff`, then shows a confirmation that the user must complete the action on the publisher's site. Envoy never records an external submission from this handoff.

Saved items use `/discovery/saved` and require an applicant access token. Checklist edits are persisted with `PUT /discovery/saved/:id` and remain private to the owner. The app allows at most 12 steps per item, matching the Worker limit.

`ApplicationsView` lists published first-party postings. An applicant opens one posting, edits relevant experience and availability, confirms the answers, then submits via `POST /applications`. Practice postings disclose their fictional employer at the decision point. Submitted applications show current status and an owner-scoped message thread through `/applications/:id/messages`. Résumé sharing remains a separate explicit action in the Profile tab.

## How to change it

Edit `Features/Discovery/DiscoveryView.swift` for search, detail, save, and handoff UI. Edit `Features/Nearby/NearbyMapView.swift` for map presentation, `Features/Applications/ApplicationsView.swift` for application review and messaging, and `Platform/WorkerAPI.swift` for endpoint contracts. Keep source provenance and handoff semantics when adding fields. Add translated labels in `Platform/AppCopy.swift`, and register new Swift files in `CivicResolve.xcodeproj/project.pbxproj`.

## Configuration

The Worker base URL comes from `CIVICRESOLVE_API_BASE_URL` in Xcode build settings. Debug points to local Wrangler; Release points to the production Worker. Auth0 bearer tokens are used only for saved items and applications. The public search needs no sign-in. The app does not need a geolocation permission because the map displays publisher-supplied coordinates.

For simulator visual QA, a Debug launch can use `-envoy-area nearby -envoy-map` to open the nearby map directly when simulator tapping is unavailable. The flags do not affect Release builds. The Debug API still points to local Wrangler; use live Worker data only through an explicit non-secret build setting override.

## Dependencies

SwiftUI, MapKit, the shared `CivicResolveModel` Auth0 session, and the Worker discovery, application, and employer message routes. Official records depend on the source registry and scheduled ingestion; a missing record is shown as an empty state rather than filled with fabricated content.
