# Envoy submission checklist

## What it is

This is the release and evidence checklist for the Civic Technology submission. It separates the deployed core story from optional sponsor integrations, so the final description and prize choices match what judges can actually run.

## How it works

### Production run

- [ ] Open `https://envoy-web.pages.dev` on a clean browser and confirm the deployed commit/build.
- [ ] Confirm the production Worker responds from the Pages origin and the guest chat, source search, feedback, and receipt paths work end to end.
- [ ] Recheck source freshness. The 2026-09-26 snapshot had 65 Service BC office records, three current BC finder links, and one stale federal consultation finder. Do not call a finder an individual vacancy, award, or eligibility result.
- [ ] Submit one new, clearly labeled practice report, confirm its private receipt, and verify persistence after refresh. Keep the token private.
- [ ] Verify a new outbox event reaches Tiger; note synchronization time. The last read-only check showed two delivered events and two aggregate events, but a fresh report should change that count after delivery.
- [ ] Verify Workers AI in a new production conversation and retain a redacted capture of the reviewable proposal. The Toronto streetlight prompt was previously accepted; verify the final deployed build again.
- [ ] Check the English presentation path visually at desktop and mobile widths. Check the French critical flow for missing strings without delaying the English demo for cosmetic polish.
- [ ] If showing native iOS, complete the exact recorded journey on a physical device against production. A generic build alone is insufficient.

### Claim gates

| Claim or prize selection | Evidence required before selecting it                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Civic Technology         | A live resident-to-practice-workspace report and receipt, with explicit non-affiliation.                                                                                                       |
| Tiger Data               | A real feedback event in the hypertable and continuous aggregate, plus the deployed trend view if the video shows it. Two events were read from Tiger on 2026-09-26; capture the fresh result. |
| Auth0                    | A real hosted sign-in, accepted Worker token, one permitted scoped action, and one denied unauthorized action. Hosted login appearance alone is insufficient.                                  |
| ElevenLabs               | A real voice session with follow-up, transcript review, and a submitted feedback record. The current agent configuration alone is insufficient; the Worker still needs a durable API key.      |
| Presage                  | A consented, stable physical-iPhone SDK signal that changes the mobile writing interface. Compilation alone is insufficient.                                                                   |
| UI/UX                    | Deployed, visually checked resident and employee paths, with accessible text alternatives and clear practice/source labels.                                                                    |

Workers AI is part of the core product story and has a production proposal result; it is not listed as a separate prize in the current plan. Do not select an optional side challenge merely because its SDK, agent, UI, or configuration exists.

### Devpost and judging handoff

- [ ] Enter the Civic Technology main track; select only optional challenges whose claim gates above have passed.
- [ ] Add the final public web URL, repository URL, short project description, accurate architecture and team roster.
- [ ] Add the five-minute video after capturing and captioning actual working interactions. Check playback, audio, readability, and redaction; add the video URL to the final entry.
- [ ] Include one clear sentence that the practice organization/employer is fictional and unaffiliated with any municipality or government office. Describe external source links as handoffs, not completed applications or reports.
- [ ] Have another collaborator verify every sponsor and government-participation sentence against the footage and current build.
- [ ] Confirm the live presentation slot and the **current official** draft/final deadlines before submission. `PLAN.md` targets a Sunday draft and final submission; use the event guide for the actual deadline.
- [ ] Save a copy of the submitted text, selected tracks, URLs, and final video file/link for the team. Record the final submission receipt or confirmation.

If a provider or staff role cannot pass live acceptance, remove that demo segment and side-challenge selection. The public BC source, guest agent proposal, practice report, private receipt, and Tiger delivery can still make an honest core story. Do not submit a fabricated success capture to preserve a planned segment.

## How to change it

Tick an item only after the corresponding deployed observation, and store a timestamped redacted capture or command output in the team's private evidence folder. Update the snapshot counts and URLs before the video edit and again before judging. The presentation script is in [presentation.md](presentation.md); the capture order is in [video-storyboard.md](video-storyboard.md).

## Configuration

Use production Pages, Worker, and read-only Tiger access. Keep provider keys, JWTs, guest receipt tokens, résumés, and private report text out of the public entry and footage. The exact web/API URLs and deploy commands are in [Deployment](deployment.md). This checklist does not publish to Devpost or configure video hosting.

## Dependencies

The team needs the deployed Cloudflare stack, official BC source provenance, Workers AI availability, a working feedback/receipt path, Tiger query access, final video editing/export, and the current event submission guide. Auth0, ElevenLabs, Presage, and native device footage are optional only after their respective acceptance gates.
