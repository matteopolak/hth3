import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import rawCaptures from "../capture-manifest.json";
import { FPS, scenes, type Scene, type SceneId } from "./story";

type Capture = {
  status: "missing" | "captured";
  file: string | null;
  recordedAt: string | null;
  evidence: string | null;
};

const captures = rawCaptures as Record<SceneId | "narration", Capture>;

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

const SceneFrame = ({ scene, index }: { scene: Scene; index: number }) => {
  const frame = useCurrentFrame();
  const capture = captures[scene.id];
  const hasClip = capture.status === "captured" && Boolean(capture.file);
  const fade = Math.min(1, frame / 12, (scene.seconds * FPS - frame) / 12);

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
            {scene.caption}
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
            : "Storyboard placeholder — not product footage"}
        </div>
        <div>{scene.seconds}s</div>
      </div>
    </AbsoluteFill>
  );
};

export const EnvoyEvidence = () => {
  let start = 0;
  const narration = captures.narration;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.paper }}>
      {narration.status === "captured" && narration.file ? (
        <Audio src={staticFile(narration.file)} />
      ) : null}
      {scenes.map((scene, index) => {
        const from = start;
        const length = scene.seconds * FPS;
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
