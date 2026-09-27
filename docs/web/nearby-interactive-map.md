# Nearby interactive map

## What it is

Nearby uses a real, pan-and-zoom tiled map alongside its searchable source list. Markers represent only service records with source-backed coordinates; the list remains available to everyone, including when the map cannot load.

## How it works

`createNearbyMap({ locale, points, selectedId, onSelect, onFallback })` in `apps/web/src/features/discovery/nearby-map.ts` returns a `NearbyMapView` with `element`, `setSelected`, `setPoints`, `resize`, and `destroy`. Append `element` to the document before the next animation frame so MapLibre can measure it. Call `destroy()` before removing the map from the discovery page to release its WebGL context, markers, and resize observer. The parent owns search filters, list/detail selection, and the map/list switch. A marker calls `onSelect(id)`; the list button calls `onFallback()`. Map failures also queue `onFallback()` so the parent can show the working list without a recursive render.

The module filters out invalid, missing, or out-of-range coordinates. It starts at the first real point and fits the view to all mapped results. A selected marker changes visual state and `aria-pressed`; `setSelected` pans to it, with motion disabled when the user requests reduced motion. Marker controls are native buttons with place names. MapLibre navigation and attribution controls are present, with 44-pixel touch targets for coarse pointers. If there are no coordinates, WebGL is unavailable, or the map style fails to load, a visible status and list button replace the map.

The default style is OpenFreeMap Liberty, a hosted vector map based on OpenStreetMap data. [OpenFreeMap](https://openfreemap.org/) says its public instance has no API key, account, or usage charge, and requires attribution. The map displays OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution through MapLibre. It does not request OSM Foundation standard raster tiles, bulk download tiles, cache maps for offline use, or send a person's search text to the tile provider. Tile requests reveal the viewed map area and the browser's IP address to OpenFreeMap. This is an external as-is service without an SLA; the list works if it is unavailable.

## How to change it

Keep point validation, marker labels, selection callbacks, and list fallback in `nearby-map.ts`. Change appearance in `nearby-map.css`, including mobile size and MapLibre control treatment. The parent discovery view should pass only API records with verified coordinates; it should not geocode addresses in the client or invent pins. If switching tile providers, check their attribution, privacy, and usage policy, then update the style URL and this doc. The MapLibre worker uses Vite's `?worker&url` import so the production worker bundle remains self-contained.

## Configuration

`VITE_MAP_STYLE_URL` may point to another HTTPS MapLibre style; otherwise the module uses `https://tiles.openfreemap.org/styles/liberty`. MapLibre GL JS is pinned in `apps/web/package.json` under the repository's strict two-week `minimumReleaseAge: 20160` pnpm policy. There is no API key or paid map account.

## Dependencies

The module uses MapLibre GL JS, its CSS and worker, OpenFreeMap vector tiles, browser WebGL, ResizeObserver, and the existing discovery API records. The location list and detail panel are owned by `apps/web/src/features/discovery/index.ts`.
