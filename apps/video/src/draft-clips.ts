import type { SceneId } from "./story";

type DraftClip = {
  file: string;
  seconds: number;
  description: string;
};

// These short recordings show the local color build or unified deployed site on
// 2026-09-26. They establish only the visible interaction, not final coverage.
export const draftClips: Partial<Record<SceneId, DraftClip>> = {
  home: {
    file: "captures/color-home-interaction-2026-09-26.mp4",
    seconds: 16,
    description: "Local color build guest entry, 2026-09-26",
  },
  sources: {
    file: "captures/color-sources-interaction-2026-09-26.mp4",
    seconds: 48,
    description:
      "Local color build Jobs, Participation and Nearby navigation, 2026-09-26",
  },
  agent: {
    file: "captures/color-agent-interaction-2026-09-26.mp4",
    seconds: 50,
    description: "Unified production pending feedback approval, 2026-09-26",
  },
  feedback: {
    file: "captures/color-feedback-interaction-2026-09-26.mp4",
    seconds: 28,
    description: "Local color build feedback entry and review, 2026-09-26",
  },
};
