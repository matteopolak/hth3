import type { SceneId } from "./story";

type Still = {
  file: string;
  description: string;
};

export const draftStills: Partial<Record<SceneId, Still[]>> = {
  home: [
    {
      file: "captures/unified-home-2026-09-26.png",
      description: "Unified production guest entry, 2026-09-26",
    },
  ],
  sources: [
    {
      file: "captures/unified-jobs-2026-09-26.png",
      description: "Official job finders on unified production",
    },
    {
      file: "captures/unified-participation-2026-09-26.png",
      description: "Live public consultation links on unified production",
    },
    {
      file: "captures/unified-nearby-2026-09-26.png",
      description: "78 public service records on unified production",
    },
  ],
  agent: [
    {
      file: "captures/unified-proposal-pending-2026-09-26.png",
      description: "Current production proposal; no submission",
    },
  ],
  feedback: [
    {
      file: "captures/unified-feedback-review-2026-09-26.png",
      description: "Unified production review step, still unsubmitted",
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
      file: "captures/unified-participation-2026-09-26.png",
      description: "Current official public consultation links",
    },
    {
      file: "captures/pages-feedback-receipt-2026-09-26.png",
      description: "Private practice feedback receipt",
    },
  ],
};
