# Evidence-backed video production

## What it is

`apps/video` is a five-minute Remotion edit for Envoy's Civic Technology submission. It currently renders an unmistakable storyboard draft: missing footage is labeled “Capture required,” and the final render command stops until required real recordings and narration are documented. A draft is not submission footage.

## How it works

The `EnvoyEvidence` composition is 1920×1080 at 30 frames per second and exactly 300 seconds. Seven scenes follow [the storyboard](video-storyboard.md): deployed home, official BC sources, resident agent proposal, practice feedback and receipt, Tiger delivery, staff access boundary, and closing. Each scene uses a local screen recording from `apps/video/public/captures/` only when `capture-manifest.json` says `captured`; otherwise it shows a visible placeholder. The optional staff scene can remain an honest limitation card while live Auth0 role acceptance is pending. The remaining six video slots and a genuine narrated audio track are required for a final render.

The final gate checks local file existence, nonempty content, a recording date, and a human evidence note. It cannot prove that a recording is authentic: review the actual media and narration against current product behavior before publishing. The composition mutes clip audio so the single voiceover and on-screen captions stay intelligible. Keep each clip at least as long as its scene (30, 55, 50, 50, 45, optional 45, and 25 seconds respectively) and the narration at least five minutes, or edit the scene timing and script together.

As of 2026-09-26, there are no screen recordings or narration files in the repository. A production Pages HTTP 200, 65 live Service BC office records, three current BC finder links, a reviewable Workers AI guest proposal, and two delivered Tiger events have been observed. Those observations are leads for capture, not substitute clips. Auth0 role-token acceptance, ElevenLabs live voice submission, and a physical-device Presage result remain pending; no scene depicts them as completed. The stale federal consultation finder must remain labeled stale if shown.

## How to change it

1. Record the deployed product, redact private receipt tokens, JWTs, résumé data, and provider keys, then place the recordings in `apps/video/public/captures/`. Record the voiceover from the verified [presentation script](presentation.md).
2. For each scene in `apps/video/capture-manifest.json`, set `status` to `captured`, `file` to a `captures/name.mp4` (or `.mov`/`.webm`) path, `recordedAt` to an ISO timestamp, and `evidence` to a concise note naming the deployed build, origin, and what was observed. Use `captures/name.mp3` (or `.wav`/`.m4a`) for narration. No tokens or secrets belong in evidence notes.
3. If a provider acceptance changes, update the relevant caption in `src/story.ts` and record the actual interaction before adding it. If it does not pass, leave the limitation card and omit that side-challenge claim.
4. Preview in Studio, check clip length, captions, audio, and visible practice/source labels, then run the final gate and render. Store exported video outside Git; `out/` is ignored.

The commands from the repository root are:

```sh
pnpm --filter @envoy/video studio
pnpm --filter @envoy/video render:draft
pnpm --filter @envoy/video render:final
```

The draft deliberately contains capture placeholders. `render:final` exits before Remotion if required files are missing. Do not upload or present the draft as a working-product video. For a single-frame layout check, use `pnpm --filter @envoy/video still`. Remotion may need a local Chrome or its own headless-shell download to render; its CLI accepts `--browser-executable` when using an installed compatible browser.

## Configuration

The repository's `pnpm-workspace.yaml` keeps `minimumReleaseAge: 20160`, `minimumReleaseAgeStrict: true`, and `minimumReleaseAgeIgnoreMissingTime: false`. Remotion and its CLI are pinned to `4.0.400`, published in January 2026, with React `18.3.1`. `esbuild@0.25.0` is explicitly allowed to run its install build script. No cloud video service or paid render plan is configured. Check [Remotion's current license terms](https://www.remotion.dev/docs/license/faq) against the team's actual size before a final render; do not purchase a license or enable paid services without a separate decision.

## Dependencies

The edit uses React, Remotion, its CLI, local browser rendering, and manually recorded product footage. Real source, feedback, Workers AI, Tiger, and optional Auth0/ElevenLabs/Presage evidence comes from the deployed product, not from the video project. The [Remotion render CLI](https://www.remotion.dev/docs/cli/render) and [media timing documentation](https://www.remotion.dev/docs/timing) describe the render and scene behavior.
