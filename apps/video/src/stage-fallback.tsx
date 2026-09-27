import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const stageFallbackFps = 15;

const steps = [
  {
    id: "home",
    seconds: 10,
    title: "Find your next step",
    note: "Ask, explore, or share a concern",
  },
  {
    id: "jobs",
    seconds: 18,
    title: "Choose an official job",
    note: "Prepare in Envoy · apply with the publisher",
  },
  {
    id: "nearby",
    seconds: 10,
    title: "Explore nearby services",
    note: "78 sourced places on a real map",
  },
  {
    id: "agent",
    seconds: 20,
    title: "Ask the assistant",
    note: "An editable report waits for your approval",
  },
  {
    id: "feedback",
    seconds: 18,
    title: "Review your own words",
    note: "The destination is Envoy's review team",
  },
  {
    id: "close",
    seconds: 6,
    title: "Make the next step clear",
    note: "envoy.surf",
  },
] as const;

export const stageFallbackDurationFrames = steps.reduce(
  (total, step) => total + step.seconds * stageFallbackFps,
  0,
);

function ProductScreen({
  id,
  frame,
}: {
  id: (typeof steps)[number]["id"];
  frame: number;
}) {
  const shared = { width: "100%", height: "100%", objectFit: "cover" as const };
  if (id === "home")
    return (
      <Img
        src={staticFile("captures/current-home-envoy-surf-2026-09-26.png")}
        style={shared}
      />
    );
  if (id === "jobs")
    return (
      <OffthreadVideo
        src={staticFile("captures/current-job-flow-envoy-surf-2026-09-26.mp4")}
        volume={0}
        style={shared}
      />
    );
  if (id === "nearby" || id === "close")
    return (
      <Img
        src={staticFile("captures/current-nearby-envoy-surf-2026-09-26.png")}
        style={shared}
      />
    );
  if (id === "agent")
    return frame < 12 * stageFallbackFps ? (
      <OffthreadVideo
        src={staticFile("captures/current-agent-envoy-surf-2026-09-26.mp4")}
        volume={0}
        style={shared}
      />
    ) : (
      <Img
        src={staticFile(
          "captures/current-agent-pending-envoy-surf-2026-09-26.png",
        )}
        style={shared}
      />
    );
  return frame < 14 * stageFallbackFps ? (
    <OffthreadVideo
      src={staticFile(
        "captures/production-feedback-submit-redacted-2026-09-26.mp4",
      )}
      volume={0}
      style={shared}
    />
  ) : (
    <Img
      src={staticFile("captures/feedback-review-pre-submit-2026-09-26.png")}
      style={shared}
    />
  );
}

function StageStep({
  step,
  number,
}: {
  step: (typeof steps)[number];
  number: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = Math.min(1, frame / 8, (step.seconds * fps - frame) / 8);
  return (
    <AbsoluteFill
      style={{
        background: "#f8f8f7",
        color: "#171717",
        fontFamily: "Arial, Helvetica, sans-serif",
        opacity: Math.max(0, opacity),
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 42,
          left: 160,
          right: 160,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 47, fontWeight: 700, letterSpacing: -1.7 }}>
          {step.title}
        </div>
        <div style={{ color: "#62676d", fontSize: 24 }}>
          {String(number).padStart(2, "0")} / 06
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 147,
          left: 160,
          width: 1600,
          height: 812,
          overflow: "hidden",
          border: "1px solid #d6d6d6",
          borderRadius: 18,
          boxShadow: "0 20px 38px #0002",
        }}
      >
        <ProductScreen id={step.id} frame={frame} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 53,
          left: 160,
          right: 160,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 25,
          color: "#454950",
        }}
      >
        <span>{step.note}</span>
        <strong style={{ color: "#171717", fontSize: 26 }}>envoy</strong>
      </div>
    </AbsoluteFill>
  );
}

export function EnvoyStageFallback() {
  let start = 0;
  return (
    <AbsoluteFill>
      <Audio src={staticFile("music-your-breath-mixkit.mp3")} volume={0.08} />
      {steps.map((step, index) => {
        const from = start;
        start += step.seconds * stageFallbackFps;
        return (
          <Sequence
            key={step.id}
            from={from}
            durationInFrames={step.seconds * stageFallbackFps}
          >
            <StageStep step={step} number={index + 1} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
