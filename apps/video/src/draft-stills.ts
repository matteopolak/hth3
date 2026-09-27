import type { SceneId } from "./story";

type Still = {
  file: string;
  description: string;
};

export const draftStills: Partial<Record<SceneId, Still[]>> = {
  home: [
    {
      file: "captures/color-home-2026-09-26.png",
      description: "Local color build guest entry, 2026-09-26",
    },
  ],
  sources: [
    {
      file: "captures/color-jobs-2026-09-26.png",
      description: "Official job finders in local color build",
    },
    {
      file: "captures/color-participation-2026-09-26.png",
      description: "Public consultation links in local color build",
    },
    {
      file: "captures/color-nearby-2026-09-26.png",
      description: "Nearby source map in local color build",
    },
    {
      file: "captures/native-nearby-simulator-2026-09-26.png",
      description:
        "Native SwiftUI Nearby · separate simulator build · 2026-09-26",
    },
  ],
  agent: [
    {
      file: "captures/color-agent-pending-2026-09-26.png",
      description: "Unified production proposal; no submission",
    },
  ],
  feedback: [
    {
      file: "captures/color-feedback-review-2026-09-26.png",
      description: "Local color build review step, still unsubmitted",
    },
  ],
  closing: [
    {
      file: "captures/color-participation-2026-09-26.png",
      description:
        "Current official public consultation links in local color build",
    },
    {
      file: "captures/color-feedback-review-2026-09-26.png",
      description: "Local color build Envoy feedback review",
    },
  ],
};
