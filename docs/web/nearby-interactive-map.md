# Nearby interactive map

## What it is

Nearby uses a real, pan-and-zoom tiled map alongside its searchable source list. Markers represent only service records with source-backed coordinates; the list remains available to everyone, including when the map cannot load.

## How it works

`createNearbyMap({ locale, points, selectedId, onSelect, onFallback })` in `apps/web/src/features/discovery/nearby-map.ts` returns a `NearbyMapView` with `element`, `setSelected`, `setPoints`, `resize`, and `destroy`. Append `element` to the document before the next animation frame so MapLibre can measure it. Call `destroy()` before removing the map from the discovery page to release its WebGL context, markers, and resize observer. The parent owns search filters, list/detail selection, and the map/list switch. A marker calls `onSelect(id)`; the list button calls `onFallback()`. Map failures also queue `onFallback()` so the parent can show the working list without a recursive render.

The module filters out invalid, missing, or out-of-range coordinates. It starts at the first real point and fits the view to all mapped results. At a wide zoom, points whose projected screen positions are within 46 pixels (56 on coarse pointers) form a count badge at their derived center. A badge zooms in; if places remain grouped at a close zoom, it opens a keyboard-operable list of source titles with direct detail actions. No new place or coordinate is added to the search results. A selected location remains an individual marker, changes visual state and `aria-pressed`, and `setSelected` pans to it with motion disabled when requested. Marker and cluster controls are native buttons. MapLibre navigation and attribution controls are present, with 44-pixel touch targets for coarse pointers. If there are no coordinates, WebGL is unavailable, or the map style fails to load, a visible status and list button replace the map.

In Map mode, `index.ts` also renders a scrollable preview of the filtered API records beside the map on desktop and below it on narrow screens. Each row shows the record's source title and service type. Selecting a row uses the same detail selection as a pin, focuses the detail heading, and pans to the pin when the record has an eligible coordinate. On narrow screens the detail replaces the map and preview until the user returns to results. Records without eligible coordinates remain selectable in the preview; they never become fabricated pins.

The default style is OpenFreeMap Liberty, a hosted vector map based on OpenStreetMap data. [OpenFreeMap](https://openfreemap.org/) says its public instance has no API key, account, or usage charge, and requires attribution. The map displays OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution through MapLibre. It does not request OSM Foundation standard raster tiles, bulk download tiles, cache maps for offline use, or send a person's search text to the tile provider. Tile requests reveal the viewed map area and the browser's IP address to OpenFreeMap. This is an external as-is service without an SLA; the list works if it is unavailable.

## How to change it

Keep point validation, marker grouping, labels, selection callbacks, and list fallback in `nearby-map.ts`. Change appearance in `nearby-map.css`, including mobile size and MapLibre control treatment. The parent discovery view should pass only API records with verified coordinates; it should not geocode addresses in the client or invent pins. Edit the preview content and selection behavior in `index.ts` and its responsive layout in `styles.css`; keep its rows synchronized with the same filtered records passed to the map. If grouping distance changes, check a dense city and a province-wide result set at desktop and phone widths so badges remain distinct. If switching tile providers, check their attribution, privacy, and usage policy, then update the style URL and this doc. The MapLibre worker uses Vite's `?worker&url` import so the production worker bundle remains self-contained.

## Configuration

`VITE_MAP_STYLE_URL` may point to another HTTPS MapLibre style; otherwise the module uses `https://tiles.openfreemap.org/styles/liberty`. MapLibre GL JS is pinned in `apps/web/package.json` under the repository's strict two-week `minimumReleaseAge: 20160` pnpm policy. There is no API key or paid map account.

## Dependencies

The module uses MapLibre GL JS, its CSS and worker, OpenFreeMap vector tiles, browser WebGL, ResizeObserver, and the existing discovery API records. The location list and detail panel are owned by `apps/web/src/features/discovery/index.ts`.
