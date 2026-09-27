import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const videoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(videoRoot, "src/chat-narration.generated.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const onlyFlag = process.argv.find((arg) => arg.startsWith("--only="));
const selectedIds = onlyFlag
  ? new Set(onlyFlag.slice("--only=".length).split(",").filter(Boolean))
  : new Set(manifest.map((scene) => scene.sceneId));
if ([...selectedIds].some((id) => !manifest.some((scene) => scene.sceneId === id))) {
  throw new Error("Unknown scene in --only");
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return result.stdout.trim();
}

const selected = manifest.filter((scene) => selectedIds.has(scene.sceneId));
const subscription = JSON.parse(run("elevenlabs", [
  "user", "subscription", "get", "--format", "json",
  "--query", "{character_count:character_count,character_limit:character_limit,can_extend_character_limit:can_extend_character_limit}",
]));
const required = selected.reduce((sum, scene) => sum + scene.ttsText.length, 0);
if (subscription.can_extend_character_limit !== false ||
    subscription.character_limit - subscription.character_count < required) {
  throw new Error("Included ElevenLabs credits are insufficient or overages are enabled");
}

mkdirSync(resolve(videoRoot, "public/narration-chat"), { recursive: true });
for (const scene of selected) {
  const file = resolve(videoRoot, "public", scene.file);
  run("elevenlabs", [
    "text-to-speech", "convert",
    "--voice-id", scene.voiceId,
    "--model-id", "eleven_multilingual_v2",
    "--text", scene.ttsText,
    "--output-format", "mp3_44100_128",
    "--output", file,
    "--format", "json",
  ]);
  const duration = Number(run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]));
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error(`Invalid duration for ${scene.sceneId}`);
  scene.durationSeconds = duration;
  console.log(`${scene.sceneId}: ${scene.voiceName}, ${duration.toFixed(2)}s`);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifestPath}`);
