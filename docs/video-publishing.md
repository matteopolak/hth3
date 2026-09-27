# Envoy video publishing handoff

## What it is

This is the proposed YouTube metadata for the 94-second `EnvoyChatFilmMotion` review cut. It is prepared locally so the reviewed video, captions, and thumbnail can be published together after the team approves the cut.

## How it works

Use `apps/video/out/envoy-chat-motion-review-local.mp4` as the video, `apps/video/out/envoy-chat-motion-review-local.srt` as English captions, and `apps/video/out/envoy-chat-motion-thumbnail.png` as the 1280×720 thumbnail. Set visibility to **Unlisted** on the Matthew Polak channel. After YouTube finishes processing, check playback while signed out, then replace the Devpost video link with that exact URL. Preserve the older hosted video until the replacement works.

On September 27, an unauthenticated `yt-dlp` request retrieved the older video's ID, title, 300-second duration, and `unlisted` availability. A separate unauthenticated request fetched its first three seconds of H.264 video and AAC audio; `ffmpeg` decoded both streams without error. This confirms that the existing link serves playable media while the replacement awaits review. A full signed-out browser playback check remains open.

### Proposed title

Envoy — Start with a question | Hack the Hill III

### Proposed description

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

### Proposed Devpost video field

Replace only the existing Video demo URL with the verified new unlisted YouTube URL. Keep the rest of the submitted project copy and gallery intact.

## How to change it

Edit the title and description here before upload. If the film's scene lengths change, recompute the chapter starts from `apps/video/src/chat-film-timing.json`; YouTube chapters must start at `00:00` and each chapter must last at least ten seconds. Regenerate the captions and thumbnail with `node apps/video/scripts/build-chat-upload-assets.mjs` after a new render. Check claims against the visible cut and its [script](video-script-review.md), particularly the official application handoff and the Envoy-only feedback destination.

## Configuration

The upload uses **Unlisted** visibility. The output names above are local and Git ignored. The review cut stays local until the user explicitly approves this version for upload. Do not add the four standalone custom-voice recordings or the raw Mixkit MP3 to the upload.

## Dependencies

The handoff depends on the rendered Remotion cut, its local SRT and thumbnail, the user's signed-in YouTube channel, Devpost access in the user's browser, and the [video production workflow](video-production.md). The music and monitor credit links, capture boundaries, and known acceptance limits are documented there.
