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
import rawCaptures from "../capture-manifest.json";
import tigerQuery from "../evidence/tiger-counts-2026-09-26.json";
import tigerReportEvents from "../evidence/tiger-report-events-2026-09-26.json";
import { draftStills } from "./draft-stills";
import { scenes, type Scene, type SceneId } from "./story";

type Capture = {
  status: "missing" | "captured";
  file: string | null;
  recordedAt: string | null;
  evidence: string | null;
};

const captures = rawCaptures as Record<SceneId | "narration", Capture>;
const tigerEventCount = tigerQuery.result_sets[0]?.rows[0]?.[0] ?? "unknown";
const tigerLatestEvent = tigerQuery.result_sets[0]?.rows[0]?.[1] ?? "unknown";
const tigerAggregateCount =
  tigerQuery.result_sets[1]?.rows[0]?.[0] ?? "unknown";
const reportEventTypes = tigerReportEvents.result_sets[0]?.rows
  .map((row) => row[0]?.replace("feedback.", ""))
  .join(" and ");

const colors = {
  paper: "#fafafa",
  white: "#ffffff",
  ink: "#161616",
  muted: "#646464",
  line: "#dedede",
};

const Brand = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
    <svg
      width="35"
      height="35"
      viewBox="0 0 35 35"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="33"
        height="33"
        rx="10"
        stroke={colors.ink}
        strokeWidth="2"
      />
      <path
        d="M9 19h15m-6-6 6 6-6 6"
        stroke={colors.ink}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span style={{ fontSize: 31, fontWeight: 650, letterSpacing: -1.3 }}>
      envoy
    </span>
  </div>
);

const TigerSnapshot = () => (
  <AbsoluteFill
    style={{
      padding: 72,
      justifyContent: "center",
      gap: 32,
      background: colors.white,
    }}
  >
    <div style={{ fontSize: 22, color: colors.muted }}>
      Tiger Cloud · read-only query snapshot · 2026-09-26 19:41 UTC
    </div>
    <div style={{ display: "flex", gap: 24 }}>
      <div
        style={{
          border: `1px solid ${colors.line}`,
          borderRadius: 16,
          padding: 28,
          flex: 1,
        }}
      >
        <div style={{ fontSize: 59, fontWeight: 650 }}>{tigerEventCount}</div>
        <div style={{ fontSize: 23, color: colors.muted }}>
          delivered feedback events
        </div>
      </div>
      <div
        style={{
          border: `1px solid ${colors.line}`,
          borderRadius: 16,
          padding: 28,
          flex: 1,
        }}
      >
        <div style={{ fontSize: 59, fontWeight: 650 }}>
          {tigerAggregateCount}
        </div>
        <div style={{ fontSize: 23, color: colors.muted }}>
          events in daily aggregate
        </div>
      </div>
    </div>
    <div style={{ fontSize: 20, color: colors.muted, lineHeight: 1.5 }}>
      Latest synchronized event: {tigerLatestEvent}.
      <br />
      The newly captured practice report added{" "}
      {tigerReportEvents.result_sets[0]?.rows.length ?? 0} sample events:{" "}
      {reportEventTypes}.
    </div>
    <div style={{ fontSize: 17, color: colors.muted }}>
      Read-only query outputs: apps/video/evidence/tiger-*.json
    </div>
  </AbsoluteFill>
);

const SceneFrame = ({ scene, index }: { scene: Scene; index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const capture = captures[scene.id];
  const hasClip = capture.status === "captured" && Boolean(capture.file);
  const stills = draftStills[scene.id];
  const still =
    stills?.[
      Math.min(
        stills.length - 1,
        Math.floor(frame / ((scene.seconds * fps) / stills.length)),
      )
    ];
  const fade = Math.min(1, frame / 12, (scene.seconds * fps - frame) / 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.paper,
        color: colors.ink,
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "55px 72px 46px",
        opacity: Math.max(0, fade),
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Brand />
        <div style={{ color: colors.muted, fontSize: 22 }}>
          Civic Technology
        </div>
      </div>

      <div style={{ marginTop: 44, display: "flex", gap: 54, height: 760 }}>
        <div
          style={{
            width: 430,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ color: colors.muted, fontSize: 22, marginBottom: 25 }}>
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(scenes.length).padStart(2, "0")}
          </div>
          <h1
            style={{
              fontSize: 62,
              lineHeight: 1.08,
              letterSpacing: -2.8,
              margin: 0,
              fontWeight: 620,
            }}
          >
            {scene.title}
          </h1>
          <p
            style={{
              fontSize: 27,
              lineHeight: 1.36,
              color: colors.muted,
              marginTop: 28,
            }}
          >
            {hasClip && "capturedCaption" in scene
              ? scene.capturedCaption
              : scene.caption}
          </p>
        </div>

        <div
          style={{
            flex: 1,
            border: `1px solid ${colors.line}`,
            borderRadius: 22,
            overflow: "hidden",
            background: colors.white,
            position: "relative",
          }}
        >
          {hasClip && capture.file ? (
            <OffthreadVideo
              src={staticFile(capture.file)}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              volume={0}
            />
          ) : still ? (
            <>
              <Img
                src={staticFile(still.file)}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                  padding: "9px 14px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.93)",
                  border: `1px solid ${colors.line}`,
                  color: colors.muted,
                  fontSize: 17,
                }}
              >
                {still.description}
              </div>
            </>
          ) : scene.id === "tiger" ? (
            <TigerSnapshot />
          ) : (
            <AbsoluteFill
              style={{
                alignItems: "center",
                justifyContent: "center",
                padding: 80,
                textAlign: "center",
              }}
            >
              <div
                style={{ fontSize: 24, color: colors.muted, lineHeight: 1.5 }}
              >
                <div
                  style={{
                    color: colors.ink,
                    fontWeight: 650,
                    marginBottom: 16,
                  }}
                >
                  {scene.required
                    ? "Capture required"
                    : "Live acceptance pending"}
                </div>
                {scene.capture}
              </div>
            </AbsoluteFill>
          )}
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${colors.line}`,
          marginTop: 34,
          paddingTop: 24,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 18,
          color: colors.muted,
        }}
      >
        <div>
          {hasClip
            ? "Recorded product interaction"
            : still
              ? "Production screenshot · interaction footage pending · no narration"
              : scene.id === "tiger"
                ? "Dated query evidence · trend-view footage pending · no narration"
                : "Storyboard placeholder — not product footage · no narration"}
        </div>
        <div>{scene.seconds}s</div>
      </div>
    </AbsoluteFill>
  );
};

export const EnvoyEvidence = () => {
  let start = 0;
  const { fps } = useVideoConfig();
  const narration = captures.narration;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.paper }}>
      {narration.status === "captured" && narration.file ? (
        <Audio src={staticFile(narration.file)} />
      ) : null}
      {scenes.map((scene, index) => {
        const from = start;
        const length = scene.seconds * fps;
        start += length;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={length}>
            <SceneFrame scene={scene} index={index} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
