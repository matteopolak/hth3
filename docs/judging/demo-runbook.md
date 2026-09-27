# Judge live demo

## What it is

A repeatable guest-chat path that demonstrates a sourced Ottawa job answer, Ontario retraining support, an Ottawa public service office, and a separate Toronto product suggestion sent to Envoy's review team. It is the central three-minute segment of the [judge pitch](pitch-script.md).

## How it works

### Preflight, 15 minutes before presenting

1. Load `https://envoy.surf/` and `https://envoy.surf/api/healthz` in the same browser. Confirm the page and API both respond from the single Worker.
2. Check the three answers in separate preflight chats immediately before judging; public records may change. Then prepare three fresh guest Assistant tabs. Paste these exact prompts into their composers and leave them **unsent** so each can be sent live during its segment: `Which City of Ottawa jobs are open now? Include closing dates and direct official posting links.`; `What official support programs in Ontario could help someone retrain for work? Show the source and how to continue.`; `Where can I find a public service office near Ottawa, Ontario? Show official sources and how to check the location.` Keep the prompts on the operator's cue card in case a tab reloads. Production captures on September 27 returned ten individually sourced Ottawa jobs, Better Jobs Ontario, and the ServiceOntario St. Joseph Boulevard office respectively.
3. Keep Jobs, Support, and Nearby pages loaded as fallbacks. The chat's official source link is enough for the timed path; open the Nearby map only if it loads instantly. Do not call the Ottawa ServiceOntario location a municipal office, and never substitute a Service BC result for Ottawa.
4. Prepare a separate Toronto Feedback tab. The reliable send path is the typed form. Enter `For Toronto service locations, Envoy's Nearby map does not show whether a place is wheelchair accessible.` as the concern and `Add an accessibility field to each location, linked to the publisher's accessibility information.` as the requested improvement. Show an Assistant proposal only if same-day preflight produced a real editable card. Earlier checks returned text-only, municipality clarification, or duplicate-check unavailability, so do not depend on agent drafting for the timed path. Ottawa civic reports have no Envoy intake destination; the [City's official report-or-request page](https://ottawa.ca/en/3-1-1/report-or-request) is the handoff for those.
5. This is a truthful product suggestion, not an assertion that a streetlight, bench, or signal is broken. Submit only once. If Envoy detects a duplicate, show the existing status and explain why it avoids another report.
6. Keep the PPTX and its PDF backup open. Put the signed-out browser on the projector. Keep the three source chats and Feedback tab adjacent. Turn off notifications and any browser extensions that show private data.
7. Test the page at the room's resolution. The operator can read the answer, source count, official link, destination, and receipt status from the back of the room. Slow maple leaves are decorative and should not obscure any text. Leave zoom at that size.

### Live sequence

At `0:48`, move from slide 3 to a fresh guest chat and send the Ottawa Jobs prompt. Point to an individual role, closing date, and `From N sources`. At `1:30`, send the Ontario Support prompt in a fresh chat and point to Better Jobs Ontario and its official source. At `2:05`, send the Ottawa Nearby prompt in a fresh chat and point to the ServiceOntario St. Joseph Boulevard office and official location link. Treat each segment end as a hard cutoff: use the prepared manual page if its chat answer has not arrived, then continue. At `2:40`, switch to the prepared **Toronto** Feedback tab. Read the Envoy destination and consent state aloud; review and submit the accessibility suggestion only if the text and destination are correct. At `3:35`, show the new private receipt/status and return to slide 4 by `3:50`. Do not imply the three Ottawa source searches created an Ottawa reporting route.

### Fast recovery

| Failure | Action within 10 seconds | What to say |
| --- | --- | --- |
| A chat answer is slow or has no source | Switch to its preloaded Jobs, Support, or Nearby page. | “Here is the source-backed record in the manual view.” |
| Nearby tiles or geolocation fail | Stay on the chat answer or switch to the list view. | “The office detail and official link are available without the map.” |
| Workers AI is slow, has no proposal card, or proposes the wrong action | Stop it; use the prepared typed Feedback tab. | “The form keeps the same review boundary.” |
| Duplicate result appears | Do not send again; show the existing status. | “Envoy found an existing report and showed its current state.” |
| Feedback submit fails | Show the review page, stop the write, move to technical slide. | “The review stage is live; I won't call this submitted without a receipt.” |
| Wi-Fi fails | Show the locally saved PDF plus the unlisted video if it is already buffered. | “The network is unavailable in the room. I’ll show the captured flow and distinguish it from this live attempt.” |

The recovery language preserves a true statement about what the judges saw. Never call a draft a submission, a source link an application, or an Envoy report a government report.

## How to change it

Refresh the Jobs, Support, and Nearby answers on presentation day because vacancies, program details, and office data change. Replace the product concern only with a truthful Toronto report that Envoy's review team can receive. Add a staff segment only after a real Auth0 role session passes on production. Add live Tiger proof only after a fresh event appears in the hypertable and aggregate, and keep query results free of resident text.

## Configuration

Use the apex host `https://envoy.surf`, English locale, clean guest browser profile, visible source links, and no private tokens on screen. Keep a PDF copy of the deck and the submitted video downloaded or buffered for an offline fallback. The 5:00 clock and 4:00 cut are in [the pitch script](pitch-script.md).

## Dependencies

The path relies on the combined Cloudflare Worker and its D1-backed discovery, feedback, guest receipt, and Workers AI routes. The browser needs connectivity for live source handoffs. No staff account, phone sensor, or voice API session is required for the primary demo.
