import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const project = resolve(import.meta.dirname, "..");
const script = JSON.parse(
  readFileSync(join(project, "narration-draft.json"), "utf8"),
);
const { scenes } = await import("../src/story.ts");
const audioDirectory = join(project, "public", "narration-draft");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "envoy-narration-"));
mkdirSync(audioDirectory, { recursive: true });

const segments = [];

try {
  for (const scene of scenes) {
    const lines = script.scenes[scene.id];
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new Error(`Missing narration for ${scene.id}`);
    }

    let nextStart = 2;
    for (const [index, text] of lines.entries()) {
      const basename = `${scene.id}-${String(index + 1).padStart(2, "0")}`;
      const aiff = join(temporaryDirectory, `${basename}.aiff`);
      const file = `narration-draft/${basename}.m4a`;
      const output = join(project, "public", file);
      execFileSync("say", [
        "-v",
        script.voice,
        "-r",
        String(script.rateWordsPerMinute),
        "-o",
        aiff,
        text,
      ]);
      execFileSync("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        aiff,
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        output,
      ]);
      const duration = Number(
        execFileSync("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          output,
        ])
          .toString()
          .trim(),
      );
      if (!Number.isFinite(duration) || duration < 0.5) {
        throw new Error(`Narration audio was empty or invalid: ${file}`);
      }
      if (nextStart + duration > scene.seconds - 1) {
        throw new Error(
          `${scene.id} narration runs ${Math.ceil(nextStart + duration - scene.seconds + 1)}s past its scene`,
        );
      }
      segments.push({
        sceneId: scene.id,
        text,
        file,
        startSeconds: nextStart,
        durationSeconds: duration,
      });
      nextStart += duration + script.gapSeconds;
    }
  }
  writeFileSync(
    join(project, "src", "draft-narration.generated.json"),
    JSON.stringify(segments, null, 2) + "\n",
  );
  process.stdout.write(`Generated ${segments.length} timed narration clips.\n`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
