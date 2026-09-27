# Envoy video publishing handoff

## What it is

This records the approved 94-second `EnvoyChatFilmMotion` upload and its Devpost handoff. The video is [unlisted on the Matthew Polak channel](https://youtu.be/7arR-ro1gS8) and embedded in the [submitted project](https://devpost.com/software/envoy-y5wgnv).

## How it works

The uploaded file was `apps/video/out/envoy-chat-motion-review-local.mp4`, SHA-256 `ad205aa4483673a44e9fc15b577319113409cd256893d495b0e19c240021ef3b`. YouTube reported a 1:35 display duration for the 94.059-second file, **Unlisted** visibility, and no copyright issues at publication. The title and description below were saved. Custom thumbnail upload required one-time phone verification, so the first auto-generated frame was selected; the prepared `apps/video/out/envoy-chat-motion-thumbnail.png` remains local. Captions are burned into the MP4. The separate `apps/video/out/envoy-chat-motion-review-local.srt` remains local because YouTube's subtitle control was unavailable during this upload.

On September 27, an unauthenticated `yt-dlp` request reported the new video's `unlisted` availability, 94-second duration, and saved title. Another unauthenticated request fetched its first three seconds of H.264 video and AAC audio; `ffmpeg` decoded both streams without error. The public Devpost page embedded the new ID, and playback there advanced to 29 seconds with audio and captions before it was paused. The earlier five-minute video remains hosted at its original URL but is no longer linked from Devpost.

### Saved title

Envoy — Start with a question | Hack the Hill III

### Saved description

Envoy helps people find a useful next step through a conversation. Ask about jobs, training support, nearby services, or a concern. Check the original source, review what Envoy prepares, and decide what to do next.

This film uses captured product interactions and shows the code behind voice intake, privacy-conscious trend counts, native accessibility, and staff authorization. An external job application continues on the publisher's site. The submitted product-feedback example goes to Envoy's own review team.

Try Envoy: https://envoy.surf/

Code: https://github.com/matteopolak/hth3

Hack the Hill III project: https://devpost.com/software/envoy-y5wgnv

00:00 Start with a question
00:18 Jobs and support
00:37 Nearby and feedback
00:54 Voice, trends, and native access
01:18 Staff access and the next step

Music: “Your Breath” by Eugenio Mininni, via Mixkit. Monitor model: CreativeTrio, CC0, via Poly Pizza.

### Saved Devpost video field

The Video demo field, the story's Walkthrough link, and its third Try it out link all point to `https://youtu.be/7arR-ro1gS8`. The public project page rendered that exact YouTube embed. The other story content and gallery were retained.

## How to change it

Edit the title and description in YouTube Studio, then mirror changes here. If the film's scene lengths change, recompute the chapter starts from `apps/video/src/chat-film-timing.json`; YouTube chapters must start at `00:00` and each chapter must last at least ten seconds. Regenerate the captions and thumbnail with `node apps/video/scripts/build-chat-upload-assets.mjs` after a new render. Check claims against the visible cut and its [script](video-script-review.md), particularly the official application handoff and the Envoy-only feedback destination. Recheck the public Devpost embed after any future replacement.

## Configuration

The upload uses **Unlisted** visibility. The render, SRT, thumbnail, four standalone custom-voice recordings, and raw Mixkit MP3 remain local and Git ignored. Only the reviewed mixed MP4 was uploaded to YouTube. The source and publishing instructions are committed on main.

## Dependencies

The handoff depends on the rendered Remotion cut, its local SRT and thumbnail, the user's signed-in YouTube channel, Devpost access in the user's browser, and the [video production workflow](video-production.md). The music and monitor credit links, capture boundaries, and known acceptance limits are documented there.
