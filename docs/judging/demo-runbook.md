# Judge live demo

## What it is

A repeatable live browser path that demonstrates a sourced opportunity, a nearby public service, and a guest product suggestion that reaches Envoy's review team. It is the central two-to-three-minute segment of the [judge pitch](pitch-script.md).

## How it works

### Preflight, 15 minutes before presenting

1. Load `https://envoy.surf/` and `https://envoy.surf/api/healthz` in the same browser. Confirm the page and API both respond from the single Worker.
2. In a clean tab, open Jobs and find one **individual**, currently open Ottawa role with a visible publisher, closing date, and exact official posting link. Record the role title on a private cue card; do not hard-code an old vacancy in the slides.
3. Open Nearby and find one populated real city and one mapped service with an official link. Leave this tab loaded.
4. Prepare a fresh guest Assistant tab and a Feedback tab. The reliable path is the typed form. Enter `For Toronto service locations, Envoy's Nearby map does not show whether a place is wheelchair accessible.` as the concern and `Add an accessibility field to each location, linked to the publisher's accessibility information.` as the requested improvement. If you want to show the assistant first, preflight this exact request and use it only when the response includes a real editable proposal card. Text-only encouragement is not a proposal. Three live checks on September 27 yielded text-only, municipality clarification, and duplicate-check unavailability, so do not depend on agent drafting for the timed path.
5. This is a truthful product suggestion, not an assertion that a streetlight, bench, or signal is broken. Submit only once. If Envoy detects a duplicate, show the existing status and explain why it avoids another report.
6. Keep the PPTX and its PDF backup open. Put the signed-out browser on the projector. Keep the source tab and Feedback fallback tab adjacent. Turn off notifications and any browser extensions that show private data.
7. Test the page at the room's resolution. The operator can read role title, source, date, destination, and receipt status from the back of the room. Leave zoom at that size.

### Live sequence

At `0:48`, move from slide 3 to Jobs; select the full vacancy card, point to the publisher and closing date, and explain the external handoff. At `1:35`, switch to Nearby, filter/select a service, and point to its official source. At `2:05`, switch to the prepared Feedback tab. If a preflighted assistant card is ready and real, it can precede the form; otherwise do not spend the live clock waiting for it. Read the report destination and consent state aloud. Review and submit the accessibility suggestion only if the text and destination are correct. At `3:35`, show the new private receipt/status and move back to slide 4 by `3:50`.

### Fast recovery

| Failure | Action within 10 seconds | What to say |
| --- | --- | --- |
| Jobs search is slow | Use the preloaded individual role tab. | “This is the exact official posting and its publisher.” |
| Nearby tiles or geolocation fail | Switch to the list view and open the preselected service. | “The same source and office detail are available without the map.” |
| Workers AI is slow, has no proposal card, or proposes the wrong action | Stop it; use the prepared typed Feedback tab. | “The form keeps the same review boundary.” |
| Duplicate result appears | Do not send again; show the existing status. | “Envoy found an existing report and showed its current state.” |
| Feedback submit fails | Show the review page, stop the write, move to technical slide. | “The review stage is live; I won't call this submitted without a receipt.” |
| Wi-Fi fails | Show the locally saved PDF plus the unlisted video if it is already buffered. | “The network is unavailable in the room. I’ll show the captured flow and distinguish it from this live attempt.” |

The recovery language preserves a true statement about what the judges saw. Never call a draft a submission, a source link an application, or an Envoy report a government report.

## How to change it

Refresh role and service selections on presentation day because official vacancies and office details change. Replace the product concern only with a truthful report that Envoy's review team can receive. Add a staff segment only after a real Auth0 role session passes on production. Add live Tiger proof only after a fresh event appears in the hypertable and aggregate, and keep query results free of resident text.

## Configuration

Use the apex host `https://envoy.surf`, English locale, clean guest browser profile, visible source links, and no private tokens on screen. Keep a PDF copy of the deck and the submitted video downloaded or buffered for an offline fallback. The 5:00 clock and 4:00 cut are in [the pitch script](pitch-script.md).

## Dependencies

The path relies on the combined Cloudflare Worker and its D1-backed discovery, feedback, guest receipt, and Workers AI routes. The browser needs connectivity for live source handoffs. No staff account, phone sensor, or voice API session is required for the primary demo.
