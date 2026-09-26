# Web and mobile experience principles

Planning status: these are design requirements for the future web and mobile applications, not a claim that the UI exists.

## What it is

This defines the interaction and visual guardrails for the bilingual public website, public mobile app, and government staff/employer workspace. The interfaces should feel related without forcing every task into the same component pattern.

## How it works

The public home starts with a practical “What are you trying to do?” entry, then routes to Jobs, Support, Funding, Nearby, and Share feedback. Jobs and funding use compact filterable result rows with deadline and source cues. Benefits use a guided matcher and plain-language next steps. Nearby uses a map/list switch with service and accessibility filters. Applying and giving feedback use short, reviewable steps. My activity uses a straightforward timeline, not a decorative dashboard.

The staff workspace uses a restrained left rail for agent threads and manual tabs. Feedback opens on exact counts and evidence-linked themes. Hiring opens on a dense applicant queue and posting management. Source management exposes freshness and import failures. The agent conversation uses rich cards only for a source-backed result or proposed action; write cards include a diff, target, permission boundary and explicit confirmation. Manual tabs can complete every core task when AI is unavailable.

Use an original civic identity informed by the clarity of Stripe, the quiet workspace feel of ChatGPT/Notion, and the editorial restraint of Anthropic without copying any one site. Prefer modest type scale, strong hierarchy, neutral surfaces, restrained accents, semantic status colors, visible focus and ample but not wasteful spacing. Avoid nested cards, ubiquitous oversized headings, repetitive three-column feature grids, filler paragraphs and inert controls. Every page needs real loading, error, empty, stale and permission-denied states. Test at phone, tablet and desktop widths and with long French text.

The Expo app is a native-feeling public client of the same Worker API, not a Remotion-only mock or a webview. Its core search, application, feedback and status flows must actually work. Employer and platform administration are web-first. Text alternatives exist for voice; map results also have an accessible list; autofill never commits an answer without review.

## How to change it

Before adding a new module, select the interaction suited to the task rather than cloning an existing page. Define its primary action, information hierarchy, source/provenance treatment, and empty/error states. Add EN/FR strings to the shared catalogue and test longer translations. Keep shared tokens and status names aligned between web/mobile/video, while allowing native controls and layouts to differ. Validate keyboard/focus, touch targets and screen-reader labels, not just screenshots.

## Configuration

Shared design tokens control colors, type, spacing, radii and breakpoints. Locale comes from the user's preference with an explicit switch; the browser/device language may provide an initial default. Do not rely on runtime AI translation for critical application, eligibility, consent or status copy. Reduced-motion and accessibility preferences must remain user-controllable.

## Dependencies

Shared contracts and i18n catalogue, design tokens, public/staff APIs, Expo/React Native and web UI. Optional Presage adaptations require explicit consent and cannot affect priority, eligibility or hiring decisions.
