# Envoy video storyboard

## What it is

A five-minute capture plan for a Devpost video made from actual product interactions. Motion graphics may explain navigation or architecture, but they cannot depict a successful provider call or submission that did not happen.

## How it works

Capture at readable desktop resolution and keep the visible browser origin when practical. Record a clean English run first. Add captions after editing. Use this order; trim or replace a shot when the current build cannot perform it live.

| Time      | Picture and narration                                                                                                                                                                                               | Capture and evidence slot                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Open Envoy and show the guest entry point. State that no municipality or employer participates yet.                                                                                                                 | `[FOOTAGE-01: deployed combined Worker landing and URL]`                                                                                     |
| 0:30–1:25 | Show official job finders, open public consultations, then a Service BC office detail and source link. Explain the difference between a source handoff and a completed application or consultation response.        | `[FOOTAGE-02: search, source attribution, last checked, official handoff]` `[EVIDENCE-02: source API response and capture date]`             |
| 1:25–2:15 | Ask about reporting a damaged bench in guest chat. Show the pending approval card, editable words, Envoy-only destination, and disabled Confirm button.                                                             | `[FOOTAGE-03: production prompt and pending approval card, no submission]` `[EVIDENCE-03: response status, no private conversation token]`   |
| 2:15–3:05 | Review a non-emergency report and its Envoy-only destination. For a complete final capture, submit a clearly marked fictional record and show a receipt with its private identifier hidden.                         | `[FOOTAGE-04: review, submission, redacted receipt]` `[EVIDENCE-04: live Worker response and persisted case]`                                |
| 3:05–3:50 | Show the privacy-safe event arriving in Tiger and the trend view if its scoped API is accepted. Overlay a small diagram: D1 case → outbox → Tiger event.                                                            | `[FOOTAGE-05: read-only Tiger query or accepted staff trend view]` `[EVIDENCE-05: event ID, aggregate count, capture time; no message body]` |
| 3:50–4:35 | If real Auth0 staff sign-in and authorization are accepted, show a staff reply and the resident update. Otherwise show a labeled authorization diagram and explain the pending role-token and scoped-action checks. | `[FOOTAGE-06: accepted scoped action and receipt update, only if verified]`                                                                  |
| 4:35–5:00 | Show official sources and Envoy's review screen, then close with the actual implemented capabilities and limitations.                                                                                               | `[FOOTAGE-07: final deployed UI]`                                                                                                            |

Optional insertions replace time inside the five minutes only after live acceptance: an ElevenLabs voice follow-up with real transcript and reviewed submission; a physical-iPhone Presage reading that offers the calmer editor; a native SwiftUI application journey against the deployed API; or an Auth0 role denial paired with a permitted action. Never fill a missing segment with a mock provider response, synthetic success animation, or local development identity. Mark any practice person, employer, report, or posting clearly at the record and action.

On September 26 local time, the review cut recorded current local color UI for guest entry, Jobs, Participation, Nearby, and feedback review. The updated source clip shows route transitions. A separate unified production Worker recording on version `302031ab` shows a pending bench approval card with Envoy-only destination and no submission. The feedback clip also ends before submission. The local build showed five job finders, four open consultations, and thirteen Nearby results; these are local counts, not production totals. A dated Tiger snapshot at 19:41 UTC showed four delivered events and four aggregate events, including two events from an earlier Envoy report. The older submitted-action and receipt screenshots are excluded from the active cut because their UI and wording are dated and a private receipt identifier is visible. An iPhone simulator Nearby screenshot appears in a phone model; it does not prove physical-device or production API acceptance. Auth0, ElevenLabs, and Presage flows remain conditional. The [Remotion project](video-production.md) records the exact asset origins and still needs complete final footage and approved narration.

## How to change it

Replace each bracketed slot with the path or timestamp of a genuine screen capture and the corresponding verification note. Update the spoken line if the underlying behavior changes. If time is tight, use a straight screen recording with captions; introduce Remotion only if it can be completed without taking time from the working build. Check legibility at normal playback size and rehearse the full five minutes once after the final edit.

## Configuration

Capture the combined production Worker origin in English. Blur guest receipt tokens, Auth0 bearer tokens, provider keys, and personal résumé contents before exporting. Keep a local capture log with build commit, capture date, URL, and whether the shot was live, cut from a genuine recording, or a diagram. No video editor or upload target is configured by this document.

## Dependencies

The core shots require the deployed web client, Worker, official source records, Workers AI, D1 feedback, and Tiger read-only access. Conditional shots require their respective live provider credentials and accepted device or role workflow. See [the presentation run](presentation.md) and [submission checklist](submission-checklist.md).
