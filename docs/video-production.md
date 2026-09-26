# Evidence-backed video production

## What it is

`apps/video` is a five-minute Remotion edit for Envoy's Civic Technology submission. Its review draft uses short browser recordings and screenshots from the unified production Worker plus a dated, read-only Tiger query. A local synthesized narration and timed captions help the team rehearse; they are labeled as draft. Missing coverage remains labeled, and the final render command stops until complete scene recordings and approved narration are documented. The review draft is not submission footage.

## How it works

The `EnvoyEvidence` composition is 1920×1080 at 30 frames per second and exactly 300 seconds. A second `EnvoyReview` composition runs the same 300-second story at 15 frames per second for a faster review export. Seven scenes follow [the storyboard](video-storyboard.md): deployed home, official jobs and consultations, resident agent interaction, practice feedback and receipt, Tiger delivery, staff access boundary, and closing. A final scene uses a local screen recording from `apps/video/public/captures/` only when `capture-manifest.json` says `captured`. The review composition may use shorter verified clips listed in `src/draft-clips.ts`, then switch to dated production screenshots, a dated Tiger query card, or an explicit placeholder. It plays the sentence clips in `public/narration-draft/` with matching on-screen captions from `src/draft-narration.generated.json`. The opening and closing cards use the same monochrome visual language as the deployed product. The optional staff scene remains an honest limitation card while live Auth0 role acceptance is pending. The six complete video slots and an approved narrated audio track are required for a final render.

The final gate checks local file existence, nonempty content, a recording date, and a human evidence note. It cannot prove that a recording is authentic: review the actual media and narration against current product behavior before publishing. The composition mutes clip audio so the single voiceover and on-screen captions stay intelligible. Keep each clip at least as long as its scene (30, 55, 50, 50, 45, optional 45, and 25 seconds respectively) and the narration at least five minutes, or edit the scene timing and script together.

The current review assets were captured on 2026-09-26. Five isolated headless Chrome recordings show unified production guest entry (16 seconds), Jobs, Participation and Nearby navigation (48 seconds), a guest Workers AI duplicate check (38 seconds), a fresh pending bench proposal on Worker version `837bf16a` (50 seconds), and the feedback form through review (28 seconds). The feedback recording stops before submission. Hashes and exact visible actions are in `apps/video/evidence/unified-browser-captures-2026-09-26.json`. Older, pre-cutover Pages screenshots remain only where they establish a completed practice report or its receipt; their dated provenance is in `apps/video/evidence/browser-captures-2026-09-26.json`. The new Jobs view showed six official finders, Participation showed four open consultations, and Nearby showed 78 results. A separate native SwiftUI Nearby screenshot was taken in an iPhone simulator but is no longer in the current review cut. Its exact API origin was not independently checked for this edit, and it does not establish physical-device acceptance. The Tiger evidence files contain a read-only query taken at 19:41 UTC: four delivered events and four aggregate events, including two sample events (`feedback.submitted` and `feedback.classified`) for the earlier practice report. This is a dated query result, not staff dashboard footage. The draft voiceover is generated locally by macOS `say`; it is not an ElevenLabs voice demo or evidence of voice intake acceptance. Auth0 role-token acceptance, ElevenLabs live voice submission, and a physical-device Presage result remain pending; no scene depicts them as completed. The stale federal consultation finder must remain labeled stale if shown.

## How to change it

1. Record the deployed product, redact private receipt tokens, JWTs, résumé data, and provider keys, then place the recordings in `apps/video/public/captures/`. Record the voiceover from the verified [presentation script](presentation.md).
2. Edit `apps/video/narration-draft.json` to change a spoken sentence, then run `pnpm --filter @envoy/video narration:draft` on macOS. The generator uses the local `Daniel` voice, `ffmpeg`, and `ffprobe`; it stops if a sentence overflows its scene. The generated audio and timed caption manifest are committed for repeatable review. Replace them with an approved final voiceover before final submission.
3. For each scene in `apps/video/capture-manifest.json`, set `status` to `captured`, `file` to a `captures/name.mp4` (or `.mov`/`.webm`) path, `recordedAt` to an ISO timestamp, and `evidence` to a concise note naming the deployed build, origin, and what was observed. Use `captures/name.mp3` (or `.wav`/`.m4a`) for final narration. No tokens or secrets belong in evidence notes.
4. If a provider acceptance changes, update the relevant caption in `src/story.ts` and record the actual interaction before adding it. If it does not pass, leave the limitation card and omit that side-challenge claim.
5. Preview in Studio, check clip length, captions, audio, and visible practice/source labels, then run the final gate and render. Store exported video outside Git; `out/` is ignored.

The commands from the repository root are:

```sh
pnpm --filter @envoy/video studio
pnpm --filter @envoy/video narration:draft
pnpm --filter @envoy/video render:draft
pnpm --filter @envoy/video render:final
```

The review export is `apps/video/out/envoy-review.mp4`; it has short production recordings, real stills, dated query evidence, provisional narration and captions, and explicit remaining-footage labels. `render:final` exits before Remotion if required clips are missing. Do not upload or present the review draft as the final working-product video. For a single-frame layout check, use `pnpm --filter @envoy/video still`. Remotion may need a local Chrome or its own headless-shell download to render. On this Mac, a direct local render command is:

```sh
cd apps/video
./node_modules/.bin/remotion render src/index.ts EnvoyReview out/envoy-review.mp4 --codec h264 --x264-preset veryfast --browser-executable '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

The short review clips do not cover their full scenes or the report submission/receipt. Complete final recordings remain needed for home, sources, agent, feedback/receipt, Tiger dashboard or terminal, and closing. The local synthesized narration is for edit timing and rehearsal; an approved final narration track is still missing. The staff recording stays optional until Auth0 role acceptance; the current scene states that limitation. Devpost's [video help](https://help.devpost.com/article/85-uploading-a-demo-video) says its video field needs a YouTube, Vimeo, or Youku URL with playback available to judges. A local MP4 or GitHub release asset cannot fill that field. Upload only the approved final cut, confirm its embed works, then paste that share URL into the draft entry.

## Configuration

The repository's `pnpm-workspace.yaml` keeps `minimumReleaseAge: 20160`, `minimumReleaseAgeStrict: true`, and `minimumReleaseAgeIgnoreMissingTime: false`. Remotion and its CLI are pinned to `4.0.400`, published in January 2026, with React `18.3.1`. `esbuild@0.25.0` is explicitly allowed to run its install build script. No cloud video service or paid render plan is configured. Check [Remotion's current license terms](https://www.remotion.dev/docs/license/faq) against the team's actual size before a final render; do not purchase a license or enable paid services without a separate decision.

## Dependencies

The edit uses React, Remotion, its CLI, local browser rendering, manually recorded product footage, macOS `say` for the draft voice, and local `ffmpeg`/`ffprobe` for conversion and duration checks. Real source, feedback, Workers AI, Tiger, and optional Auth0/ElevenLabs/Presage evidence comes from the deployed product, not from the video project. The [Remotion render CLI](https://www.remotion.dev/docs/cli/render) and [media timing documentation](https://www.remotion.dev/docs/timing) describe the render and scene behavior.
