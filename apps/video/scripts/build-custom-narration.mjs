import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const videoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(videoRoot, "src/custom-narration.generated.json");
const audioRoot = resolve(videoRoot, "public/narration-custom");
const voices = {
  open: ["robert", "R5rU293t7xe8dI1rhLd0"],
  sources: ["robert", "R5rU293t7xe8dI1rhLd0"],
  agent: ["asdf", "yFCTR9LkeDbOvtFI8axB"],
  feedback: ["asdf", "yFCTR9LkeDbOvtFI8axB"],
  voice: ["mp", "TLEJS9fLZJSgXY7WJMYV"],
  tiger: ["mp", "TLEJS9fLZJSgXY7WJMYV"],
  presage: ["yo", "0n46A9P3HCcODBgAM8WN"],
  auth: ["yo", "0n46A9P3HCcODBgAM8WN"],
  closing: ["robert", "R5rU293t7xe8dI1rhLd0"],
};

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return result.stdout.trim();
}

const source = JSON.parse(readFileSync(outputPath, "utf8"));
const subscription = JSON.parse(run("elevenlabs", [
  "user", "subscription", "get", "--format", "json",
  "--query", "{character_count:character_count,character_limit:character_limit,can_extend_character_limit:can_extend_character_limit}",
]));
const requiredCharacters = source.reduce((sum, scene) => sum + scene.text.length, 0);
if (subscription.can_extend_character_limit !== false ||
    subscription.character_limit - subscription.character_count < requiredCharacters) {
  throw new Error("Included ElevenLabs credits are insufficient or overage protection is not disabled");
}
mkdirSync(audioRoot, { recursive: true });
const generated = [];
for (const scene of source) {
  const [voiceName, voiceId] = voices[scene.sceneId] ?? [];
  if (!voiceId) throw new Error(`Unknown scene: ${scene.sceneId}`);
  const file = `narration-custom/${scene.sceneId}-01.mp3`;
  const absoluteFile = resolve(videoRoot, "public", file);
  run("elevenlabs", [
    "text-to-speech", "convert",
    "--voice-id", voiceId,
    "--model-id", "eleven_multilingual_v2",
    "--text", scene.text,
    "--output-format", "mp3_44100_128",
    "--output", absoluteFile,
    "--format", "json",
  ]);
  const durationSeconds = Number(run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", absoluteFile,
  ]));
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Invalid duration for ${scene.sceneId}`);
  }
  generated.push({
    sceneId: scene.sceneId,
    text: scene.text,
    file,
    startSeconds: 0.6,
    durationSeconds,
    voiceId,
    voiceName,
  });
  console.log(`${scene.sceneId}: ${voiceName}, ${durationSeconds.toFixed(2)}s`);
  writeFileSync(outputPath, `${JSON.stringify(generated, null, 2)}\n`);
}
console.log(`Wrote ${outputPath}`);
