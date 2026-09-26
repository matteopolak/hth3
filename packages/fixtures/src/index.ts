import type { Category } from "@civicresolve/contracts";
export { makeScenario, scenarioMetrics, projectedValue } from "./scenario";

export const taxonomy: Category[] = [
  [
    "sidewalk",
    "Sidewalk hazard",
    "Roads",
    "Damaged sidewalks and walking paths",
  ],
  [
    "water",
    "Water service",
    "Utilities",
    "Leaks, water pressure, and flooding",
  ],
  ["lighting", "Street lighting", "Electrical", "Broken public lighting"],
  [
    "waste",
    "Waste collection",
    "Sanitation",
    "Missed pickup and public litter",
  ],
  ["road", "Road surface", "Roads", "Potholes and damaged road surfaces"],
  [
    "other",
    "Other issue",
    "General Services",
    "Issues needing manual assessment",
  ],
].map(([id, name, routingTeam, description]) => ({
  id,
  name,
  routingTeam,
  description,
  examples: [],
  exclusions: [],
  requiredFields: ["location"],
  publicExplanation: `The ${routingTeam} team will review this report.`,
  version: 1,
  status: "published",
}));

export const goldenVoiceTranscript = [
  { speaker: "resident", text: "The sidewalk near the library is dangerous." },
  { speaker: "agent", text: "What makes it dangerous?" },
  {
    speaker: "resident",
    text: "A large section is lifted and someone could trip.",
  },
  { speaker: "agent", text: "Is anyone injured right now?" },
  { speaker: "resident", text: "No." },
  {
    speaker: "agent",
    text: "I’ll record this as a sidewalk obstruction near the library. Is that correct?",
  },
  { speaker: "resident", text: "Yes." },
] as const;
