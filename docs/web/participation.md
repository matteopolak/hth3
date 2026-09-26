# Participation page

## What it is

The public Participation page presents real, reviewed government consultations and official participation directories. Dated opportunities appear before directories, and every action goes to the publisher's site.

## How it works

`createParticipationPage` loads `GET /api/v1/consultations` without sign-in. The page groups each dated record by the API's `participationStatus`: open, status to verify, or deadline passed. A jurisdiction filter narrows the visible results to Canada, British Columbia, or Ontario. Directories have no deadline and appear in a separate grid. The official link opens in a new tab; Envoy does not record or submit a contribution.

The Worker determines status from the reviewed source state and date-only deadline. The web page displays that status rather than guessing whether a consultation remains open. It also shows the last source-check date.

## How to change it

Update `apps/web/src/features/participation/index.ts` for grouping, copy, and interactions; update its adjacent `styles.css` for layout. Source metadata and deadlines belong in the D1 consultation seed or a later migration, never in frontend copy. Preserve the distinction between an individually dated consultation and an official directory. Keep links external until a participating organization has authorized an Envoy submission workflow.

## Configuration

`VITE_API_BASE_URL` selects the Worker API prefix and defaults to same-origin `/api/v1` for local Cloudflare Vite development. No authentication, feature flag, or client-side source list is required.

## Dependencies

The page uses the Worker consultations API, `@civicresolve/contracts` for locale, and Lucide SVG icons. Its records depend on the reviewed official publisher pages documented in [Official participation sources](../data/participation-sources.md).
