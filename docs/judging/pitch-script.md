# Hack the Hill III judge pitch

## What it is

A five-minute, in-person Civic Technology presentation for Envoy, followed by three minutes of questions. The deck is in [`apps/pitch/out/envoy-judges-2026-v4.pptx`](../../apps/pitch/out/envoy-judges-2026-v4.pptx). The live browser carries the middle of the pitch; the slides frame the problem, technical decisions, and evidence.

## How it works

The [organizer's Resources page](https://tracker.hackthehill.com/resources) currently gives five minutes for the presentation and demonstration, then three minutes for Q&A. Its Civic Technology guidance asks who the product serves, which public institution or process it touches, and what interaction improves. The judging rubric totals 45 points: Technical Execution 15, Idea & Impact 10, Design & Usability 10, Learning & Technical Decisions 5, and Presentation 5. Recheck the on-site timekeeper before the panel. The 4:00 cut is below.

| Clock | Visual | Speaker script and action |
| --- | --- | --- |
| 0:00–0:20 | Slide 1, `envoy` | “A resident needs an answer, but public information is spread across dozens of sites. Envoy helps them find the official source, understand the next step, and raise a concern without guessing who receives it.” |
| 0:20–0:48 | Slide 2, civic handoff | “We serve people navigating Canadian public services and opportunities. The institutions are the public publishers of jobs, services, and programs. Envoy links to those publishers. For concerns submitted here today, Envoy's own review team is the destination. No municipality or employer is participating yet.” |
| 0:48–1:35 | Slide 3, then browser: Jobs | “Here are current individual vacancies. I’ll search Ottawa, open a posting, and show its publisher and closing date. Envoy makes that source legible. Applying to this external role happens on the publisher's site; Envoy never claims the application was filed.” Search `Ottawa`; open one individual City of Ottawa role; point to its exact official link. Do not open the publisher unless the browser is fast. |
| 1:35–2:05 | Browser: Nearby | “The same source-backed search shows services around a city. I can filter the map, select a location, and see the office details before opening its official page.” Open Nearby, use a known populated city, select one mapped service. |
| 2:05–3:35 | Browser: Assistant if preflight passed, then Feedback | “Envoy's Nearby map could tell people whether a service location is wheelchair accessible. I can send that product suggestion here. The destination is visible before I approve it.” Use the prepared typed Feedback form as the reliable path. Show an assistant proposal first only if a preflight run produced an actual editable card; a text-only assistant reply is not a proposal. Review the destination aloud, then submit the truthful suggestion to Envoy's review team. If a duplicate is detected, show its status and do not force a second submission. |
| 3:35–3:50 | Browser: receipt | “The private receipt shows that Envoy received this and lets the resident check later status. That completes the flow we can prove live.” Do not read the secret receipt token aloud or show it in a zoomed capture. |
| 3:50–4:40 | Slide 4, technical boundaries | “A single Cloudflare Worker serves the site and API. D1 stores sourced records and the reviewable actions; R2 stores private files. Workers AI drafts within typed tools, while the Worker checks permission and human approval before a write. A D1 outbox sends limited event metadata to Tiger Data for trends. Report text stays out of those analytics events.” |
| 4:40–5:00 | Slide 5, close | “The result is a clearer public-service handoff with a visible source and a truthful destination. Open envoy.surf and try the same path. We’re ready for questions.” |

### Four-minute contingency

If the room gives four minutes, omit Nearby and the sentence about R2. Search Jobs for 35 seconds, spend two minutes on the assistant-to-receipt path, and use 25 seconds for the technical summary. Do not accelerate the consent or destination readout. Stop at 3:50 and leave ten seconds for the browser-to-slide handoff.

### Who advances

With four speakers, allocate by clock: speaker A handles the opening and civic value (0:00–0:48), speaker B narrates Jobs and Nearby (0:48–2:05), speaker C narrates the reviewed concern and receipt (2:05–3:50), and speaker D handles the technical boundaries and close (3:50–5:00). Assign one computer operator and one timekeeper separately from speaking roles, rotating those duties as needed. The handoffs should take one sentence or less. This allocation describes stage roles, not who built each feature.

The simpler fallback is one speaker for the full five minutes, one browser operator, and a timer watcher. If one person must do both speaking and operating, leave the Feedback tab preloaded and cut Nearby before rushing the review step.

## How to change it

Rehearse against the final deployed site, then adjust the clock by observed latency rather than adding more features. Refresh the job role, city, and source link immediately before the panel. Replace an integration claim only after its live acceptance evidence exists. A staff workflow can be shown after a real scoped Auth0 token performs an authorized action and an unauthorized action is denied. A native Presage or ElevenLabs voice segment can be shown after a complete physical-device or voice-to-feedback run respectively. Update the deck speaker notes and [Q&A sheet](q-and-a.md) with the same claims.

## Configuration

Use `https://envoy.surf/`, English locale, browser zoom at a readable size, and a prepared truthful concern about Envoy. Keep API keys, JWTs, private résumé data, and receipt tokens out of projected content. Set the browser window to full screen before judges enter. The current live demo only needs a guest session.

## Dependencies

The pitch depends on Envoy's combined Cloudflare Worker, D1, public source records, Workers AI, and feedback receipt route. Tiger Data is a read-only technical proof if the outbox has delivered a fresh event. Auth0, ElevenLabs, and Presage are covered in Q&A only to the level accepted by the deployed build.
