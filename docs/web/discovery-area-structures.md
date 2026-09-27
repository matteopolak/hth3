# Discovery area structures

## What it is

Jobs, Support, and Funding each have an introduction and browsing layout suited to that area. Search, sourced details, saving, and official handoff remain in the shared discovery view.

## How it works

`createDiscoveryAreaStructure({ area, locale, onBrowse, onSearchLocation })` returns a DOM section for one of `jobs`, `support`, or `funding`. Jobs keeps its direct source search. Support is a region-led directory: jurisdiction choices are visible first, keyword and city fields open from a native disclosure, and results appear as wide directory rows. Funding puts the actual preparation sequence above a compact search strip and shows sources in a grid. Selecting a Support or Funding source opens its detail below the results; keyboard focus moves to the detail heading and the detail scrolls into view while respecting reduced-motion preference. On narrow screens, selection swaps the list for the same source detail and its back action.

Support and Funding start without an automatically selected record, so the browsing surface is not dominated by the first source's detail. Every source card remains a full button with `aria-pressed` selection state. The detail, save, prepare, and publisher handoff actions still use the same source data and Worker routes as Jobs.

The structure module owns no API calls or search state. `onBrowse()` moves focus to the existing discovery search, respecting the user's reduced-motion preference if it scrolls. `onSearchLocation(location)` sets the discovery location field and runs the current area search. The callback receives `""`, `"CA"` for federal sources, `"Ontario"`, or `"British Columbia"`. Pass the current `location` as `selectedLocation` so the active shortcut has both a visible state and `aria-pressed`; a custom city leaves all shortcuts unpressed. These are search filters, not claims that any particular record is currently available. The resulting list remains sourced and can be empty.

The introductions do not claim that Envoy adjudicates eligibility or records an external application. Where sourced, the discovery API now supplies individual job postings and funding programs with effective status and direct publisher handoff. Career directories and other finders remain separate from those individual records, and the detail view provides provenance.

## How to change it

Edit `apps/web/src/features/discovery/area-structures.ts` for introduction copy, region shortcuts, or action wiring. The shared view in `apps/web/src/features/discovery/index.ts` controls the Support search disclosure, initial selection, and source-detail scroll; `styles.css` holds the area-specific result layouts. `area-structures.css` handles the introduction and region controls. Keep the structure module independent of API fetch state so the discovery view can rerender it with current callbacks. If a new shortcut is added, check that the Worker discovery `location` filter recognizes its value and that the source adapters cover that jurisdiction. English and French strings live in the structure module and shared discovery catalog.

## Configuration

The structure inputs are the selected area, `en` or `fr` locale, selected location, and the two callbacks. Search and layout behavior are selected by the area name in the parent discovery view; no new environment flags were added. API base URL and saved-record authorization remain configured there. Practice records are hidden in production discovery; local Vite development can opt in with `?practice=1`.

## Dependencies

The module uses browser DOM APIs, the shared `Locale` type, and `lucide-static` icons. Its actions depend on the parent discovery view and the Worker `/api/v1/discovery` search behavior. The displayed sources come from the federal, Ontario, and British Columbia source adapters when ingestion succeeds.
