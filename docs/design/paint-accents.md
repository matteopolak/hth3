# Paint accents and confirmation motion

## What it is

Envoy keeps a light, compact interface and uses a small set of solid color accents to distinguish workspaces. Confirmed actions can trigger a brief paint-splash effect; color never replaces the visible status text.

## How it works

`packages/design-tokens/src/index.ts` defines the shell's cobalt action color, semantic status colors, and five paint colors. The jobs, programs, and intake feature styles use small irregular brush shapes and filled dots alongside ordinary labels. `apps/web/src/features/paint/solid-icons.ts` exports `solidNavIcon(kind)`, a filled SVG set for destination icons. It returns `null` for utility controls such as the microphone and chevrons, which retain Lucide.

`apps/web/src/features/paint/index.ts` exports a filled check glyph and `playPaintSplash(anchor, tone)`. The helper places five non-interactive paint flecks at an element or saved `DOMRect` and removes them after 850 ms. It does nothing when reduced motion is requested.

The application and program intake pages call the helper only after the Worker accepts a submission or publication. They save the button's bounds before the async request because the pending-state render can replace that button.

## How to change it

Add palette values in design tokens before using them in a new feature. A feature can import `playPaintSplash` and call it after a successful API response, passing the confirmed control's saved bounds. The shell can use `solidNavIcon(kind) ?? lucideIcon` inside `iconNode` to replace destination glyphs while preserving utility controls. Keep decorative marks small, leave controls and text readable, and keep status labels visible. Avoid calling the splash on the initial click.

## Configuration

There are no environment variables. `prefers-reduced-motion: reduce` suppresses the animation. The shell maps the primary design tokens to CSS custom properties in `apps/web/src/platform/main.ts`.

## Dependencies

The helper depends on browser DOM APIs and `@civicresolve/design-tokens`. Destination and confirmation SVGs are local assets with no new package dependency. Feature pages still use Lucide for functional utility icons.
