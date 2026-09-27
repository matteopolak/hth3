# Maple ambient layer

## What it is

The web shell can show a few slow, translucent maple leaves behind page content as a quiet Canadian identity cue. They are decorative SVGs, not emoji or interactive controls.

## How it works

`addMapleAmbient(page)` in `apps/web/src/features/paint/maple-ambient.ts` prepends five SVG leaves to a `.page-wrap` element. The companion CSS positions them absolutely behind page content, with no layout space or pointer events. Each leaf falls at a different slow speed and start offset. At 620 px and below, only two remain. Reduced-motion preference freezes them in place.

## How to change it

Import `addMapleAmbient` in `apps/web/src/platform/main.ts` and call it once on the page returned by `mainPage()`, before adding that page to the workspace. The module imports its CSS. To adjust the density or colors, edit the five `nth-child` rules in `maple-ambient.css`; keep opacity low enough that text stays clear. Preserve `aria-hidden`, pointer isolation, and the reduced-motion rule.

## Configuration

There are no environment variables. The only runtime preference is `prefers-reduced-motion`. The layer uses the page's existing dimensions and does not affect document flow.

## Dependencies

This module uses browser DOM APIs and a local inline SVG. It requires no icon package or network asset.
