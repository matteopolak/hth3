# Guest feedback form

## What it is

The resident Feedback page is a short, guided way to write a report and review its destination before sending. Optional writing starters and a suggestion field help people add context without making those steps mandatory.

## How it works

`feedbackPage` and `feedbackForm` in `apps/web/src/platform/main.ts` own the page state and existing voice, duplicate-check, emergency, review, and submission handlers. `apps/web/src/features/feedback/feedback.css` styles only the resident flow through `.feedback-flow` and its child classes. The layout uses a single writing surface and a quiet safety column; responsive rules stack them on narrow screens.

`addFeedbackWritingStarters` in `apps/web/src/features/feedback/index.ts` adds a native `<details>` disclosure before the existing optional suggestion disclosure. Each starter appends a short phrase to the message textarea and dispatches an `input` event. The current `textArea` handler therefore updates `state.feedbackDraft`; the starter has no separate or hidden submission field. It never invokes review or submit.

The suggestion disclosure contains the existing `feedbackImprovement` field. The draft goes through `/feedback/duplicate-check` before the resident sees the review. Submission remains gated by the destination acknowledgment, and an existing similar issue requires explicit separate-issue confirmation. The emergency action still obtains 911 guidance without creating a report.

## How to change it

Edit the starter labels and phrases together in the feature module's English and French `copy` object. The form and review labels live in `packages/i18n/src/en.ts` and `fr.ts`. If a new optional control should change routing or stored case data, wire it through the web API, duplicate check, Worker contract, review, and receipt before displaying it. Do not present a selector that changes only local UI while implying that it changes delivery. The current web path always uses Toronto's supported practice destination.

Keep the disclosures native for keyboard use. Preserve the `input` event after any programmatic textarea edit so the stored draft matches the visible text. When changing layout, check desktop and phone widths and keep the destination and emergency guidance visible.

## Configuration

The form uses the shared `VITE_API_BASE_URL` API configuration. The writing starters require a `Locale` value (`en` or `fr`) from the shell. `feedback.css` has responsive breakpoints at 850 and 620 CSS pixels.

## Dependencies

The feature depends on the shared feedback page in `platform/main.ts`, the web API client, `@civicresolve/contracts/v1` for the locale type, the Cloudflare Worker feedback routes, and the existing ElevenLabs voice session integration.
