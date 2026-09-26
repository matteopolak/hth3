# Web UI primitives

## What it is

`@civicresolve/ui` provides small DOM and CSS primitives for common web buttons, cards, labeled fields, and status text. It keeps these controls consistent across resident and staff screens while allowing each feature to choose its own layout.

## How it works

The package exports `uiButton`, `uiCard`, `uiField`, and `uiStatus` from `packages/ui/src/index.ts`, with matching styles in `packages/ui/src/styles.css`. The shell imports the stylesheet once and uses the factories for sign-in choices, ordinary action buttons, feedback text areas, and status pills. Feature classes remain on the elements for local layout and responsive rules.

`uiButton` always creates a native `type="button"` control and requires visible text or an accessible label. `uiField` wraps its control in a native label and connects optional hint or error text through `aria-describedby`; errors also set `aria-invalid`. `uiCard` creates a non-interactive section, and `uiStatus` renders its status as text so meaning does not depend on color. Variant tones deliberately remain neutral in the monochrome theme.

## How to change it

Add a visual or semantic primitive to both the TypeScript factory and its `ui-*` CSS class. Preserve native control semantics and focus outlines. For a feature-specific size or position, pass `className` and keep that styling in the feature stylesheet. Do not turn `uiCard` into an interactive container; use a real link or button inside it. If a field has a hint or error, give its control a stable ID so description IDs are stable too.

When adopting an existing shell control, keep its current class alongside `ui-*` during migration so local selectors continue to work. Test English and French at 320 and 390 pixels after changing padding or label treatment.

## Configuration

The web app declares `@civicresolve/ui: workspace:*`; `pnpm-workspace.yaml` retains the strict two-week `minimumReleaseAge` policy. CSS responds to `pointer: coarse`, `prefers-reduced-motion: reduce`, and `prefers-contrast: more`. There are no environment variables.

## Dependencies

The package uses browser DOM APIs and the workspace TypeScript configuration. The web shell imports it directly. It has no external runtime dependency.
