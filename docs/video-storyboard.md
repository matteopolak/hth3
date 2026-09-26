# Envoy video storyboard

## What it is

A five-minute capture plan for a Devpost video made from actual product interactions. Motion graphics may explain navigation or architecture, but they cannot depict a successful provider call or submission that did not happen.

## How it works

Capture at readable desktop resolution and keep the visible browser origin when practical. Record a clean English run first. Add captions after editing. Use this order; trim or replace a shot when the current build cannot perform it live.

| Time      | Picture and narration                                                                                                                                                                        | Capture and evidence slot                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Open Envoy and show the guest entry point. State that the organization is a practice workspace with no government partner.                                                                   | `[FOOTAGE-01: deployed Pages landing and URL]`                                                                                               |
| 0:30–1:25 | Search an official BC finder, then open a Service BC office detail and source link. Explain the distinction between a finder link and a live vacancy or benefit decision.                    | `[FOOTAGE-02: search, source attribution, last checked, official handoff]` `[EVIDENCE-02: source API response and capture date]`             |
| 1:25–2:15 | Enter a Toronto service problem in guest chat. Show the Workers AI recommendation and the proposed report before approval.                                                                   | `[FOOTAGE-03: new production conversation, prompt, proposal]` `[EVIDENCE-03: response status, no private conversation token]`                |
| 2:15–3:05 | Review and submit a non-emergency practice report; show the receipt and status. Never display its secret token.                                                                              | `[FOOTAGE-04: review, practice notice, submission, redacted receipt]` `[EVIDENCE-04: live Worker response and persisted case]`               |
| 3:05–3:50 | Show the privacy-safe event arriving in Tiger and the trend view if its scoped API is accepted. Overlay a small diagram: D1 case → outbox → Tiger event.                                     | `[FOOTAGE-05: read-only Tiger query or accepted staff trend view]` `[EVIDENCE-05: event ID, aggregate count, capture time; no message body]` |
| 3:50–4:35 | If real Auth0 staff sign-in and authorization are accepted, show a staff reply and the resident update. Otherwise return to the resident view and explain the role boundary in one sentence. | `[FOOTAGE-06: accepted scoped action and receipt update, only if verified]`                                                                  |
| 4:35–5:00 | Show the source and receipt side by side, then close with the actual implemented capabilities and limitations.                                                                               | `[FOOTAGE-07: final deployed UI]`                                                                                                            |

Optional insertions replace time inside the five minutes only after live acceptance: an ElevenLabs voice follow-up with real transcript and reviewed submission; a physical-iPhone Presage reading that offers the calmer editor; a native SwiftUI application journey against the deployed API; or an Auth0 role denial paired with a permitted action. Never fill a missing segment with a mock provider response, synthetic success animation, or local development identity. Mark any practice person, employer, report, or posting clearly at the record and action.

As of 2026-09-26, the safe footage candidates are the Pages site, BC records (65 Service BC offices and three verified finder links), the production Workers AI proposal, and practice feedback with Tiger event delivery. Tiger had two delivered events at the last read-only check. Auth0, ElevenLabs, Presage, and native device flows remain conditional. The federal consultation finder is stale; it should be shown as such if it appears. The current repository has no Remotion project or `video:render` script, so this document does not imply that a render exists.

## How to change it

Replace each bracketed slot with the path or timestamp of a genuine screen capture and the corresponding verification note. Update the spoken line if the underlying behavior changes. If time is tight, use a straight screen recording with captions; introduce Remotion only if it can be completed without taking time from the working build. Check legibility at normal playback size and rehearse the full five minutes once after the final edit.

## Configuration

Capture the production Pages origin and Worker API in English. Blur guest receipt tokens, Auth0 bearer tokens, provider keys, and personal résumé contents before exporting. Keep a local capture log with build commit, capture date, URL, and whether the shot was live, cut from a genuine recording, or a diagram. No video editor or upload target is configured by this document.

## Dependencies

The core shots require the deployed web client, Worker, official source records, Workers AI, D1 feedback, and Tiger read-only access. Conditional shots require their respective live provider credentials and accepted device or role workflow. See [the presentation run](presentation.md) and [submission checklist](submission-checklist.md).
