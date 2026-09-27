# Web interaction accessibility

## What it is

Envoy's web shell applies a common focus, contrast, and touch-target baseline to resident and staff routes. It also keeps keyboard focus inside temporary navigation surfaces and returns it to the control that opened them.

## How it works

The closed mobile rail is hidden from keyboard and screen-reader navigation. The mobile rail and chat search dialog put focus on their first useful control when opened. `Tab` wraps inside each open surface; `Escape` closes it and returns focus to the menu or search trigger. The search dialog makes the underlying app shell inert while open. The chat plus and model menus move focus into their choices and return it to the composer button on dismissal. The plus list uses a named group of ordinary buttons and a native file control instead of a menu role that would require custom arrow-key navigation.

`apps/web/src/platform/styles.css` supplies a rounded blue focus halo, readable muted text, and 44-pixel control targets for coarse pointers. The chat textarea delegates its focus treatment to the rounded composer. In forced-colors mode the halo becomes a system-color outline. The compact desktop layout remains intact. The main map's dense numbered pins are exempt from the 44-pixel rule; the same sourced places remain available through the 44-pixel map key rows and full list. At narrow widths the chat textarea grows to show the longer French prompt without an internal scrollbar. The app also honors `prefers-reduced-motion` and `prefers-contrast: more`.

The staff workspace uses a darker muted-text token for readable supporting copy and stacks page actions below headings on very narrow screens so French titles retain their full width.

The shell maps `@civicresolve/design-tokens` monochrome values into CSS variables; `CivicTheme` carries the same neutral design intent in SwiftUI. Status labels carry the meaning even where semantic token colors are identical.

Native iOS uses SwiftUI controls and `CivicTheme` in `apps/mobile/ios/CivicResolve/Design/`. This web pass does not establish full VoiceOver or native touch-target acceptance.

## How to change it

Keep each icon-only control's accessible name in `apps/web/src/platform/main.ts`. When adding a modal or drawer, focus its first action, handle `Escape`, keep `Tab` within it, and restore focus to its trigger. Use real buttons, links, labels, and summaries so keyboard and screen-reader behavior follows the platform. Add feature-specific hover and focus styles without suppressing the shared `:focus-visible` outline. Check the corresponding French route at 320 and 390 pixels; avoid hiding long labels to make them fit.

When adding a map interaction, keep a list or key with the same records. The map currently shows source-backed coordinates in a schematic view and may space close pins; do not imply street-level precision or "open now" status.

## Configuration

No environment variable controls this behavior. CSS media queries use `pointer: coarse`, `prefers-reduced-motion: reduce`, and `prefers-contrast: more`. The phone rail breakpoint is 620 pixels. Locale is selected in the UI and persists in `localStorage`.

## Dependencies

The implementation depends on the platform shell, feature CSS, shared i18n strings, native browser focus behavior, and SwiftUI for iOS. It adds no package dependency.

## Focused checks

On 2026-09-26, isolated Chrome checks at 320 and 390 pixels with touch emulation reported 44-by-44-pixel menu controls, a 44-pixel locale control, no visible main-button targets under 44 pixels, and no document overflow. Keyboard checks confirmed focus entering and returning from the mobile rail, search dialog, plus menu, and model menu; no runtime exceptions occurred. French 320-pixel Jobs, Support, Funding, Nearby, and Participation smoke checks showed no document overflow or runtime exceptions. A computed contrast pass on the visible Assistant, Jobs, and Feedback main content found no sub-4.5:1 small-text samples under the audited white surfaces. Browser media emulation confirmed reduced motion shortens transitions to 0.01 ms and increased contrast switches the focus and muted-text tokens to `#000` and `#3d3d3d`.

Staff Overview, Themes, Hiring, and Applicants were also checked in a local staff session at desktop width, and Applicants at 390 pixels. French Themes at 320 pixels exposed a squeezed heading; the narrow staff layout now places actions underneath it.

The model selector's native range was keyboard checked at desktop and phone widths: ArrowRight changed its labeled display position, and Escape returned focus to the trigger. The chat textarea now has no inner outline while its rounded composer shows a two-tone focus halo. This remains a presentation-only slider; the menu says replies use one fixed model.

A comprehensive screen-reader and native-device audit remains to be done before claiming the full design-system issue is complete.
