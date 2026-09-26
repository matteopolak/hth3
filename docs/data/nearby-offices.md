# Nearby public services

## What it is

Nearby lists source-backed places where a person can seek an in-person public service. It includes government counters, libraries, community services, and transit customer service points. The list shows every matching reviewed record; the map draws only places with verified public access, service details, an address, and publisher coordinates.

## How it works

`GET /api/v1/nearby` uses the same source records and search filters as public discovery. `q`, `location`, `jurisdiction`, `source`, `status`, `freshness`, `language`, `limit`, `offset`, and `includeSamples=true` have the same meanings. `area=nearby` is fixed by the route. `category` selects `government`, `library`, `community`, `transit`, or `other`. A federal directory handoff can appear in the list without a pin.

Each item adds a `service` object with `category`, `address`, `publicAccess`, `services`, `hours`, `accessibility`, `pinEligible`, and `pinKind`. The four fact fields carry `status`, `summary`, `verifiedAt`, and `sourceUrl`. `unknown` means the source did not support a claim. `stale` means a previously reviewed claim passed its review window. Neither means the site is closed or inaccessible. The UI uses the returned `items` for both list and map, filtering map pins with `service.pinEligible`; it never issues a separate unfiltered map search. A practice pin, if ever backed by the same evidence, must display `pinKind: "sample"` visibly.

`service_location_metadata` stores facts reviewed from official pages. Pin eligibility requires a source-backed address, an HTTPS source and evidence URL, current public access and service facts, and valid publisher coordinates. An official record also needs the source registry's current verified state. Unknown opening hours or accessibility do not become positive claims; both remain visible with an official link. The [Service BC office layer](https://catalogue.data.gov.bc.ca/dataset/service-bc-office-locations) provides 65 names, addresses, and coordinates. The [Service BC public counter page](https://www2.gov.bc.ca/gov/content/governments/organizational-structure/ministries-organizations/ministries/citizens-services/servicebc) establishes generic public counter access while warning that services differ by office. The fallback expires seven days after its manual review; it never asserts an office-specific service, hour, or accessibility feature.

The manually curated Ontario and Alberta records link to publisher pages. [ServiceOntario St. Joseph](https://www.ontario.ca/locations/serviceontario/st-joseph-ottawa) publishes its own services, hours, and accessibility features. [Alberta Supports](https://www.alberta.ca/find-an-alberta-supports-centre) publishes in-person centre addresses, coordinates, services, and general hours, with some site exceptions. [Toronto counter services](https://www.toronto.ca/services-payments/venues-facilities-bookings/booking-city-facilities/counter-services-at-city-hall-civic-centres/) lists public counters and their particular hours. Records without publisher coordinates stay in the list without a guessed pin.

## How to change it

For a new location, add a source record and a `service_location_metadata` row with its category, address, factual public access and service summaries, review time, and exact source URL. Supply coordinates only when the publisher supplies them. Use `NULL` for unknown hours or accessibility; do not infer wheelchair access, opening status, or appointment availability from a building type. Review the source before advancing `details_verified_at`. The pure eligibility logic is in `packages/sources/src/geo/index.ts`; the route is in `apps/worker/src/features/nearby/index.ts`. Update the category enum and migration constraint together if adding a category.

## Configuration

Apply D1 migration `0022_service_location_metadata.sql` before deploying the route or running the seed pack. There are no new secrets. Source metadata and refresh windows are in D1. Service BC's generic counter review timestamp and seven-day expiry are constants in `geo/index.ts`. A scheduled refresh of the BC directory updates location freshness but does not automatically reverify the separate counter page.

## Dependencies

The route depends on public discovery, `@civicresolve/sources/geo`, Cloudflare D1, the official source registry, the Service BC ArcGIS layer and public page, and any official pages listed in the curated source pack. It does not use geocoding or a paid map API.
