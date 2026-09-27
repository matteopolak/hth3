# Envoy submission checklist

## What it is

This is the release and evidence checklist for the Civic Technology submission. It separates the deployed core story from optional sponsor integrations, so the final description and prize choices match what judges can actually run.

## How it works

### Production run

- [ ] Open `https://envoy.matteopolak.workers.dev/` on a clean browser and confirm the deployed commit/build. The combined Worker serves the web app and `/api/*`.
- [ ] Confirm guest chat, source search, feedback, and receipt paths work end to end from that one origin.
- [ ] Recheck source freshness. A read-only production API check at 02:44 UTC on 2026-09-27 returned **25 individual `job_posting` records** in Jobs. The earlier unified production view showed six job finders, four open consultations plus three official directories, and 78 Nearby results. A previous source snapshot had 65 Service BC office records. Keep finders distinct from individual vacancies, awards, or eligibility results.
- [ ] Submit one new non-emergency report to the Envoy review team, confirm its private receipt, and verify persistence after refresh. Keep the token private and make the destination clear.
- [ ] Verify a new outbox event reaches Tiger; note synchronization time. The 2026-09-26 19:41 UTC read-only check showed four delivered and four aggregate events, including submitted and classified events from an earlier Envoy report. Recheck before presenting.
- [ ] Retain the new production Workers AI bench proposal capture, with its Envoy-only destination and disabled Confirm button visible. The 2026-09-26 combined Worker version `837bf16a` returned this pending card; recheck the final deployed build before judging.
- [ ] Check the English presentation path visually at desktop and mobile widths. Check the French critical flow for missing strings without delaying the English demo for cosmetic polish.
- [ ] If showing native iOS, complete the exact recorded journey on a physical device against production. A generic build alone is insufficient.

### Claim gates

| Claim or prize selection | Evidence required before selecting it                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Civic Technology         | A live resident-to-Envoy report and receipt, with its Envoy-only destination and lack of government affiliation explicit.                                                                                                 |
| Tiger Data               | A real feedback event in the hypertable and continuous aggregate, plus the deployed trend view if the video shows it. Four events were read from Tiger at 19:41 UTC on 2026-09-26; capture a fresh result before judging. |
| Auth0                    | A real hosted sign-in, accepted Worker token, one permitted scoped action, and one denied unauthorized action. Hosted login appearance alone is insufficient.                                                             |
| ElevenLabs               | A real voice session with follow-up, transcript review, and a submitted feedback record. The Worker has issued a signed URL with a limited key; a full voice-to-feedback acceptance run is still needed.                  |
| Presage                  | A consented, stable physical-iPhone SDK signal that changes the mobile writing interface. Compilation alone is insufficient.                                                                                              |
| UI/UX                    | Deployed, visually checked resident and employee paths, with accessible text alternatives and clear source and report-destination labels.                                                                                 |

Workers AI is part of the core product story and has a production proposal result; it is not listed as a separate prize in the current plan. Do not select an optional side challenge merely because its SDK, agent, UI, or configuration exists.

### Devpost and judging handoff

- [x] Another session completed Devpost submission; the observer saw **SUBMITTED 5/5** without clicking the final Submit control. Project details contain the production web URL, story, code link, and gallery; team roster and Additional info are saved.
- [ ] Recheck the saved Civic Technology and optional sponsor selections against the claim gates above. Remove any unsupported selection if Devpost still permits an edit.
- [x] The final captioned video is hosted [unlisted on YouTube](https://youtu.be/R293-RLB3m8); its URL was saved in Devpost's Video demo link and confirmed again after reopening Project details. The matching [GitHub release MP4](https://github.com/matteopolak/hth3/releases/download/v0.1.0-hth3-review/envoy-review.mp4) is 299.733 seconds and has SHA-256 `80a7a1414d257e8fdf276095904f18cd481bc0aa187e60420fcef30cddd2be34`.
- [ ] Confirm judge playback from a signed-out browser, then review audio, captions, readability, redaction, and report-destination claims with the team. The current cut's Tiger card is dated, native screen is from a simulator, and staff access is explained rather than shown as accepted.
- [ ] Run one timed four-minute live rehearsal against the final combined Worker deploy, followed by three minutes of questions as required by the [official rules](https://hack-the-hill-iii.devpost.com/rules). Record any fallback used and confirm the backup tabs are ready before judges arrive.
- [ ] State clearly that no municipality or employer participates yet and that resident reports reach Envoy's team, not a government office. Describe external source links as handoffs, not completed applications or reports.
- [ ] Have another collaborator verify every sponsor and government-participation sentence against the footage and current build.
- [ ] Save a copy of the submitted text, selected tracks, URLs, and final video file/link for the team. Preserve the observed submission confirmation and verify whether the video field can still be updated. The [official rules](https://hack-the-hill-iii.devpost.com/rules) and [Devpost requirements](https://hack-the-hill-iii.devpost.com/) list **10:00 a.m. EDT on Sunday, September 27, 2026** for judging, earlier than the page banner's 11:00 a.m.; verify the on-site schedule separately.

If a provider or staff role cannot pass live acceptance, remove that segment and side-challenge selection. Public sources, the guest agent proposal, Envoy's report and receipt path, and dated Tiger delivery can still support the core story. Do not submit a fabricated success capture to preserve a planned segment.

### Devpost submission record and revision copy

The [envoy Devpost project](https://devpost.com/software/envoy-y5wgnv) showed **SUBMITTED 5/5** in the user's Chrome on September 26. Another session completed submission; the person checking this page did not click Submit. Project details show the production URL `https://envoy.matteopolak.workers.dev/`, story, GitHub link, and four gallery images. Additional info has **University of Ottawa**, **Carleton University**, `envoy.surf`, sponsor selections, and an AI-use explanation saved. The final [YouTube video](https://youtu.be/R293-RLB3m8) is unlisted; its URL was saved in the Video demo link and remained present after Project details was reopened. Signed-out judge playback and the timed live rehearsal still need confirmation. The [official rules](https://hack-the-hill-iii.devpost.com/rules) require a GitHub link and every teammate on the submission and specify a four-minute live presentation plus three minutes of questions.

**Team on the submitted entry:** Matthew Polak (`@matteopolak`), Raef Sarofiem (`@rsarofiem`), Robert Zuchniak (`@RZuchniak`), and Vasil Topalovic (`@vasiltop`).

The field copy below is proposed for an editable revision. It may differ from the text currently submitted; compare it with Devpost before changing anything.

**Project name:** envoy

**Tagline:** Find public services, understand the next step, and turn civic issues into reviewable feedback.

**Project story:**

> Finding the right public service can mean jumping between websites, interpreting unfamiliar language, and deciding which office can help. When something goes wrong, residents also need to know who will receive their report before they send it.
>
> envoy turns scattered public information into clear next steps. The live Jobs board has 25 individual postings; residents can also explore support and funding, find nearby services on a source-backed map, and follow official participation opportunities. A guest assistant streams responses and can turn a civic issue into an editable feedback proposal. The resident sees its destination and approves before anything is sent. People can submit non-emergency feedback to the Envoy review team and follow it with a private receipt. No municipality or employer participates today, and reports do not go to a government office. Official application and consultation links lead to their publishers; opening a link is never recorded as a submission.
>
> One Cloudflare Worker serves the web app and API. D1 stores sourced records, feedback, receipts, and reviewed assistant actions; R2 holds private files. Cloudflare Workers AI powers the assistants and feedback classification, with streaming responses and explicit approval cards for writes. A D1 outbox sends privacy-safe feedback events to Tiger Data for trends while report text stays out of analytics. We also built a native SwiftUI iOS companion on the same API.

**What was challenging:** Keeping source provenance and freshness visible, making AI suggestions reviewable, and showing the report's actual destination before submission.

**What we learned:** A civic interface has to tell residents where information came from, when it was checked, and who will actually receive a report. An AI suggestion is useful only when the person stays in control.

**AI use:** We used AI coding assistance to build and review the project. In Envoy, Cloudflare Workers AI helps interpret requests and prepare editable feedback proposals through typed tools. A person reviews the wording and destination before any write; the model does not submit a report on its own.

**Built with:** TypeScript, React, Cloudflare Workers, D1, R2, Workers AI, Tiger Data, SwiftUI, Auth0, Remotion. List ElevenLabs and Presage as demonstrated capabilities only after their live flows are verified.

**Submitted links and media:**

| Field           | Link or asset                                                                                                                                                      | Gate                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Code            | `https://github.com/matteopolak/hth3`                                                                                                                              | Include the repository link and confirm commits are within the event window.                            |
| Web app and API | `https://envoy.matteopolak.workers.dev/`                                                                                                                           | Combined Worker origin returned HTTP 200 on 2026-09-26; recheck critical flows before final submission. |
| Video           | [Unlisted YouTube](https://youtu.be/R293-RLB3m8); [matching GitHub MP4](https://github.com/matteopolak/hth3/releases/download/v0.1.0-hth3-review/envoy-review.mp4) | YouTube URL is saved in Devpost; verify signed-out judge playback.                                      |
| Gallery         | `apps/video/public/captures/color-home-2026-09-26.png`, `color-jobs-2026-09-26.png`, `color-nearby-2026-09-26.png`, `color-feedback-review-2026-09-26.png`         | Four images are saved on the submitted entry.                                                           |
| Team            | Matthew Polak `@matteopolak`; Raef Sarofiem `@rsarofiem`; Robert Zuchniak `@RZuchniak`; Vasil Topalovic `@vasiltop`                                                | All four were visible on the submitted entry.                                                           |

Additional info, the team roster, and the hosted video URL are saved. Audit the actual sponsor selections against the claim gates above; Tiger Data has dated event evidence, while Auth0, ElevenLabs, and Presage have separate live acceptance requirements. The timed live rehearsal remains pending.

## How to change it

Tick an item only after the corresponding deployed observation, and store a timestamped redacted capture or command output in the team's private evidence folder. Update the snapshot counts and URLs before the video edit and again before judging. The presentation script is in [presentation.md](presentation.md); the capture order is in [video-storyboard.md](video-storyboard.md).

## Configuration

Use the production combined Worker origin and read-only Tiger access. Keep provider keys, JWTs, guest receipt tokens, résumés, and private report text out of the public entry and footage. The exact web/API URLs and deploy commands are in [Deployment](deployment.md). This checklist does not publish to Devpost or configure video hosting.

## Dependencies

The team needs the deployed Cloudflare stack, official BC source provenance, Workers AI availability, a working feedback/receipt path, Tiger query access, final video editing/export, and the current event submission guide. Auth0, ElevenLabs, Presage, and native device footage are optional only after their respective acceptance gates.
