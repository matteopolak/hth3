# Evidence-backed video production

## What it is

`apps/video` is a five-minute Remotion edit for Envoy's Civic Technology submission. Its current cut combines deployed-site recordings, an iPhone simulator still, and a dated, read-only Tiger query. Synchronized narration and English captions make it watchable now. The final-evidence render command remains gated on complete scene recordings and approved narration.

## How it works

The `EnvoyEvidence` composition is 1920×1080 at 30 frames per second and exactly 300 seconds. A second `EnvoyReview` composition runs the same 300-second story at 15 frames per second for a faster review export. Seven scenes follow [the storyboard](video-storyboard.md): guest entry, official sources, resident agent interaction, feedback review, Tiger delivery, staff access boundary, and closing. `EnvoyReview` uses the verified recordings in `src/draft-clips.ts`, current UI stills, a dated Tiger query card, and the staff authorization graphic. Its sentence audio in `public/narration-draft/` matches the captions in `src/draft-narration.generated.json`. The monitor's inner viewport matches the 1600×812 browser captures (about 1.9704:1). Media uses aspect-preserving `objectFit: cover`, so these recordings and stills fill it without stretching, letterboxing, or clipping the sidebar. The one 1600×813 Nearby still differs by a single pixel. The native SwiftUI still sits inside a phone model with a separate readable map crop. Remotion animates SVG paint shapes behind the devices and on the opening and closing cards. The staff scene shows an Auth0–Worker–D1 authorization graphic while live role-token and scoped-action acceptance is pending; it does not depict a staff session. `EnvoyEvidence` uses full recordings only when `capture-manifest.json` marks each slot `captured`. All required slots and approved narration are needed for its final render.

The final gate checks local file existence, nonempty content, a recording date, and a human evidence note. It cannot prove that a recording is authentic: review the actual media and narration against current product behavior before publishing. The composition mutes clip audio so the single voiceover and on-screen captions stay intelligible. Keep each clip at least as long as its scene (30, 55, 50, 50, 45, optional 45, and 25 seconds respectively) and the narration at least five minutes, or edit the scene timing and script together.

The selected web assets were captured from the public Worker on September 26 local time. Isolated Chrome recorded the guest composer and its menus (24 seconds), Jobs → Participation → Nearby navigation (41 seconds), a pending resident assistant proposal (50 seconds), and feedback entry through review (40 seconds). The site showed 25 individual official job postings, four open consultations, and 78 Nearby results at capture time. Neither the assistant proposal nor feedback review was submitted. Hashes, origins, and visible actions are in `apps/video/evidence/production-browser-captures-2026-09-26.json`. The closing card uses `envoy.matteopolak.workers.dev`; older captures remain archived in `apps/video/evidence/` but are excluded from the active cut. A separate native SwiftUI Nearby screenshot appears in a phone model with a readable map crop. It comes from an iPhone simulator and a separate build; its displayed location count is not the current web result count. Its exact API origin was not independently checked for this edit, and it does not establish physical-device acceptance. The Tiger evidence files contain a read-only query taken at 19:41 UTC: four delivered events and four aggregate events, including submitted and classified events for an earlier Envoy report. This is a dated query result, not staff dashboard footage. The local macOS `say` narration is not an ElevenLabs voice demo or evidence of voice intake acceptance. Auth0 role-token acceptance, ElevenLabs live voice submission, and a physical-device Presage result remain pending; no scene depicts them as completed.

## How to change it

1. Record the deployed product, redact private receipt tokens, JWTs, résumé data, and provider keys, then place the recordings in `apps/video/public/captures/`. Record the voiceover from the verified [presentation script](presentation.md).
2. Edit `apps/video/narration-draft.json` to change a spoken sentence, then run `pnpm --filter @envoy/video narration:draft` on macOS. The generator uses the local `Daniel` voice, `ffmpeg`, and `ffprobe`; it stops if a sentence overflows its scene. The generated audio and timed caption manifest are committed for repeatable review. Replace them with an approved final voiceover before final submission.
3. For each scene in `apps/video/capture-manifest.json`, set `status` to `captured`, `file` to a `captures/name.mp4` (or `.mov`/`.webm`) path, `recordedAt` to an ISO timestamp, and `evidence` to a concise note naming the deployed build, origin, and what was observed. Use `captures/name.mp3` (or `.wav`/`.m4a`) for final narration. No tokens or secrets belong in evidence notes.
4. If a provider acceptance changes, update the relevant caption in `src/story.ts` and record the actual interaction before adding it. If it does not pass, leave the limitation card and omit that side-challenge claim.
5. Preview in Studio, check clip length, captions, audio, and source and destination claims, then run the final gate and render. Store exported video outside Git; `out/` is ignored.

The commands from the repository root are:

```sh
pnpm --filter @envoy/video studio
pnpm --filter @envoy/video narration:draft
pnpm --filter @envoy/video render:draft
pnpm --filter @envoy/video render:final
```

For a fresh production video capture, run `node apps/video/scripts/capture-production.mjs MODE` with `MODE` set to `home`, `jobs`, `participation`, `sources`, `agent`, `chat-sources`, or `feedback`. The script launches a separate headless Chrome profile, records the live `https://envoy.matteopolak.workers.dev/` at 1600×812, and writes a candidate MP4 plus origin, timestamp, action log, and SHA-256 sidecar under the system temporary directory's `envoy-video-candidates/` folder. Gallery modes `gallery-assistant`, `gallery-jobs`, `gallery-nearby`, and `gallery-feedback` write unaltered 1200×800 PNG screenshots with the same provenance sidecar. The feedback gallery mode opens review but never confirms submission. Set `ENVOY_CAPTURE_ORIGIN`, `ENVOY_CAPTURE_OUTPUT_DIR`, or `ENVOY_CHROME_PATH` only when the deployment or local browser path differs. Inspect every candidate's visible action, labels, data, and source claims before copying selected clips into `apps/video/public/captures/` and updating `src/draft-clips.ts` or `src/draft-stills.ts`.

The review export is `apps/video/out/envoy-review.mp4`; it includes real interactions, the native simulator screen, dated Tiger query evidence, synchronized provisional narration and captions, and a clearly pending staff-authorization scene. `render:final` exits before Remotion if required clips are missing. Have the team approve narration and verify footage before hosting a submission video. For a single-frame layout check, use `pnpm --filter @envoy/video still`. Remotion may need a local Chrome or its own headless-shell download to render. On this Mac, a direct local render command is:

```sh
cd apps/video
./node_modules/.bin/remotion render src/index.ts EnvoyReview out/envoy-review.mp4 --codec h264 --x264-preset veryfast --browser-executable '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

The [GitHub review prerelease](https://github.com/matteopolak/hth3/releases/tag/v0.1.0-hth3-review) is a collaborator download, not the Devpost video field. After an approved review rerender, refresh its `envoy-review.mp4` asset with `gh release upload v0.1.0-hth3-review apps/video/out/envoy-review.mp4 --clobber` from the repository root and compare the remote SHA-256 digest with the local file.

The review cut covers the full five-minute story with shorter genuine interactions, held frames, and explanatory graphics. It does not show a new submitted report or private receipt, a live Tiger dashboard, or an accepted staff session. To replace those scenes, record the actual accepted actions and update `capture-manifest.json`; retain the current factual boundary if acceptance remains pending. The local synthesized narration is timed and captioned, but team approval or a replacement recording remains pending. Devpost's [video help](https://help.devpost.com/article/85-uploading-a-demo-video) says its video field needs a YouTube, Vimeo, or Youku URL with playback available to judges. A local MP4 or GitHub release asset cannot fill that field. Upload the approved cut, confirm its embed works, then paste that share URL into the draft entry.

## Configuration

The repository's `pnpm-workspace.yaml` keeps `minimumReleaseAge: 20160`, `minimumReleaseAgeStrict: true`, and `minimumReleaseAgeIgnoreMissingTime: false`. Remotion and its CLI are pinned to `4.0.400`, published in January 2026, with React `18.3.1`. `esbuild@0.25.0` is explicitly allowed to run its install build script. No cloud video service or paid render plan is configured. Check [Remotion's current license terms](https://www.remotion.dev/docs/license/faq) against the team's actual size before a final render; do not purchase a license or enable paid services without a separate decision.

## Dependencies

The edit uses React, Remotion, its CLI, local browser rendering, manually recorded product footage, macOS `say` for the draft voice, and local `ffmpeg`/`ffprobe` for conversion and duration checks. Real source, feedback, Workers AI, Tiger, and optional Auth0/ElevenLabs/Presage evidence comes from the deployed product, not from the video project. The [Remotion render CLI](https://www.remotion.dev/docs/cli/render) and [media timing documentation](https://www.remotion.dev/docs/timing) describe the render and scene behavior.
