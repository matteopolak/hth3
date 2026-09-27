import type { SceneId } from "./story";

type DraftClip = {
  file: string;
  seconds: number;
  description: string;
};

// Selected deployed-site recordings from 2026-09-26. The source scene uses its
// final fourteen seconds for the separately identified SwiftUI simulator still.
export const draftClips: Partial<Record<SceneId, DraftClip>> = {
  home: {
    file: "captures/production-home-2026-09-26.mp4",
    seconds: 24,
    description: "Production guest composer, add menu, and model choice",
  },
  sources: {
    file: "captures/production-sources-2026-09-26.mp4",
    seconds: 41,
    description:
      "Production Jobs, Participation, and Nearby route and map interactions",
  },
  agent: {
    file: "captures/production-agent-2026-09-26.mp4",
    seconds: 50,
    description: "Production Workers AI pending, unsubmitted feedback proposal",
  },
  feedback: {
    file: "captures/production-feedback-2026-09-26.mp4",
    seconds: 40,
    description: "Production feedback entry and Envoy-only review",
  },
};
