import type { SceneId } from "./story";

type DraftClip = {
  file: string;
  seconds: number;
  description: string;
};

// These short recordings show the unified deployed site on 2026-09-26. They
// establish only the interaction visible in each clip, not final-scene coverage.
export const draftClips: Partial<Record<SceneId, DraftClip>> = {
  home: {
    file: "captures/unified-home-interaction-2026-09-26.mp4",
    seconds: 16,
    description: "Unified production guest entry, 2026-09-26",
  },
  sources: {
    file: "captures/unified-sources-interaction-2026-09-26.mp4",
    seconds: 48,
    description: "Live Jobs, Participation and Nearby navigation, 2026-09-26",
  },
  agent: {
    file: "captures/unified-agent-interaction-2026-09-26.mp4",
    seconds: 38,
    description: "Guest Workers AI duplicate check, 2026-09-26",
  },
  feedback: {
    file: "captures/unified-feedback-interaction-2026-09-26.mp4",
    seconds: 28,
    description: "Unified production practice draft and review, 2026-09-26",
  },
};
