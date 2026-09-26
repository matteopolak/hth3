import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(root, "capture-manifest.json"), "utf8"),
);
const required = ["home", "sources", "agent", "feedback", "tiger", "closing"];
const problems = [];

for (const id of required) {
  const entry = manifest[id];
  if (
    entry?.status !== "captured" ||
    !entry.file ||
    !entry.recordedAt ||
    !entry.evidence
  ) {
    problems.push(
      `${id}: record a real clip and fill status, file, recordedAt, and evidence`,
    );
    continue;
  }
  if (!/^captures\/[a-zA-Z0-9._-]+\.(mp4|mov|webm)$/.test(entry.file)) {
    problems.push(`${id}: file must be a local public/captures video`);
    continue;
  }
  try {
    if (statSync(resolve(root, "public", entry.file)).size === 0) {
      problems.push(`${id}: clip is empty`);
    }
  } catch {
    problems.push(`${id}: clip file is missing`);
  }
  if (Number.isNaN(Date.parse(entry.recordedAt))) {
    problems.push(`${id}: recordedAt must be a valid date`);
  }
}

const narration = manifest.narration;
if (
  narration?.status !== "captured" ||
  !narration.file ||
  !narration.recordedAt ||
  !narration.evidence ||
  !/^captures\/[a-zA-Z0-9._-]+\.(mp3|wav|m4a)$/.test(narration.file)
) {
  problems.push(
    "narration: record a real voiceover and fill its manifest evidence",
  );
} else {
  try {
    if (statSync(resolve(root, "public", narration.file)).size === 0) {
      problems.push("narration: audio file is empty");
    }
  } catch {
    problems.push("narration: audio file is missing");
  }
  if (Number.isNaN(Date.parse(narration.recordedAt))) {
    problems.push("narration: recordedAt must be a valid date");
  }
}

const staff = manifest.staff;
if (staff?.status === "captured") {
  if (
    !staff.file ||
    !staff.recordedAt ||
    !staff.evidence ||
    !/^captures\/[a-zA-Z0-9._-]+\.(mp4|mov|webm)$/.test(staff.file)
  ) {
    problems.push(
      "staff: a captured optional scene needs a real clip and evidence",
    );
  } else {
    try {
      if (statSync(resolve(root, "public", staff.file)).size === 0) {
        problems.push("staff: clip is empty");
      }
    } catch {
      problems.push("staff: clip file is missing");
    }
    if (Number.isNaN(Date.parse(staff.recordedAt))) {
      problems.push("staff: recordedAt must be a valid date");
    }
  }
}

if (problems.length > 0) {
  console.error(
    "Final render blocked: real product footage is still missing.\n",
  );
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(
  "Required capture slots are filled. Confirm clip content and spoken claims before publishing.",
);
