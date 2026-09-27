# Envoy video production

## What it is

`apps/video` contains a 150-second comparison cut, an 82-second offline stage aid, and the assets for a new chat-centered local review film. They combine genuine production interactions, exact source excerpts, ElevenLabs narration, captions, background music, and a licensed monitor mesh. The earlier five-minute `EnvoyReview` and gated `EnvoyEvidence` compositions remain as historical edits.

## How it works

`src/recut.tsx` defines nine 1920×1080, 30 fps scenes: opening, official sources, guest assistant, submitted feedback, ElevenLabs, Tiger, Presage, Auth0/staff, and closing. The first four show the working resident path. The official job shot selects a published BC vacancy, opens `Prepare application`, and activates `Continue on official site`; Envoy does not record an application to that publisher. The feedback shot is a real nonpersonal product-feedback submission to **Envoy's review team**, with its private receipt identifier masked before it first appears. No municipality receives it. Opening, job, and closing assets were refreshed from `https://envoy.surf/` after the neutral-sidebar deploy.

The assistant shot uses a current `envoy.surf` guest clip after the duplicate-check fix, with a pending, unsubmitted proposal. One failed attempt before that fix was excluded. The dated Tiger read-only query showed four delivered events and four aggregate events at 19:41 UTC on September 26; the film does not present this as a live staff dashboard. The ElevenLabs segment describes one verified fictional voice follow-up and signed session, while web voice handoff and voice-to-report acceptance remain unverified. Presage code and a separate SwiftUI **Nearby simulator** screen establish the native build and SDK wiring; no physical-iPhone measurement is claimed. The Auth0 segment shows hosted organization login, JWT, membership, assignment, and reply code. A real scoped staff login/action has not been accepted.

`scripts/build-evidence-snippets.mjs` reads exact numbered source lines into `src/evidence-snippets.generated.json`; `src/syntax.tsx` colors TS, Swift, and SQL tokens without changing their text or spacing. The comparison cut now uses [CreativeTrio's CC0 Monitor](https://poly.pizza/m/PvSjEbz11k), a real GLB mesh with a static stand, rather than the former CSS monitor. `scripts/render-monitor-model.py` rasterizes the actual mesh locally into `public/models/creative-trio-monitor.png` and writes the projected screen corners to the companion JSON. The source GLB has SHA-256 `52e01381d65cbcab7d8c8551f594d6fe1a46f6737a6174c7714bda7700c7c729`. The screen uses an aspect-preserving crop of 1600×812 capture footage to fill the model's wider projected screen face edge to edge. Use the model for brief transitions and code accents; the revised film keeps core chat footage large and readable. Older footage receives a sidebar-only grayscale treatment so its earlier colored icons match current navigation; report text and service content are unchanged. Source and redaction audit: `apps/video/evidence/recut-captures-2026-09-26.json`.

The current comparison narration uses four existing custom ElevenLabs voices, mapped in `src/custom-narration.generated.json`: robert for opening/sources/closing, asdf for assistant/feedback, mp for ElevenLabs/Tiger, and yo for Presage/Auth0. A revised [chat-centered script](video-script-review.md) can be synthesized and rendered locally after its footage is grounded; **external upload remains held for user review**. The brand is spoken **“on-voy”**: the TTS input uses phonetic `onvoy` where needed, while captions and the product name remain spelled `Envoy`. `node apps/video/scripts/build-custom-narration.mjs` regenerates the local MP3s at `public/narration-custom/` after checking that included credits are available and overage is disabled. The teammate-cloned standalone MP3s are Git ignored; the reviewed MP4 contains the approved mixed performance. Each scene starts speech at 0.6 seconds; captions split the display sentence into short groups. The bed is [“Your Breath” by Eugenio Mininni](https://mixkit.co/free-stock-music/corporate-music/) under the [Mixkit Stock Music Free License](https://mixkit.co/license/modal/musicFree/). It is mixed at linear volume `0.075` (about −22.5 dB) under voice volume `1`. Mixkit permits use in online videos but not standalone music redistribution. The raw MP3 is ignored by Git. Place the licensed download at `apps/video/public/music-your-breath-mixkit.mp3` and verify SHA-256 `8b837348a9c5b61f359fa458af832bfe957f3da461039af3ba0ba6c6f467ed0e`.

## How to change it

1. Edit scene text, timing, or media in `src/recut.tsx`. If a spoken sentence changes, regenerate affected ElevenLabs MP3s and the timed manifest together with `node apps/video/scripts/build-custom-narration.mjs`. Keep each scene longer than its audio end. The current windows total 150 seconds.
2. To update code excerpts, change line selections in `scripts/build-evidence-snippets.mjs` and run `node apps/video/scripts/build-evidence-snippets.mjs`. Inspect generated text for secrets before committing.
3. Capture current site candidates with `node apps/video/scripts/capture-production.mjs MODE`. Useful modes include `chat-jobs`, `chat-nearby`, `chat-issue`, `still-home`, `still-nearby`, `job-flow`, `agent`, and `feedback`. The script uses an isolated headless Chrome profile at 1600×812 and writes candidate media plus action/hash sidecars under the system temporary directory. Inspect each answer before moving it into `public/`: an earlier Ottawa service answer falsely referenced British Columbia, and an Ottawa issue answer contained a municipality placeholder; neither is usable footage. `feedback-submit` **really submits a report**; use it only with nonpersonal test text, verify the Envoy-only destination, and redact receipt data before moving media into `public/`.
4. Obtain the music from the [official Mixkit listing](https://mixkit.co/free-stock-music/corporate-music/) or [official asset URL](https://assets.mixkit.co/music/634/634.mp3). Keep the raw MP3 in the ignored local path above; do not commit it or register it with Content ID.
5. Preview representative frames and the full audio mix. Check the job handoff, guest proposal, receipt masking, code legibility, subtitles, music level, and final domain. Keep the earlier video until the new export passes these checks.

To regenerate the angled monitor projection after replacing the GLB or camera angle:

```sh
python3 apps/video/scripts/render-monitor-model.py apps/video/public/models/creative-trio-monitor.glb apps/video/public/models/creative-trio-monitor.png -20 7
```

The script currently reads CreativeTrio's mesh layout, so a different model requires updating its screen-face vertex selection and projection logic. Preview open/chat/code frames after that change; the screen must have no bars or stretched browser UI.

From the repository root:

```sh
pnpm --filter @envoy/video typecheck
node apps/video/scripts/build-evidence-snippets.mjs
cd apps/video
./node_modules/.bin/remotion render src/index.ts EnvoyRecut out/envoy-recut-review.mp4 --codec h264 --x264-preset veryfast --browser-executable '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ffprobe -v error -show_entries format=duration,size -of json out/envoy-recut-review.mp4
```

The exported MP4 in `out/` is ignored by Git. A presenter can play the reviewed file offline. `src/stage-fallback.tsx` also defines an 82-second, silent-narration stage aid using the current home, official job handoff, Nearby, guest assistant proposal, and a pre-receipt feedback review. Its music bed is low enough for the presenter to speak over. Render it with:

```sh
cd apps/video
./node_modules/.bin/remotion render src/index.ts EnvoyStageFallback out/envoy-stage-fallback.mp4 --codec h264 --x264-preset veryfast --browser-executable '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

It intentionally omits the private receipt and technical sponsor segment. The live presenter should explain that official applications continue on the publisher site and reports go to Envoy's own review team.

## Configuration

`ENVOY_CAPTURE_ORIGIN` defaults to `https://envoy.surf/`; `ENVOY_CAPTURE_OUTPUT_DIR` and `ENVOY_CHROME_PATH` override the candidate folder and Chrome executable. `pnpm-workspace.yaml` enforces `minimumReleaseAge: 20160`, `minimumReleaseAgeStrict: true`, and `minimumReleaseAgeIgnoreMissingTime: false`. Remotion and its CLI are pinned to `4.0.400`. No paid render service or new package is required. Music volume and scene lengths are constants in `src/recut.tsx`; monitor projection is the generated model JSON.

## Dependencies

The edit uses React, Remotion, Chrome, `ffmpeg`/`ffprobe`, the deployed Envoy Worker, local ElevenLabs narration, the separately licensed Mixkit music bed, read-only Tiger evidence, and tracked production captures. Source-boundary details live in [the storyboard](video-storyboard.md), [voice intake](voice/elevenlabs-intake.md), [Tiger analytics](analytics/tiger-data.md), [native Presage accessibility](native-presage.md), and [authorization](authorization.md).
