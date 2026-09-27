import type { ReactNode } from "react";
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
import { draftClips } from "./draft-clips";
import draftNarration from "./draft-narration.generated.json";
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
  teal: "#85d8cb",
  coral: "#ff9e8a",
  blue: "#8daef5",
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

const PaintSplash = ({ frame, fps }: { frame: number; fps: number }) => {
  const wave = frame / fps;
  return (
    <svg
      viewBox="0 0 1300 760"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        top: -34,
        right: -34,
        bottom: -34,
        left: 0,
        width: "calc(100% + 34px)",
        height: "calc(100% + 68px)",
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <g
        transform={`translate(${Math.sin(wave * 0.42) * 20} ${Math.cos(wave * 0.36) * 16})`}
      >
        <path
          d="M1110 15c91 23 154 80 148 156-5 55-64 66-81 121-20 68-122 54-174 19-48-33-18-81-69-123-43-35-29-82 17-117 45-35 97-71 159-56Z"
          fill={colors.teal}
          opacity="0.8"
        />
        <circle cx="991" cy="35" r="15" fill={colors.teal} opacity="0.78" />
        <circle cx="1259" cy="314" r="12" fill={colors.teal} opacity="0.7" />
      </g>
      <g
        transform={`translate(${130 + Math.cos(wave * 0.32) * 22} ${Math.sin(wave * 0.48) * 18})`}
      >
        <path
          d="M-65 503c62-46 150-45 183 15 26 47 5 89 47 119 39 28 58 85 12 115-51 32-96-8-149-2-60 8-106-43-101-102 3-44-37-103 8-145Z"
          fill={colors.coral}
          opacity="0.78"
        />
        <circle cx="186" cy="681" r="18" fill={colors.coral} opacity="0.7" />
      </g>
      <g
        transform={`translate(${Math.sin(wave * 0.28) * 13} ${Math.cos(wave * 0.44) * 12})`}
      >
        <path
          d="M839 707c41-40 75-33 100-65 32-42 89-37 112 5 25 46 81 29 107 73 28 47-2 100-53 104-59 4-76-35-124-27-55 9-102-7-142-42-19-17-19-32 0-48Z"
          fill={colors.blue}
          opacity="0.76"
        />
        <circle cx="797" cy="721" r="12" fill={colors.blue} opacity="0.7" />
      </g>
    </svg>
  );
};

const WebMonitor = ({ children }: { children: ReactNode }) => (
  <>
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        right: 8,
        bottom: 45,
        border: `9px solid ${colors.ink}`,
        borderRadius: 22,
        background: colors.white,
        boxShadow:
          "0 26px 42px rgba(24,24,24,0.16), 0 5px 12px rgba(24,24,24,0.12)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 15,
        left: "calc(50% - 46px)",
        width: 92,
        height: 31,
        background: "linear-gradient(90deg, #454545, #202020 55%, #4c4c4c)",
        borderRadius: "0 0 6px 6px",
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: 5,
        left: "calc(50% - 115px)",
        width: 230,
        height: 12,
        borderRadius: 12,
        background: colors.ink,
        boxShadow: "0 7px 12px rgba(24,24,24,0.16)",
      }}
    />
  </>
);

const PhoneShowcase = ({ file }: { file: string }) => (
  <>
    <div
      style={{
        position: "absolute",
        top: 3,
        left: "15%",
        width: 346,
        height: 742,
        border: `9px solid ${colors.ink}`,
        borderRadius: 50,
        background: colors.ink,
        boxShadow:
          "0 28px 48px rgba(24,24,24,0.22), 0 6px 15px rgba(24,24,24,0.16)",
        overflow: "hidden",
      }}
    >
      <Img
        src={staticFile(file)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          top: 8,
          left: "calc(50% - 47px)",
          width: 94,
          height: 17,
          borderRadius: 20,
          background: colors.ink,
        }}
      />
    </div>
    <div
      style={{
        position: "absolute",
        top: 143,
        right: 0,
        width: "43%",
        height: 455,
        border: `1px solid ${colors.line}`,
        borderRadius: 22,
        background: colors.white,
        boxShadow: "0 24px 36px rgba(24,24,24,0.13)",
        overflow: "hidden",
      }}
    >
      <Img
        src={staticFile(file)}
        style={{
          position: "absolute",
          top: -320,
          left: 0,
          width: "100%",
          height: "auto",
        }}
      />
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 42,
        right: 8,
        padding: "10px 16px",
        borderRadius: 20,
        background: colors.white,
        fontSize: 18,
        color: colors.ink,
      }}
    >
      Native iPhone simulator
    </div>
  </>
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
      Feedback activity · Tiger Data · September 26, 19:41 UTC
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
      The report added {tigerReportEvents.result_sets[0]?.rows.length ?? 0}{" "}
      events: {reportEventTypes}.
    </div>
    <div style={{ fontSize: 18, color: colors.muted }}>
      Event metadata only. Resident message bodies stay in Envoy.
    </div>
  </AbsoluteFill>
);

const StaffBoundary = ({ frame, fps }: { frame: number; fps: number }) => {
  const active = Math.min(2, Math.floor(frame / (12 * fps)));
  const steps = [
    {
      title: "Hosted sign-in",
      detail: "Auth0 SPA and Envoy organization configured",
      status: "Configuration checked",
    },
    {
      title: "Worker authorization",
      detail: "JWT grant and D1 organization membership checked in code",
      status: "Implementation present",
    },
    {
      title: "Scoped staff action",
      detail: "Real role token, permitted reply, and resident update",
      status: "Live acceptance pending",
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: colors.white,
        padding: 48,
        justifyContent: "center",
        gap: 22,
      }}
    >
      <div style={{ fontSize: 19, color: colors.muted, marginBottom: 8 }}>
        Protecting the staff workspace
      </div>
      {steps.map((step, index) => (
        <div
          key={step.title}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            border: `1px solid ${colors.line}`,
            borderRadius: 14,
            padding: "24px 28px",
            background: index === active ? "#f3f3f3" : colors.white,
            opacity: index > active ? 0.62 : 1,
          }}
        >
          <div style={{ fontSize: 19, color: colors.muted }}>
            {String(index + 1).padStart(2, "0")}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 25, fontWeight: 620 }}>{step.title}</div>
            <div style={{ fontSize: 19, color: colors.muted, marginTop: 7 }}>
              {step.detail}
            </div>
          </div>
          <div
            style={{
              fontSize: 17,
              color: index === 2 ? colors.ink : colors.muted,
              maxWidth: 150,
              textAlign: "right",
            }}
          >
            {step.status}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

const sceneFooters: Record<SceneId, string> = {
  home: "Start as a guest.",
  sources: "Official actions continue on the publisher's site.",
  agent: "Your report waits for your approval.",
  feedback: "Reports stay in Envoy's review queue.",
  tiger: "Privacy-safe event metadata shows the trend.",
  staff: "Staff actions require a role and organization membership.",
  closing: "Real places. Clear next steps.",
};

const SceneFrame = ({ scene, review }: { scene: Scene; review: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const capture = captures[scene.id];
  const hasClip = capture.status === "captured" && Boolean(capture.file);
  const draftClip = review ? draftClips[scene.id] : undefined;
  const showDraftClip =
    !hasClip && Boolean(draftClip) && frame < (draftClip?.seconds ?? 0) * fps;
  const narration = review
    ? draftNarration.filter((segment) => segment.sceneId === scene.id)
    : [];
  const activeSubtitle = narration.find((segment) => {
    const seconds = frame / fps;
    return (
      seconds >= segment.startSeconds &&
      seconds < segment.startSeconds + segment.durationSeconds
    );
  });
  const stills = draftStills[scene.id];
  const still =
    stills?.[
      Math.min(
        stills.length - 1,
        Math.floor(frame / ((scene.seconds * fps) / stills.length)),
      )
    ];
  const nativeStill =
    !hasClip &&
    !showDraftClip &&
    still?.file.includes("native-nearby-simulator");
  const fade = Math.min(1, frame / 12, (scene.seconds * fps - frame) / 12);
  const bookend =
    (scene.id === "home" && frame < 5 * fps) ||
    (scene.id === "closing" && frame >= (scene.seconds - 8) * fps);

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
          Find · understand · act
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
          <div
            style={{
              width: 68,
              height: 8,
              borderRadius: 8,
              background: [colors.teal, colors.coral, colors.blue][
                scenes.findIndex((item) => item.id === scene.id) % 3
              ],
              marginBottom: 27,
            }}
          />
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

        <div style={{ flex: 1, position: "relative", overflow: "visible" }}>
          <PaintSplash frame={frame} fps={fps} />
          {nativeStill && still ? (
            <PhoneShowcase file={still.file} />
          ) : (
            <WebMonitor>
              {hasClip && capture.file ? (
                <OffthreadVideo
                  src={staticFile(capture.file)}
                  style={{ width: "100%", height: "100%", objectFit: "fill" }}
                  volume={0}
                />
              ) : showDraftClip && draftClip ? (
                <OffthreadVideo
                  src={staticFile(draftClip.file)}
                  style={{ width: "100%", height: "100%", objectFit: "fill" }}
                  volume={0}
                />
              ) : still ? (
                <Img
                  src={staticFile(still.file)}
                  style={{ width: "100%", height: "100%", objectFit: "fill" }}
                />
              ) : scene.id === "tiger" ? (
                <TigerSnapshot />
              ) : scene.id === "staff" && review ? (
                <StaffBoundary frame={frame} fps={fps} />
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
                    style={{
                      fontSize: 24,
                      color: colors.muted,
                      lineHeight: 1.5,
                    }}
                  >
                    {scene.required
                      ? "Capture pending"
                      : "Live acceptance pending"}
                  </div>
                </AbsoluteFill>
              )}
            </WebMonitor>
          )}
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${colors.line}`,
          marginTop: 34,
          paddingTop: 24,
          fontSize: 20,
          color: colors.muted,
        }}
      >
        {nativeStill
          ? "iPhone simulator shown; physical-device and API acceptance pending."
          : sceneFooters[scene.id]}
      </div>

      {scene.id === "home" && frame < 5 * fps ? (
        <AbsoluteFill
          style={{
            backgroundColor: colors.paper,
            alignItems: "center",
            justifyContent: "center",
            opacity: Math.min(1, Math.max(0, (5 * fps - frame) / (0.4 * fps))),
          }}
        >
          <PaintSplash frame={frame} fps={fps} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 26,
              zIndex: 1,
            }}
          >
            <Brand />
            <div style={{ fontSize: 50, fontWeight: 600, letterSpacing: -2 }}>
              A clearer next step
            </div>
            <div style={{ fontSize: 23, color: colors.muted }}>
              Public sources · resident report inbox
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {scene.id === "closing" && frame >= (scene.seconds - 8) * fps ? (
        <AbsoluteFill
          style={{
            backgroundColor: colors.paper,
            alignItems: "center",
            justifyContent: "center",
            opacity: Math.min(1, (frame - (scene.seconds - 8) * fps) / fps),
          }}
        >
          <PaintSplash frame={frame} fps={fps} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 28,
              zIndex: 1,
            }}
          >
            <Brand />
            <div style={{ fontSize: 50, fontWeight: 600, letterSpacing: -2 }}>
              Find the next step. Make it count.
            </div>
            <div style={{ fontSize: 23, color: colors.muted }}>
              civicresolve-api-production.matteopolak.workers.dev
            </div>
            <div style={{ fontSize: 19, color: colors.muted }}>
              Reports do not reach a government office.
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {narration.map((segment) => (
        <Sequence
          key={segment.file}
          from={Math.round(segment.startSeconds * fps)}
          durationInFrames={Math.ceil(segment.durationSeconds * fps)}
        >
          <Audio src={staticFile(segment.file)} />
        </Sequence>
      ))}

      {activeSubtitle ? (
        <div
          style={{
            position: "absolute",
            left: bookend ? "50%" : 72,
            bottom: bookend ? 152 : 188,
            width: bookend ? 760 : 430,
            transform: bookend ? "translateX(-50%)" : undefined,
            textAlign: bookend ? "center" : "left",
            borderTop: bookend ? "none" : `1px solid ${colors.line}`,
            paddingTop: 18,
            color: colors.ink,
            fontSize: bookend ? 23 : 21,
            lineHeight: 1.34,
          }}
        >
          {activeSubtitle.text}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const EnvoyEvidence = ({ review = false }: { review?: boolean }) => {
  let start = 0;
  const { fps } = useVideoConfig();
  const narration = captures.narration;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.paper }}>
      {narration.status === "captured" && narration.file ? (
        <Audio src={staticFile(narration.file)} />
      ) : null}
      {scenes.map((scene) => {
        const from = start;
        const length = scene.seconds * fps;
        start += length;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={length}>
            <SceneFrame scene={scene} review={review} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
