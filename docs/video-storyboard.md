# Envoy video storyboard

## What it is

A five-minute scene map for the current Envoy Remotion review cut and its final capture pass. Product recordings carry the story; motion graphics explain evidence and boundaries without depicting an action that did not happen.

## How it works

The review cut has synchronized English narration and captions. It uses a consistent monitor for web footage, a phone model for the SwiftUI simulator screen, and color motion around the devices. The scene order and current evidence are:

| Time      | Story beat                                                                            | Current review media and boundary                                                                 |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Open Envoy and show its guest entry point.                                            | Current local color UI recording.                                                                 |
| 0:30–1:25 | Move through official job finders, consultations, Nearby, and the native map.         | Local animated route recording and actual iPhone simulator screen; official links are handoffs.   |
| 1:25–2:15 | Ask the resident agent about a damaged bench and inspect the proposed report.         | Unified production Worker recording on version `302031ab`; Confirm stays disabled, no submission. |
| 2:15–3:05 | Write a non-emergency report and inspect the Envoy-only review screen.                | Current local recording stops before submission; no new receipt is shown.                         |
| 3:05–3:50 | Explain D1 outbox delivery and the dated Tiger aggregate observation.                 | Read-only 19:41 UTC query card, four delivered and four aggregate events from an earlier report.  |
| 3:50–4:35 | Explain staff authorization and what still needs live acceptance.                     | Auth0–Worker–D1 diagram, not footage of a signed-in staff session.                                |
| 4:35–5:00 | Close on Envoy's current sources and report review, with the delivery boundary clear. | Current color UI stills; no government delivery is implied.                                       |

Optional insertions replace time inside the five minutes only after live acceptance: an ElevenLabs voice follow-up with real transcript and reviewed submission; a physical-iPhone Presage reading that offers the calmer editor; a native SwiftUI application journey against the deployed API; or an Auth0 role denial paired with a permitted action. Never fill a missing segment with a mock provider response, synthetic success animation, or local development identity. Mark any practice person, employer, report, or posting clearly at the record and action.

All active web recordings were captured September 26. The local build showed five job finders, four open consultations, and thirteen Nearby results; these are local counts, not production totals. The iPhone simulator screen does not establish physical-device or production API acceptance. Auth0, ElevenLabs, and Presage flows remain conditional. The [Remotion project](video-production.md) records asset origins, hashes, and render commands. For a hosted final video, the team must approve narration and decide whether to keep the clearly bounded review scenes or record additional accepted report, Tiger, and staff actions.

## How to change it

Use `apps/video/evidence/color-browser-captures-2026-09-26.json` to locate and verify the active recordings. Update the spoken line, regenerate its audio and captions, and rerender if behavior changes. For a new accepted action, record its origin, build, timestamp, and redacted evidence in `capture-manifest.json`. Check legibility at normal playback size and rehearse the full five minutes after the final edit.

## Configuration

Capture the combined production Worker origin in English for the final pass. Blur guest receipt tokens, Auth0 bearer tokens, provider keys, and personal résumé contents before exporting. Keep the capture log with build commit, capture date, URL, and whether the shot was live, cut from a genuine recording, or a diagram. The composition and local render commands live in [video-production.md](video-production.md); external video hosting is still pending.

## Dependencies

The core shots require the deployed web client, Worker, official source records, Workers AI, D1 feedback, and Tiger read-only access. Conditional shots require their respective live provider credentials and accepted device or role workflow. See [the presentation run](presentation.md) and [submission checklist](submission-checklist.md).
