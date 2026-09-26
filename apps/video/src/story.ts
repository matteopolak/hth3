export const FPS = 30;

export const scenes = [
  {
    id: "home",
    seconds: 30,
    title: "Find a place to start",
    caption:
      "envoy brings public sources and a clear path for feedback into one place.",
    capture: "Deployed Envoy home and guest entry point",
    required: true,
  },
  {
    id: "sources",
    seconds: 55,
    title: "Follow the official source",
    caption:
      "BC finder links lead to publisher sites. Service BC office records show their source and freshness.",
    capture: "BC finder search, Service BC detail, and official handoff",
    required: true,
  },
  {
    id: "agent",
    seconds: 50,
    title: "Talk through a service issue",
    caption:
      "A resident can describe a problem in plain language. Workers AI prepares a reviewable report proposal.",
    capture: "New production guest chat with Toronto streetlight proposal",
    required: true,
  },
  {
    id: "feedback",
    seconds: 50,
    title: "Review before sending",
    caption:
      "A practice draft is reviewed here. A separately submitted practice report has a private receipt. No government office receives it.",
    capture: "Practice notice, report submission, and redacted receipt",
    required: true,
  },
  {
    id: "tiger",
    seconds: 45,
    title: "A report leaves an auditable trace",
    caption:
      "D1 keeps the report. Its outbox sends privacy-safe events to Tiger for time-series analysis.",
    capture:
      "Read-only Tiger event and aggregate query or accepted staff trend view",
    required: true,
  },
  {
    id: "staff",
    seconds: 45,
    title: "Staff access has a boundary",
    caption:
      "The practice staff workspace is configured for Auth0 roles. Live token and role acceptance is still pending.",
    capturedCaption:
      "An authenticated staff role can respond within its own practice workspace; the resident sees the update.",
    capture: "Optional: accepted staff reply and resident update",
    required: false,
  },
  {
    id: "closing",
    seconds: 25,
    title: "A clearer civic journey",
    caption:
      "Official links remain official links. Practice feedback remains in envoy until a real organization participates.",
    capture: "Final deployed source and receipt view",
    required: true,
  },
] as const;

export type Scene = (typeof scenes)[number];
export type SceneId = Scene["id"];

export const durationInFrames = scenes.reduce(
  (total, scene) => total + scene.seconds * FPS,
  0,
);
