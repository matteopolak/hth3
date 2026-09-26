# Envoy submission checklist

## What it is

This is the release and evidence checklist for the Civic Technology submission. It separates the deployed core story from optional sponsor integrations, so the final description and prize choices match what judges can actually run.

## How it works

### Production run

- [ ] Open `https://civicresolve-api-production.matteopolak.workers.dev/` on a clean browser and confirm the deployed commit/build. The combined Worker serves the web app and `/api/*`.
- [ ] Confirm guest chat, source search, feedback, and receipt paths work end to end from that one origin.
- [ ] Recheck source freshness. The 2026-09-26 unified production view showed six job finders, four open consultations plus three official directories, and 78 Nearby results. A previous source snapshot had 65 Service BC office records. Do not call a finder an individual vacancy, award, or eligibility result.
- [ ] Submit one new, clearly labeled practice report, confirm its private receipt, and verify persistence after refresh. Keep the token private.
- [ ] Verify a new outbox event reaches Tiger; note synchronization time. The 2026-09-26 19:41 UTC read-only check showed four delivered and four aggregate events, including two sample events from the newly captured practice report. Recheck before presenting.
- [ ] Retain the new production Workers AI bench proposal capture, with its Envoy-only destination and disabled Confirm button visible. The 2026-09-26 combined Worker version `837bf16a` returned this pending card; recheck the final deployed build before judging.
- [ ] Check the English presentation path visually at desktop and mobile widths. Check the French critical flow for missing strings without delaying the English demo for cosmetic polish.
- [ ] If showing native iOS, complete the exact recorded journey on a physical device against production. A generic build alone is insufficient.

### Claim gates

| Claim or prize selection | Evidence required before selecting it                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Civic Technology         | A live resident-to-practice-workspace report and receipt, with explicit non-affiliation.                                                                                                                                  |
| Tiger Data               | A real feedback event in the hypertable and continuous aggregate, plus the deployed trend view if the video shows it. Four events were read from Tiger at 19:41 UTC on 2026-09-26; capture a fresh result before judging. |
| Auth0                    | A real hosted sign-in, accepted Worker token, one permitted scoped action, and one denied unauthorized action. Hosted login appearance alone is insufficient.                                                             |
| ElevenLabs               | A real voice session with follow-up, transcript review, and a submitted feedback record. The Worker has issued a signed URL with a limited key; a full voice-to-feedback acceptance run is still needed.                  |
| Presage                  | A consented, stable physical-iPhone SDK signal that changes the mobile writing interface. Compilation alone is insufficient.                                                                                              |
| UI/UX                    | Deployed, visually checked resident and employee paths, with accessible text alternatives and clear practice/source labels.                                                                                               |

Workers AI is part of the core product story and has a production proposal result; it is not listed as a separate prize in the current plan. Do not select an optional side challenge merely because its SDK, agent, UI, or configuration exists.

### Devpost and judging handoff

- [ ] Select the Civic Technology challenge; select only optional sponsor challenges whose claim gates above have passed.
- [ ] Add the final public web URL, repository URL, short project description, accurate architecture and team roster.
- [ ] Add the five-minute video after capturing and captioning actual working interactions. Check playback, audio, readability, and redaction; upload the approved cut to YouTube, Vimeo, or Youku and enter its share URL. [Devpost requires an embeddable video-host URL](https://help.devpost.com/article/85-uploading-a-demo-video); a local MP4 or GitHub asset is not accepted in its video field.
- [ ] Replace the current review cut's short clips, dated stills, draft macOS narration, and Tiger query card with complete accepted footage and approved narration. Check that the exported video is five minutes, English captions are in sync, and every practice/provider limitation visible on screen is also accurate in the spoken script.
- [ ] Run one timed four-minute live rehearsal against the final combined Worker deploy, followed by three minutes of questions as required by the [official rules](https://hack-the-hill-iii.devpost.com/rules). Record any fallback used and confirm the backup tabs are ready before judges arrive.
- [ ] Include one clear sentence that the practice organization/employer is fictional and unaffiliated with any municipality or government office. Describe external source links as handoffs, not completed applications or reports.
- [ ] Have another collaborator verify every sponsor and government-participation sentence against the footage and current build.
- [ ] Submit by **10:00 a.m. EDT on Sunday, September 27, 2026**. The [official rules](https://hack-the-hill-iii.devpost.com/rules) and the [Devpost requirements](https://hack-the-hill-iii.devpost.com/) say 10:00 a.m. for judging, while the page banner says 11:00 a.m.; use the earlier cutoff. Verify the on-site schedule separately.
- [ ] Save a copy of the submitted text, selected tracks, URLs, and final video file/link for the team. Record the final submission receipt or confirmation.

If a provider or staff role cannot pass live acceptance, remove that demo segment and side-challenge selection. The public BC source, guest agent proposal, practice report, private receipt, and Tiger delivery can still make an honest core story. Do not submit a fabricated success capture to preserve a planned segment.

### Copy-ready Devpost draft

The [envoy Devpost project](https://devpost.com/software/envoy-y5wgnv) was created in the user's signed-in Chrome on September 26 and remains a **draft**. The name, pitch, story, web link, and code link are saved. Civic Technology and the AI-use explanation are entered in the additional-info form but cannot be saved until the required team-school field is filled. Teammate accounts, gallery, hosted video, and final review also remain pending. Leave the final submission action untouched until the team has checked every field. The [official rules](https://hack-the-hill-iii.devpost.com/rules) require a GitHub link and every teammate on the submission; they allow up to four people per team. The rules specify a four-minute live presentation with three minutes for questions. The page banner shows an 11:00 a.m. deadline but both the rules and requirements say 10:00 a.m. EDT on September 27, 2026; use **10:00 a.m.**

**Project name:** envoy

**Tagline:** Find public services, understand the next step, and turn civic issues into reviewable feedback.

**Project story:**

> Finding the right public service often means jumping between websites, interpreting unfamiliar language, and deciding which office can help. When something goes wrong, people should be able to describe the issue in their own words and review the destination before sending anything.
>
> envoy brings those steps into one resident experience. Guests can browse official public source links, inspect Service BC locations with attribution and freshness, and ask an assistant about a civic issue. In a fresh production check, Workers AI prepared an editable, unsubmitted practice report proposal for a damaged bench at Nathan Phillips Square and showed Envoy as its destination. The model does not submit a report without a person's approval.
>
> The current report intake is a **practice workspace**. It uses real municipality names and sourced public information, but no municipality or employer is participating. Practice reports are stored in envoy and do not reach a government office. An earlier non-emergency practice report produced a private receipt; D1 kept the case and an outbox delivered privacy-safe feedback events to Tiger Data. A dated read-only query confirmed the submitted and classified events. We keep resident message bodies out of Tiger.
>
> The web experience is served from one Cloudflare Worker, with D1, R2, and Workers AI behind it and Tiger Data for event analytics. A native SwiftUI companion and Auth0-backed staff access are being developed, but device and live staff-role acceptance are still pending. Voice and sensing integrations are also pending complete live acceptance. Our next step is to connect an actual participating organization and verify the resident-to-staff journey with them.

**What was challenging:** Keeping source provenance and freshness visible, making AI suggestions reviewable, and separating a working practice intake from any claim of government delivery.

**What we learned:** A civic interface has to tell residents where information came from, when it was checked, and who will actually receive a report. An AI suggestion is useful only when the person stays in control.

**Built with:** TypeScript, React, Cloudflare Workers, D1, R2, Workers AI, Tiger Data, SwiftUI, Auth0, Remotion. List ElevenLabs and Presage only after the final draft explicitly distinguishes configuration from completed live behavior.

**Links to enter:**

| Field           | Link or asset                                                                                                                                             | Gate                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Code            | `https://github.com/matteopolak/hth3`                                                                                                                     | Include the repository link and confirm commits are within the event window.                            |
| Web app and API | `https://civicresolve-api-production.matteopolak.workers.dev/`                                                                                            | Combined Worker origin returned HTTP 200 on 2026-09-26; recheck critical flows before final submission. |
| Video           | `apps/video/out/envoy-review.mp4` is a **local draft only**                                                                                               | Upload an approved five-minute export to YouTube, Vimeo, or Youku; verify public embedding and paste the share URL.                                   |
| Gallery         | `apps/video/public/captures/unified-home-2026-09-26.png`, `unified-jobs-2026-09-26.png`, `unified-participation-2026-09-26.png`, `unified-nearby-2026-09-26.png` | Use current unified-production frames and keep the official handoff clear.                                   |
| Team            | Every actual teammate's Devpost account                                                                                                                   | Do not invent names or omit collaborators.                                                              |

For the initial draft, choose the **Civic Technology** challenge and keep optional sponsor selections unselected until their claim gates above pass on the final deploy. Tiger Data has dated event evidence; recheck it and the visible analytics route before selecting that prize. Auth0, ElevenLabs, and Presage still need their live acceptance steps. The Devpost description should be refreshed once the final video and production URLs are ready.

## How to change it

Tick an item only after the corresponding deployed observation, and store a timestamped redacted capture or command output in the team's private evidence folder. Update the snapshot counts and URLs before the video edit and again before judging. The presentation script is in [presentation.md](presentation.md); the capture order is in [video-storyboard.md](video-storyboard.md).

## Configuration

Use the production combined Worker origin and read-only Tiger access. Keep provider keys, JWTs, guest receipt tokens, résumés, and private report text out of the public entry and footage. The exact web/API URLs and deploy commands are in [Deployment](deployment.md). This checklist does not publish to Devpost or configure video hosting.

## Dependencies

The team needs the deployed Cloudflare stack, official BC source provenance, Workers AI availability, a working feedback/receipt path, Tiger query access, final video editing/export, and the current event submission guide. Auth0, ElevenLabs, Presage, and native device footage are optional only after their respective acceptance gates.
