import type { SceneId } from "./story";

type DraftClip = {
  file: string;
  seconds: number;
  description: string;
};

// These short recordings show the deployed public site on 2026-09-26. They
// establish only the interaction visible in each clip, not final-scene coverage.
export const draftClips: Partial<Record<SceneId, DraftClip>> = {
  home: {
    file: "captures/pages-home-interaction-2026-09-26.mp4",
    seconds: 12,
    description: "Deployed Pages guest entry, 2026-09-26",
  },
  sources: {
    file: "captures/pages-sources-interaction-2026-09-26.mp4",
    seconds: 28,
    description: "Deployed Jobs and Nearby navigation, 2026-09-26",
  },
  agent: {
    file: "captures/pages-agent-interaction-2026-09-26.mp4",
    seconds: 30,
    description: "Guest Workers AI chat and review proposal, 2026-09-26",
  },
  feedback: {
    file: "captures/pages-feedback-interaction-2026-09-26.mp4",
    seconds: 26,
    description: "Practice feedback draft and review, 2026-09-26",
  },
};
