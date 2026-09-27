# Envoy launch video storyboard

## What it is

This is the scene map for the approved 94-second [chat-centered Envoy film](https://youtu.be/7arR-ro1gS8). It preserves the 104-second first review file and uses the same four recorded voices. It starts with questions and actions shown in the deployed product, then uses short source-code inserts and moving, source-backed explanations for ElevenLabs, Tiger, Presage, and Auth0. The earlier 150-second `EnvoyRecut` is a comparison cut.

## How it works

| Order | Resident action or decision              | Visual and factual boundary                                                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Ask which City of Ottawa jobs are open   | Full-screen, current guest chat: ten individual roles with closing dates and a ten-source panel. Start on the actual typed question; no unrelated menu clicks.                                                                                                                                                                                                          |
| 2     | Decide whether to prepare an application | A separate source-linked BC vacancy shows `Prepare application` and `Continue on official site`. Label the location change. Envoy does not submit the external application.                                                                                                                                                                                             |
| 3     | Ask about training and funding           | Current guest clips show the official Better Jobs Ontario answer, then a clearly labeled separate BC StudentAid grants answer. The generic “preview ready” failure and the Programs practice intake are excluded.                                                                                                                                                       |
| 4     | Find an in-person service                | Current chat returns ServiceOntario on St. Joseph Boulevard with an official Ontario link. Briefly show the Ottawa-filtered address, then move to a separate unfiltered map with 78 source-backed places. Do not imply the single Ottawa result is pinned on that wider map.                                                                                            |
| 5     | Raise a separate Toronto concern         | The existing Nathan Phillips Square bench chat shows a pending editable Envoy proposal. No report was submitted and no Toronto office receives it. Do not narrate a duplicate match that is not visible.                                                                                                                                                                |
| 6     | See what submission means                | One distinct, nonpersonal product-feedback note was actually sent to Envoy's own review team. The private receipt identifier is masked throughout the shot.                                                                                                                                                                                                             |
| 7     | See the technical choices                | Start each beat with a brief syntax-colored code excerpt. Then animate the verified voice follow-up, the D1-to-Tiger event boundary with the angled mesh monitor, the illustrated SwiftUI consent/layout flow in a modeled phone, and the actual guest sign-in page plus Worker access checks. None depicts a physical Presage reading or authenticated staff mutation. |
| 8     | Choose a next step                       | Return to readable full-screen chat and `envoy.surf`. No claim of participating municipality or employer.                                                                                                                                                                                                                                                               |

Core chat footage occupies most of the 1920×1080 canvas so it can be read. The [CreativeTrio CC0 monitor GLB](https://poly.pizza/m/PvSjEbz11k) appears in the opening and Tiger explanation; 25 locally rendered camera angles turn the actual mesh while the stand remains attached. Every projected screen is filled with an aspect-preserving crop, without bars or stretched browser controls. A modeled phone illustrates source-backed SwiftUI steps rather than a live camera result. The spoken [script](video-script-review.md) follows the same actions. Four teammate voices supply narration; the Mixkit bed stays under speech. Asset hashes and redaction notes are in `apps/video/evidence/recut-captures-2026-09-26.json`.

The final local render is for user review. External release replacement, YouTube upload, and Devpost video changes remain on hold until that review.

### Existing offline stage aid

`EnvoyStageFallback` is an 82-second talk-over aid using verified resident footage: current opening, official job selection/preparation, Nearby, assistant proposal, and Envoy-only feedback review. It ends before a private receipt appears. It is a separate, already rendered local file, not a claim that an external application or government report succeeded.

## How to change it

Match every spoken sentence to the specific observed shot in [the script review](video-script-review.md). Capture a corrected answer before replacing any failed chat clip. Change the relevant scene and clip timing in `apps/video/src/`, then regenerate only affected narration clips and captions. If source lines move, run `node apps/video/scripts/build-evidence-snippets.mjs` and inspect the generated output for secrets. Check every receipt frame before local export.

## Configuration

The production origin is `https://envoy.surf/`. Captures are 1600×812, local film output is 1920×1080 at 30 fps, and the final duration must be at most five minutes. The pnpm workspace enforces a strict two-week minimum package release age. Raw custom voice MP3s and the licensed standalone music bed are ignored local inputs; only a reviewed mixed video may be shared. Capture, model, and render commands are in [video production](video-production.md).

## Dependencies

The sequence relies on the combined Worker web/API, official job and service sources, guest Workers AI, D1 report/outbox implementation, dated Tiger query, SwiftUI source, Auth0 code/configuration, ElevenLabs voice output, Remotion, Chrome, and local `ffmpeg` for verification.
