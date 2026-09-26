# Web and mobile experience principles

These principles describe the current web and native iOS interfaces and guide subsequent changes.

## What it is

This defines the interaction and visual guardrails for the bilingual public website, public mobile app, and government staff/employer workspace. The interfaces should feel related without forcing every task into the same component pattern.

## How it works

The public home starts with a practical “What are you trying to do?” entry, then routes to Jobs, Support, Funding, Nearby, and Share feedback. Jobs and funding use compact filterable result rows with source cues. A selected job or program takes the main detail space, while the entire result row is clickable. Benefits use plain-language next steps. Nearby uses a map/list switch with service and accessibility filters. Applying and giving feedback use short, reviewable steps. My activity uses a straightforward timeline, not a decorative dashboard.

Keep participating and external destinations distinct throughout a journey. A participating employer or sponsor can receive an explicitly reviewed in-app submission, which then appears in the applicant's status and message timeline. An official finder leads to preparation and the publisher's site; Envoy never claims that the external action was submitted. Résumé extraction can suggest text with source evidence, but the applicant chooses what to use and separately consents before sharing a private résumé with an employer. Practice records are disclosed at the action without filling every title or navigation item with demo language.

The staff workspace uses a restrained left rail for agent threads and manual tabs. Feedback opens on exact counts and evidence-linked themes. Hiring opens on a dense applicant queue and posting management. Source management exposes freshness and import failures. The agent conversation uses rich cards only for a source-backed result or proposed action; write cards include a diff, target, permission boundary and explicit confirmation. Manual tabs can complete every core task when AI is unavailable.

Employee navigation follows the authenticated organization's capabilities: civic staff see feedback work, hiring reviewers see applicants, posting managers see hiring, curators see taxonomy, and administrators can inspect a concise audit timeline. An unavailable action says so clearly; an in-progress action shows a disabled busy state. The audit timeline shows record metadata only, keeping report and applicant content in its protected detail view.

Use an original civic identity informed by the clarity of Stripe, the quiet workspace feel of ChatGPT/Notion, and the editorial restraint of Anthropic without copying any one site. Prefer modest type scale, strong hierarchy, neutral surfaces, restrained accents, semantic status colors, visible focus and ample but not wasteful spacing. Avoid nested cards, ubiquitous oversized headings, repetitive three-column feature grids, filler paragraphs and inert controls. Every page needs real loading, error, empty, stale and permission-denied states. Test at phone, tablet and desktop widths and with long French text.

The current web interaction baseline is documented in [Web interaction accessibility](web/interaction-accessibility.md). Mobile controls use a larger touch target, muted text remains readable, temporary navigation retains and restores keyboard focus, and the dense schematic map always has a list alternative. These are shared shell rules; feature components should preserve them rather than replacing focus rings with hover-only styling.

Common web buttons, cards, labeled fields, and text statuses use the small [Web UI primitives](design/web-ui-primitives.md) package. Feature modules retain distinct layouts and local styles rather than forcing the same card structure onto every screen.

The iOS app is a native SwiftUI public client of the same Worker API. Explore groups jobs, support, funding, nearby services, consultations, and private saved checklists. The nearby map uses only source coordinates and always has a list. An official handoff confirms that the action continues on the publisher's site; it never marks an external application as submitted. Participating-employer applications require editable answers and applicant confirmation, with the private résumé shared separately. Practice postings and feedback are disclosed at the action. Employer and platform administration are web-first. Text alternatives exist for voice.

## How to change it

Before adding a new module, select the interaction suited to the task rather than cloning an existing page. Define its primary action, information hierarchy, source/provenance treatment, and empty/error states. Add EN/FR strings to the shared catalogue and test longer translations. Keep shared tokens and status names aligned between web/mobile/video, while allowing native controls and layouts to differ. Validate keyboard/focus, touch targets and screen-reader labels, not just screenshots.

For web controls, verify the open, `Tab`, `Shift+Tab`, `Escape`, and focus-return paths of any drawer or dialog. Use an accessible list alongside dense pins. Include 320- and 390-pixel French smoke checks and test `prefers-reduced-motion`; formal screen-reader and native-device acceptance must be recorded separately.

## Configuration

Shared design tokens control colors, type, spacing, radii and breakpoints. Locale comes from the user's preference with an explicit switch; the browser/device language may provide an initial default. Do not rely on runtime AI translation for critical application, eligibility, consent or status copy. Reduced-motion and accessibility preferences must remain user-controllable.

## Dependencies

Shared contracts and i18n catalogue, design tokens, public/staff APIs, SwiftUI for iOS, and web UI. Optional Presage adaptations require explicit consent and cannot affect priority, eligibility or hiring decisions.
