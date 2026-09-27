# Envoy video production

## What it is

`apps/video` contains a 94-second motion revision for local review, the preserved 104-second first review cut, a 150-second comparison cut, and an 82-second offline stage aid. They combine genuine production interactions, exact source excerpts, ElevenLabs narration, captions, background music, and a licensed monitor mesh. The earlier five-minute `EnvoyReview` and gated `EnvoyEvidence` compositions remain as historical edits.

## How it works

`src/chat-film.tsx` defines eleven 1920×1080, 30 fps beats totaling 104 seconds. It follows a resident through Ottawa jobs, a separate BC application handoff, Ontario training support, a separate BC funding search, Ottawa Nearby, and a separate Toronto report proposal. The interface fills the frame at its native aspect ratio; the licensed model is a brief opening accent. The official job shot selects a published BC vacancy, opens `Prepare application`, and activates `Continue on official site`; Envoy does not record an application to that publisher. A distinct product-feedback shot records a real nonpersonal submission to **Envoy's review team**, with its private receipt identifier masked before it first appears. No municipality receives it. Opening, job, and closing assets were refreshed from `https://envoy.surf/` after the neutral-sidebar deploy.

`EnvoyChatFilmMotion` uses the same eleven recorded lines but retimes them to 94 seconds. Each window still exceeds its MP3 lead-in plus measured spoken duration. The Ottawa address appears briefly before the wider map; the final technical beats move from two-to-three-second syntax-colored source excerpts into a voice follow-up trace, D1-to-Tiger flow with an angled monitor, an illustrated SwiftUI phone flow, and the actual signed-out Envoy sign-in screen followed by the Worker authorization checks. These moving explanations are source-backed visualizations, not footage of a physical Presage reading, browser voice handoff, or accepted scoped staff action. No new ElevenLabs credits or AI requests are needed for this revision.

The Toronto assistant shot uses a current `envoy.surf` guest clip after the duplicate-check fix, with a pending, unsubmitted proposal. Current production Support and Nearby answers are source grounded; earlier failed answers and the Programs sample intake are excluded. The filtered Ottawa Nearby list confirms the office address; a separate wider map shows 78 places and is not presented as a pin for that office. The dated Tiger read-only query showed four delivered events and four aggregate events at 19:41 UTC on September 26; the film does not present this as a live staff dashboard. The ElevenLabs segment describes one verified fictional voice follow-up and signed session, while web voice handoff and voice-to-report acceptance remain unverified. Presage source establishes the native SwiftUI consent and layout wiring; no physical-iPhone measurement is claimed. The Auth0 segment shows hosted organization login, JWT, and membership code. A real scoped staff action has not been accepted.

`scripts/build-evidence-snippets.mjs` reads exact numbered source lines into `src/evidence-snippets.generated.json`; `src/syntax.tsx` colors TS, Swift, and SQL tokens without changing their text or spacing. The comparison cut now uses [CreativeTrio's CC0 Monitor](https://poly.pizza/m/PvSjEbz11k), a real GLB mesh with a static stand, rather than the former CSS monitor. `scripts/render-monitor-model.py` rasterizes the actual mesh locally into `public/models/creative-trio-monitor.png` and writes the projected screen corners to the companion JSON. The source GLB has SHA-256 `52e01381d65cbcab7d8c8551f594d6fe1a46f6737a6174c7714bda7700c7c729`. The screen uses an aspect-preserving crop of 1600×812 capture footage to fill the model's wider projected screen face edge to edge. Use the model for brief transitions and code accents; the revised film keeps core chat footage large and readable. Older footage receives a sidebar-only grayscale treatment so its earlier colored icons match current navigation; report text and service content are unchanged. Source and redaction audit: `apps/video/evidence/recut-captures-2026-09-26.json`.

For the motion revision, `scripts/render-monitor-turn.py` renders 25 camera angles from that same GLB, including the fixed stand. Each angle's actual projected screen corners are collected in `public/models/turn/manifest.json`; `src/monitor-turn.tsx` eases between frames and fills the mesh screen using those corners. The browser footage is cropped to the changing projected face without bars or stretching. `src/technical-motion.tsx` owns the source-backed voice, analytics, native-flow, and staff-access visualizations. The staff sign-in still was captured from `/signin` in an isolated guest browser without starting a login or acquiring a token; its hash and boundary are in `apps/video/evidence/current-signin-envoy-surf-2026-09-27.json`.

The [chat-centered script](video-script-review.md) has eleven lines recorded with four existing custom ElevenLabs voices, mapped in `src/chat-narration.generated.json`: robert for opening/jobs/training/closing, asdf for Nearby/Toronto concern/feedback, mp for voice/Tiger, and yo for Presage/Auth0. **External upload remains held for user review.** The brand is spoken **“on-voy”**: the TTS input uses phonetic `Onvoy` where needed, while captions and the product name remain spelled `Envoy`. `node apps/video/scripts/build-chat-narration.mjs` regenerates local MP3s at `public/narration-chat/` after checking that included credits are available and overage is disabled. The teammate-cloned standalone MP3s are Git ignored; only a reviewed mixed MP4 may be shared. Each scene starts speech at 0.6 seconds; captions split the display sentence into short groups. The bed is [“Your Breath” by Eugenio Mininni](https://mixkit.co/free-stock-music/corporate-music/) under the [Mixkit Stock Music Free License](https://mixkit.co/license/modal/musicFree/). It is mixed at linear volume `0.075` (about −22.5 dB) under voice volume `1`, with intro and outro fades. Mixkit permits use in online videos but not standalone music redistribution. The raw MP3 is ignored by Git. Place the licensed download at `apps/video/public/music-your-breath-mixkit.mp3` and verify SHA-256 `8b837348a9c5b61f359fa458af832bfe957f3da461039af3ba0ba6c6f467ed0e`.

## How to change it

1. Edit scene text, timing, or media in `src/chat-film.tsx`. `EnvoyChatFilmMotion` has 94-second windows; `EnvoyChatFilm` preserves the 104-second first cut. If a spoken sentence changes, regenerate affected ElevenLabs MP3s and the timed manifest together with `node apps/video/scripts/build-chat-narration.mjs`. Keep each scene longer than its audio end.
2. To update code excerpts, change line selections in `scripts/build-evidence-snippets.mjs` and run `node apps/video/scripts/build-evidence-snippets.mjs`. Inspect generated text for secrets before committing.
3. Capture current site candidates with `node apps/video/scripts/capture-production.mjs MODE`. Useful modes include `chat-jobs`, `chat-nearby`, `chat-issue`, `still-home`, `still-jobs`, `still-signin`, `still-nearby`, `job-flow`, `agent`, and `feedback`. The script uses an isolated headless Chrome profile at 1600×812 and writes candidate media plus action/hash sidecars under the system temporary directory. The two new still modes are read-only and make no AI calls. Inspect each answer before moving it into `public/`: an earlier Ottawa service answer falsely referenced British Columbia, and an Ottawa issue answer contained a municipality placeholder; neither is usable footage. `feedback-submit` **really submits a report**; use it only with nonpersonal test text, verify the Envoy-only destination, and redact receipt data before moving media into `public/`.
4. Obtain the music from the [official Mixkit listing](https://mixkit.co/free-stock-music/corporate-music/) or [official asset URL](https://assets.mixkit.co/music/634/634.mp3). Keep the raw MP3 in the ignored local path above; do not commit it or register it with Content ID.
5. Preview representative frames and the full audio mix. Check the job handoff, guest proposal, receipt masking, code legibility, subtitles, music level, and final domain. Keep the earlier video until the new export passes these checks.

To regenerate the angled monitor projection after replacing the GLB or camera angle:

```sh
python3 apps/video/scripts/render-monitor-model.py apps/video/public/models/creative-trio-monitor.glb apps/video/public/models/creative-trio-monitor.png -20 7
python3 apps/video/scripts/render-monitor-turn.py
```

These scripts currently read CreativeTrio's mesh layout, so a different model requires updating its screen-face vertex selection and projection logic. Preview opening and Tiger monitor angles after that change; the screen must have no bars or stretched browser UI.

From the repository root:

```sh
pnpm --filter @envoy/video typecheck
node apps/video/scripts/build-evidence-snippets.mjs
cd apps/video
./node_modules/.bin/remotion render src/index.ts EnvoyChatFilmMotion out/envoy-chat-motion-review-local.mp4 --codec h264 --x264-preset veryfast --browser-executable '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ffprobe -v error -show_entries format=duration,size -of json out/envoy-chat-motion-review-local.mp4
```

The exported MP4 in `out/` is ignored by Git. A presenter can play the reviewed file offline. `src/stage-fallback.tsx` also defines an 82-second, silent-narration stage aid using the current home, official job handoff, Nearby, guest assistant proposal, and a pre-receipt feedback review. Its music bed is low enough for the presenter to speak over. Render it with:

```sh
cd apps/video
./node_modules/.bin/remotion render src/index.ts EnvoyStageFallback out/envoy-stage-fallback.mp4 --codec h264 --x264-preset veryfast --browser-executable '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

It intentionally omits the private receipt and technical sponsor segment. The live presenter should explain that official applications continue on the publisher site and reports go to Envoy's own review team.

## Configuration

`ENVOY_CAPTURE_ORIGIN` defaults to `https://envoy.surf/`; `ENVOY_CAPTURE_OUTPUT_DIR` and `ENVOY_CHROME_PATH` override the candidate folder and Chrome executable. `pnpm-workspace.yaml` enforces `minimumReleaseAge: 20160`, `minimumReleaseAgeStrict: true`, and `minimumReleaseAgeIgnoreMissingTime: false`. Remotion and its CLI are pinned to `4.0.400`. No paid render service or new package is required. Music volume and scene lengths are constants in `src/chat-film.tsx`; monitor projection is the generated model JSON.

## Dependencies

The edit uses React, Remotion, Chrome, `ffmpeg`/`ffprobe`, Pillow for offline GLB rasterization, the deployed Envoy Worker, local ElevenLabs narration, the separately licensed Mixkit music bed, read-only Tiger evidence, and tracked production captures. Source-boundary details live in [the storyboard](video-storyboard.md), [voice intake](voice/elevenlabs-intake.md), [Tiger analytics](analytics/tiger-data.md), [native Presage accessibility](native-presage.md), and [authorization](authorization.md).
