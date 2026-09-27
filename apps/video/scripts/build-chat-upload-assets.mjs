import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const videoDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const videoPath = resolve(
  process.argv[2] ??
    resolve(videoDir, "out/envoy-chat-motion-review-local.mp4"),
);
const srtPath = resolve(
  process.argv[3] ??
    resolve(videoDir, "out/envoy-chat-motion-review-local.srt"),
);
const thumbnailPath = resolve(
  process.argv[4] ?? resolve(videoDir, "out/envoy-chat-motion-thumbnail.png"),
);
const fps = 30;
const thumbnailSecond = 1.2;

if (!existsSync(videoPath)) {
  throw new Error(`Rendered film is missing: ${videoPath}`);
}

const narration = JSON.parse(
  readFileSync(resolve(videoDir, "src/chat-narration.generated.json"), "utf8"),
);
const sceneSeconds = JSON.parse(
  readFileSync(resolve(videoDir, "src/chat-film-timing.json"), "utf8"),
);

function timestamp(frame) {
  const milliseconds = Math.round((frame * 1000) / fps);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

const cues = [];
let sceneStartFrame = 0;
for (const voice of narration) {
  const seconds = sceneSeconds[voice.sceneId];
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error(`Missing scene length for ${voice.sceneId}`);
  }
  const sentences = voice.text.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim());
  if (!sentences?.length) {
    throw new Error(`Missing display narration for ${voice.sceneId}`);
  }
  const spokenStartFrame = voice.startSeconds * fps;
  const spokenFrames = voice.durationSeconds * fps;
  if (spokenStartFrame + spokenFrames > seconds * fps) {
    throw new Error(`Narration exceeds scene window: ${voice.sceneId}`);
  }

  sentences.forEach((sentence, index) => {
    // Mirror Caption() in chat-film.tsx: each sentence gets an equal share of
    // measured speech time, selected at the first matching 30 fps video frame.
    const startFrame =
      sceneStartFrame +
      Math.ceil(spokenStartFrame + (index * spokenFrames) / sentences.length);
    const endFrame =
      sceneStartFrame +
      Math.ceil(
        spokenStartFrame + ((index + 1) * spokenFrames) / sentences.length,
      );
    cues.push(
      `${cues.length + 1}\n${timestamp(startFrame)} --> ${timestamp(endFrame)}\n${sentence}`,
    );
  });
  sceneStartFrame += seconds * fps;
}

if (sceneStartFrame !== 94 * fps) {
  throw new Error(
    `Expected 94-second motion edit; got ${sceneStartFrame / fps}`,
  );
}
mkdirSync(dirname(srtPath), { recursive: true });
writeFileSync(srtPath, `${cues.join("\n\n")}\n`, "utf8");

mkdirSync(dirname(thumbnailPath), { recursive: true });
const result = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(thumbnailSecond),
    "-i",
    videoPath,
    "-vf",
    "scale=1280:720:flags=lanczos",
    "-frames:v",
    "1",
    "-y",
    thumbnailPath,
  ],
  { encoding: "utf8" },
);
if (result.status !== 0) {
  throw new Error(`Thumbnail extraction failed: ${result.stderr}`);
}

console.log(`SRT: ${srtPath} (${cues.length} cues)`);
console.log(`Thumbnail: ${thumbnailPath} (1280×720, ${thumbnailSecond}s)`);
