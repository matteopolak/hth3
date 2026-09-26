import type { SceneId } from "./story";

type Still = {
  file: string;
  description: string;
};

export const draftStills: Partial<Record<SceneId, Still[]>> = {
  home: [
    {
      file: "captures/pages-home-2026-09-26.png",
      description: "Production Pages home, 2026-09-26",
    },
  ],
  sources: [
    {
      file: "captures/pages-jobs-2026-09-26.png",
      description: "Official BC job finder on production Pages",
    },
    {
      file: "captures/pages-nearby-2026-09-26.png",
      description: "65 Service BC locations on production Pages",
    },
    {
      file: "captures/native-nearby-simulator-2026-09-26.png",
      description: "Native SwiftUI Nearby map in iPhone simulator",
    },
  ],
  agent: [
    {
      file: "captures/pages-agent-proposal-2026-09-26.png",
      description: "Production Workers AI proposal, 2026-09-26",
    },
  ],
  feedback: [
    {
      file: "captures/pages-feedback-2026-09-26.png",
      description: "Guest feedback intake with practice notice",
    },
    {
      file: "captures/pages-report-submitted-2026-09-26.png",
      description: "Practice report action completed in guest chat",
    },
    {
      file: "captures/pages-feedback-receipt-2026-09-26.png",
      description: "Submitted practice report receipt, token hidden",
    },
  ],
  closing: [
    {
      file: "captures/pages-jobs-2026-09-26.png",
      description: "Official BC source handoff",
    },
    {
      file: "captures/pages-feedback-receipt-2026-09-26.png",
      description: "Private practice feedback receipt",
    },
  ],
};
