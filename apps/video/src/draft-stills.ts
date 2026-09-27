import type { SceneId } from "./story";

type Still = {
  file: string;
  description: string;
};

export const draftStills: Partial<Record<SceneId, Still[]>> = {
  home: [
    {
      file: "captures/production-home-2026-09-26.png",
      description: "Production guest entry, 2026-09-26",
    },
  ],
  sources: [
    {
      file: "captures/production-jobs-2026-09-26.png",
      description: "Individual official job postings in production",
    },
    {
      file: "captures/production-participation-2026-09-26.png",
      description: "Open public consultations in production",
    },
    {
      file: "captures/production-nearby-2026-09-26.png",
      description: "Production tiled Nearby map with 78 source records",
    },
    {
      file: "captures/native-nearby-simulator-2026-09-26.png",
      description:
        "Native SwiftUI Nearby · separate simulator build · 2026-09-26",
    },
  ],
  agent: [
    {
      file: "captures/production-agent-pending-2026-09-26.png",
      description: "Production proposal awaiting approval; no submission",
    },
  ],
  feedback: [
    {
      file: "captures/production-feedback-review-2026-09-26.png",
      description: "Production Envoy-only review step, still unsubmitted",
    },
  ],
  closing: [
    {
      file: "captures/production-participation-2026-09-26.png",
      description: "Current official public consultation links in production",
    },
    {
      file: "captures/production-feedback-review-2026-09-26.png",
      description: "Production Envoy feedback review",
    },
  ],
};
