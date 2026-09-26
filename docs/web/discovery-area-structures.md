# Discovery area structures

## What it is

Jobs, Support, and Funding each have a compact introduction with actions suited to that area. The search, sourced results, record details, saving, and official handoff remain in the shared discovery view.

## How it works

`createDiscoveryAreaStructure({ area, locale, onBrowse, onSearchLocation })` returns a DOM section for one of `jobs`, `support`, or `funding`. Jobs puts the source search first. Support emphasizes choosing a jurisdiction. Funding shows the actual sequence: find a reviewed source, verify current terms with its publisher, and prepare notes before continuing to that publisher. All three offer region shortcuts for all regions, federal sources, Ontario, and British Columbia.

The module owns no API calls or search state. `onBrowse()` should move focus to the existing discovery search, respecting the user's reduced-motion preference if it also scrolls. `onSearchLocation(location)` should set the discovery location field and run the current area search. The callback receives `""`, `"CA"` for federal sources, `"Ontario"`, or `"British Columbia"`. Pass the current `location` as `selectedLocation` so the active shortcut has both a visible state and `aria-pressed`; a custom city leaves all shortcuts unpressed. These are search filters, not claims that any particular record is currently available. The resulting list remains sourced and can be empty.

The introductions do not claim that Envoy hosts individual openings, adjudicates eligibility, or records an external application. The federal and provincial source adapters provide the official finder records, and the detail view provides provenance and the publisher handoff.

## How to change it

Edit `apps/web/src/features/discovery/area-structures.ts` for layout copy, region shortcuts, or action wiring. Edit its adjacent `area-structures.css` for responsive presentation. Keep the module independent of API fetch state so the discovery view can rerender it with current callbacks. If a new shortcut is added, check that the Worker discovery `location` filter recognizes its value and that the source adapters cover that jurisdiction. English and French strings live together in this module.

## Configuration

The only inputs are the selected area, `en` or `fr` locale, and the two callbacks. API base URL, saved-record authorization, and practice-record opt-in remain configured by the parent discovery view.

## Dependencies

The module uses browser DOM APIs, the shared `Locale` type, and `lucide-static` icons. Its actions depend on the parent discovery view and the Worker `/api/v1/discovery` search behavior. The displayed sources come from the federal, Ontario, and British Columbia source adapters when ingestion succeeds.
