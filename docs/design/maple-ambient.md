# Maple ambient layer

## What it is

The web shell shows a few slow, translucent maple leaves behind page content as a Canadian identity cue. They are decorative SVGs, not emoji or interactive controls.

## How it works

`addMapleAmbient(page)` in `apps/web/src/features/paint/maple-ambient.ts` prepends five SVG leaves to every `.page-wrap` route. The companion CSS puts the layer at the base of the page stacking context and the route content above it. The original negative `z-index` and 12% opacity made the leaves nearly invisible; the current warm red and amber leaves reach 24% opacity while passing through page whitespace. Each leaf falls at a different slow speed and start offset. At 620 px and below, three remain at a capped size. Reduced-motion preference freezes them in place at 20% opacity. The layer occupies no layout space and cannot intercept pointer input.

## How to change it

Import `addMapleAmbient` in `apps/web/src/platform/main.ts` and call it once on the page returned by `mainPage()`, before adding that page to the workspace. The module imports its CSS. To adjust density, placement, or colors, edit the five `nth-child` rules in `maple-ambient.css`; keep the page content above the ambient layer so leaves never cross text or controls. Preserve `aria-hidden`, pointer isolation, and the reduced-motion rule. Avoid a negative layer `z-index`, which puts leaves beneath the page's paint surface.

## Configuration

There are no environment variables. The only runtime preference is `prefers-reduced-motion`. The layer uses the page's existing dimensions and does not affect document flow.

## Dependencies

This module uses browser DOM APIs and a local inline SVG. It requires no icon package or network asset.

## Focused checks

On 2026-09-27, the production page was inspected at desktop and 390 px before the fix: the leaves existed in the DOM but were barely visible. Local Chrome checks after the change at 1280, 390, and 320 px showed visible leaves, no horizontal overflow or runtime errors, and working controls above the ambient layer. Emulated reduced motion reported `animation: none` with static leaves.
