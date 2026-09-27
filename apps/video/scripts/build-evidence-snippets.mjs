import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(import.meta.dirname, "../../..");
const sets = {
  voice: [
    {
      file: "apps/worker/src/features/voice/index.ts",
      lines: [80, 81, 83, 84, 85, 86],
    },
    {
      file: "apps/worker/src/features/voice/index.ts",
      lines: [387, 390, 391, 395, 396, 400, 401, 402, 405, 407],
    },
  ],
  tiger: [
    {
      file: "scripts/tiger/001_feedback_analytics.sql",
      lines: [6, 7, 8, 9, 10, 11, 12, 13, 14, 18],
    },
    {
      file: "apps/worker/src/features/analytics/index.ts",
      lines: [202, 203, 204, 205, 207, 208, 209, 210, 211, 212, 213, 215, 216],
    },
  ],
  presage: [
    {
      file: "apps/mobile/ios/CivicResolve/Features/Accessibility/AccessibilityView.swift",
      lines: [39, 40, 44, 45, 46, 47, 51, 58, 59, 61, 63, 64],
    },
    {
      file: "apps/mobile/ios/CivicResolve/Features/Accessibility/AccessibilityView.swift",
      lines: [88, 89, 90, 91, 93, 94, 95, 96],
    },
  ],
  auth: [
    {
      file: "apps/web/src/platform/auth0.ts",
      lines: [160, 162, 164, 165, 166, 167, 168, 169],
    },
    {
      file: "apps/worker/src/auth/identity.ts",
      lines: [149, 153, 154, 155, 156, 157, 159, 165, 166, 167, 175, 176, 177],
    },
    {
      file: "apps/worker/src/features/feedback-core/staff.ts",
      lines: [396, 398, 399, 403, 404, 405, 406, 411, 412, 413],
    },
    {
      file: "apps/worker/src/features/feedback-core/staff.ts",
      lines: [876, 878, 879, 883, 884, 885, 886, 890, 891, 892],
    },
  ],
};

const result = Object.fromEntries(
  Object.entries(sets).map(([scene, specifications]) => [
    scene,
    specifications.map(({ file, lines }) => {
      const source = readFileSync(resolve(project, file), "utf8").split("\n");
      return {
        file,
        rows: lines.map((number) => {
          if (!source[number - 1]) throw new Error(`Missing ${file}:${number}`);
          return { number, text: source[number - 1].trimEnd() };
        }),
      };
    }),
  ]),
);
writeFileSync(
  resolve(import.meta.dirname, "../src/evidence-snippets.generated.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
