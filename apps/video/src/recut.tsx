import type { CSSProperties, ReactNode } from "react";
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
import evidence from "./evidence-snippets.generated.json";
import voiceover from "./custom-narration.generated.json";
import { highlightCode } from "./syntax";
import modelProjection from "../public/models/creative-trio-monitor.json";

const fps = 30;
const beats = [
  {
    id: "open",
    seconds: 10,
    title: "Civic steps, in one place",
    detail: "Find · understand · act",
    color: "#7ecfc1",
  },
  {
    id: "sources",
    seconds: 18,
    title: "Find the official source",
    detail: "25 jobs · 78 nearby places · public consultations",
    color: "#93adff",
  },
  {
    id: "agent",
    seconds: 14,
    title: "Ask in plain language",
    detail: "The assistant prepares a report for review",
    color: "#f7a990",
  },
  {
    id: "feedback",
    seconds: 14,
    title: "Review, then send",
    detail: "A real submission to Envoy's own review team",
    color: "#f7a990",
  },
  {
    id: "voice",
    seconds: 19,
    title: "A voice conversation",
    detail: "ElevenLabs session · resident confirmation",
    color: "#93adff",
  },
  {
    id: "tiger",
    seconds: 21,
    title: "Turn activity into signals",
    detail: "D1 outbox · Tiger time series",
    color: "#7ecfc1",
  },
  {
    id: "presage",
    seconds: 19,
    title: "Adapt the native app",
    detail: "SwiftUI · optional Presage accessibility",
    color: "#f7a990",
  },
  {
    id: "auth",
    seconds: 23,
    title: "Scope every staff action",
    detail: "Auth0 · signed tokens · organization membership",
    color: "#93adff",
  },
  {
    id: "closing",
    seconds: 12,
    title: "A clearer next step",
    detail: "envoy.surf",
    color: "#7ecfc1",
  },
] as const;

export const recutDurationFrames = beats.reduce(
  (total, beat) => total + beat.seconds * fps,
  0,
);

const ink = "#171717";
const paper = "#f9f9f8";

function Logo({ large = false }: { large?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: large ? 20 : 12,
        fontSize: large ? 59 : 29,
        fontWeight: 700,
        letterSpacing: -2,
      }}
    >
      <span
        style={{
          width: large ? 68 : 36,
          height: large ? 68 : 36,
          borderRadius: large ? 17 : 10,
          display: "grid",
          placeItems: "center",
          background: ink,
          color: "white",
          fontSize: large ? 44 : 23,
          lineHeight: 1,
        }}
      >
        e
      </span>
      envoy
    </div>
  );
}

// Six actual CSS 3D faces, with perspective, lighting and rotation. This is
// depth geometry, rather than a rotated flat screenshot.
function OrbitCube({
  frame,
  color,
  size = 96,
}: {
  frame: number;
  color: string;
  size?: number;
}) {
  const half = size / 2;
  const faces: Array<[string, string]> = [
    [`translateZ(${half}px)`, color],
    [`rotateY(180deg) translateZ(${half}px)`, "#313b4e"],
    [`rotateY(90deg) translateZ(${half}px)`, "#52607a"],
    [`rotateY(-90deg) translateZ(${half}px)`, "#a4afc4"],
    [`rotateX(90deg) translateZ(${half}px)`, "#d5dbe5"],
    [`rotateX(-90deg) translateZ(${half}px)`, "#445066"],
  ];
  return (
    <div
      style={{
        width: size,
        height: size,
        perspective: 500,
        filter: "drop-shadow(0 20px 18px #30384030)",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${22 + frame * 0.42}deg) rotateY(${-33 + frame * 0.55}deg)`,
        }}
      >
        {faces.map(([transform, shade]) => (
          <div
            key={transform}
            style={{
              position: "absolute",
              inset: 0,
              border: "1px solid #ffffff88",
              borderRadius: 12,
              background: shade,
              opacity: 0.92,
              transform,
              backfaceVisibility: "hidden",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Paint({ frame, color }: { frame: number; color: string }) {
  const dx = Math.sin(frame / 28) * 26;
  const dy = Math.cos(frame / 34) * 18;
  const burst = Math.max(0, 1 - frame / 31);
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: -170 + dy,
          right: -130 + dx,
          width: 520,
          height: 430,
          borderRadius: "42% 58% 63% 37% / 46% 42% 58% 54%",
          background: color,
          opacity: 0.47,
          transform: `rotate(${frame / 5}deg)`,
          filter: "blur(1px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -180 - dy,
          left: -140 - dx,
          width: 480,
          height: 430,
          borderRadius: "67% 33% 42% 58% / 38% 57% 43% 62%",
          background: color,
          opacity: 0.24,
          transform: `rotate(${-frame / 7}deg)`,
        }}
      />
      {(
        [
          [620, 120, 28, -32],
          [532, 775, 19, 25],
          [1580, 836, 23, 18],
          [1210, 100, 13, -22],
        ] as Array<[number, number, number, number]>
      ).map(([x, y, size, velocity], index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: x + velocity * (1 - burst),
            top: y + (index % 2 ? 35 : -35) * (1 - burst),
            width: size,
            height: size * 0.72,
            background: color,
            opacity: burst * 0.9,
            borderRadius: "53% 47% 67% 33% / 54% 41% 59% 46%",
            transform: `rotate(${index * 47 + frame * 2}deg)`,
          }}
        />
      ))}
    </>
  );
}

function Monitor({ children, frame }: { children: ReactNode; frame: number }) {
  const y = Math.sin(frame / 42) * 2.8;
  const [topLeft, topRight, , bottomLeft] = modelProjection.screen as [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  const skewDegrees =
    (Math.atan2(topRight[1] - topLeft[1], topRight[0] - topLeft[0]) * 180) /
    Math.PI;
  // Fill the model's actual screen plane. Its projected ratio is wider than
  // the 1600 × 812 capture, so the footage crops vertically via object-fit.
  // A one-pixel bleed hides antialias seams without stretching the footage.
  const screenHeight = bottomLeft[1] - topLeft[1] + 2;
  const screenWidth = topRight[0] - topLeft[0] + 2;
  const screenLeft = topLeft[0] - 1;
  const screenTop = topLeft[1] - 1;
  return (
    <div
      style={{
        width: 1176,
        height: 700,
        position: "relative",
        transform: `translateY(${y}px)`,
        filter: "drop-shadow(0 27px 23px #10111429)",
      }}
    >
      <Img
        src={staticFile("models/creative-trio-monitor.png")}
        style={{ width: 1176, height: 700, position: "absolute", inset: 0 }}
      />
      <div
        style={{
          position: "absolute",
          left: screenLeft,
          top: screenTop,
          width: screenWidth,
          height: screenHeight,
          background: "#111216",
          overflow: "hidden",
          transformOrigin: "left top",
          transform: `skewY(${skewDegrees}deg)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

type EvidenceScene = "voice" | "tiger" | "presage" | "auth";
type Snippet = { file: string; rows: Array<{ number: number; text: string }> };
const snippets = evidence as Record<EvidenceScene, Snippet[]>;

function CodeEvidence({
  scene,
  frame,
}: {
  scene: EvidenceScene;
  frame: number;
}) {
  const list = snippets[scene];
  const period = scene === "auth" ? 6 : 9;
  const index = Math.min(list.length - 1, Math.floor(frame / (period * fps)));
  const item = list[index]!;
  const notes: Record<EvidenceScene, string[]> = {
    voice: ["Signed session endpoint", "Explicit review-team disclosure"],
    tiger: ["Privacy-safe event schema", "D1 outbox delivery"],
    presage: ["Camera consent and sample", "Stable reading and consent reset"],
    auth: [
      "Hosted organization login",
      "Membership intersected with token roles",
      "Organization-scoped assignment",
      "Scoped staff reply",
    ],
  };
  return (
    <AbsoluteFill
      style={{
        background: "#171a20",
        color: "#e7ebf1",
        padding: "23px 30px",
        fontFamily: "SFMono-Regular, Menlo, Consolas, monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 17,
          color: "#b5bfd0",
        }}
      >
        <span>{notes[scene][index]}</span>
        <span>source code</span>
      </div>
      <div
        style={{
          marginTop: 11,
          padding: "9px 12px",
          borderRadius: 6,
          background: "#ffffff10",
          color: "#96ceef",
          fontSize: 14,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.file}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "35px 1fr",
          gap: "4px 10px",
          marginTop: 16,
          fontSize: item.rows.length > 10 ? 13 : 15,
          lineHeight: 1.27,
        }}
      >
        {item.rows.map((row) => (
          <div key={`${index}-${row.number}`} style={{ display: "contents" }}>
            <span style={{ color: "#788497", textAlign: "right" }}>
              {row.number}
            </span>
            <span
              style={{
                overflow: "hidden",
                whiteSpace: "pre",
                textOverflow: "ellipsis",
                color: "#e7ebf1",
              }}
            >
              {highlightCode(row.text, item.file)}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: `${((index + 1) / list.length) * 100}%`,
          height: 5,
          background: "#91d6c7",
        }}
      />
    </AbsoluteFill>
  );
}

function Caption({ scene, frame }: { scene: string; frame: number }) {
  const line = voiceover.find((entry) => entry.sceneId === scene);
  if (!line) return null;
  const speechFrame = frame - line.startSeconds * fps;
  if (speechFrame < 0 || speechFrame >= line.durationSeconds * fps) return null;
  const words = line.text.split(/\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).length > 58 && current) {
      chunks.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) chunks.push(current);
  const index = Math.min(
    chunks.length - 1,
    Math.floor((speechFrame / (line.durationSeconds * fps)) * chunks.length),
  );
  return (
    <div
      style={{
        position: "absolute",
        bottom: 42,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: 1250,
        padding: "10px 21px",
        borderRadius: 10,
        background: "#171717d9",
        color: "white",
        fontSize: 24,
        lineHeight: 1.28,
        textAlign: "center",
        fontWeight: 520,
        boxShadow: "0 8px 22px #0002",
        zIndex: 20,
      }}
    >
      {chunks[index]}
    </div>
  );
}

function Footage({ scene, frame }: { scene: string; frame: number }) {
  const cover: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
  const neutralSidebar = (child: ReactNode) => (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {child}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "15.5%",
          height: "100%",
          backdropFilter: "grayscale(1)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
  if (scene === "open")
    return (
      <Img
        src={staticFile("captures/current-home-envoy-surf-2026-09-26.png")}
        style={{ ...cover, transform: `scale(${1.02 + frame / 3800})` }}
      />
    );
  if (scene === "sources") {
    return frame < 10 * fps ? (
      <OffthreadVideo
        src={staticFile("captures/current-job-flow-envoy-surf-2026-09-26.mp4")}
        playbackRate={1.5}
        style={cover}
        volume={0}
      />
    ) : (
      neutralSidebar(
        <OffthreadVideo
          src={staticFile("captures/production-sources-2026-09-26.mp4")}
          startFrom={23 * fps}
          playbackRate={2.25}
          style={cover}
          volume={0}
        />,
      )
    );
  }
  if (scene === "agent") {
    return frame < 6 * fps ? (
      <OffthreadVideo
        src={staticFile("captures/current-agent-envoy-surf-2026-09-26.mp4")}
        playbackRate={2}
        style={cover}
        volume={0}
      />
    ) : (
      <Img
        src={staticFile(
          "captures/current-agent-pending-envoy-surf-2026-09-26.png",
        )}
        style={{
          ...cover,
          transform: `scale(${1.02 + (frame - 6 * fps) / 2400})`,
        }}
      />
    );
  }
  if (scene === "feedback")
    return neutralSidebar(
      <OffthreadVideo
        src={staticFile(
          "captures/production-feedback-submit-redacted-2026-09-26.mp4",
        )}
        startFrom={2 * fps}
        playbackRate={1.5}
        style={cover}
        volume={0}
      />,
    );
  return (
    <Img
      src={staticFile("captures/current-home-envoy-surf-2026-09-26.png")}
      style={cover}
    />
  );
}

function Scene({ beat }: { beat: (typeof beats)[number] }) {
  const frame = useCurrentFrame();
  const { fps: currentFps } = useVideoConfig();
  const fade = Math.min(1, frame / 8, (beat.seconds * currentFps - frame) / 8);
  const voice = voiceover.find((entry) => entry.sceneId === beat.id);
  return (
    <AbsoluteFill
      style={{
        background: paper,
        color: ink,
        fontFamily: "Arial, Helvetica, sans-serif",
        opacity: Math.max(0, fade),
        overflow: "hidden",
      }}
    >
      <Paint frame={frame} color={beat.color} />
      <div
        style={{
          position: "absolute",
          top: 39,
          left: 70,
          right: 70,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 5,
        }}
      >
        <Logo />
        <div style={{ fontSize: 20, fontWeight: 550, color: "#62656b" }}>
          {String(beats.indexOf(beat) + 1).padStart(2, "0")} / 09
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 156,
          left: 76,
          width: 524,
          zIndex: 4,
        }}
      >
        <div
          style={{
            width: 64,
            height: 7,
            borderRadius: 9,
            background: beat.color,
            marginBottom: 27,
          }}
        />
        <h1
          style={{
            fontSize: beat.id === "open" ? 74 : 61,
            letterSpacing: -3.2,
            lineHeight: 1.02,
            margin: 0,
            fontWeight: 690,
          }}
        >
          {beat.title}
        </h1>
        <p
          style={{
            fontSize: 25,
            lineHeight: 1.28,
            color: "#60656a",
            marginTop: 26,
            maxWidth: 440,
          }}
        >
          {beat.detail}
        </p>
        {beat.id === "voice" && (
          <p style={{ fontSize: 22, marginTop: 56, color: "#354046" }}>
            Spoken concern + follow-up
            <br />
            Web handoff pending
          </p>
        )}
        {beat.id === "tiger" && (
          <p style={{ fontSize: 22, marginTop: 46, color: "#354046" }}>
            4 delivered events
            <br />4 aggregate events
            <br />
            <span style={{ fontSize: 18, color: "#747a80" }}>
              Read-only query · Sep 26, 19:41 UTC
            </span>
          </p>
        )}
        {beat.id === "presage" && (
          <p style={{ fontSize: 22, marginTop: 50, color: "#354046" }}>
            Simulator build verified
            <br />
            Physical reading pending
          </p>
        )}
        {beat.id === "auth" && (
          <p style={{ fontSize: 22, marginTop: 42, color: "#354046" }}>
            Queue · assignment · reply
            <br />
            <span style={{ fontSize: 18, color: "#747a80" }}>
              Live scoped staff action pending
            </span>
          </p>
        )}
        {beat.id === "closing" && (
          <p style={{ fontSize: 25, marginTop: 50, fontWeight: 640 }}>
            Official links stay official.
            <br />
            Reports stay with Envoy.
          </p>
        )}
      </div>
      <div style={{ position: "absolute", left: 683, top: 134, zIndex: 2 }}>
        <Monitor frame={frame}>
          {beat.id === "voice" ||
          beat.id === "tiger" ||
          beat.id === "presage" ||
          beat.id === "auth" ? (
            <CodeEvidence scene={beat.id} frame={frame} />
          ) : beat.id === "closing" ? (
            <Img
              src={staticFile(
                "captures/current-nearby-envoy-surf-2026-09-26.png",
              )}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Footage scene={beat.id} frame={frame} />
          )}
        </Monitor>
      </div>
      <div style={{ position: "absolute", left: 600, top: 89, zIndex: 7 }}>
        <OrbitCube frame={frame} color={beat.color} size={88} />
      </div>
      {beat.id === "presage" && (
        <div
          style={{
            position: "absolute",
            top: 405,
            left: 488,
            width: 165,
            height: 320,
            perspective: 900,
            zIndex: 10,
          }}
        >
          <div
            style={{
              position: "relative",
              width: 150,
              height: 300,
              transformStyle: "preserve-3d",
              transform: `rotateY(${-22 + Math.sin(frame / 35) * 3}deg) rotateX(4deg)`,
              filter: "drop-shadow(17px 24px 17px #0004)",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 150,
                height: 300,
                transform: "translateZ(-14px)",
                borderRadius: 26,
                background: "#565d67",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 144,
                top: 11,
                width: 28,
                height: 278,
                transformOrigin: "left center",
                transform: "rotateY(90deg)",
                borderRadius: 7,
                background: "linear-gradient(90deg,#585f69,#171a20)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 25,
                border: "9px solid #181b20",
                background: "#181b20",
                overflow: "hidden",
                transform: "translateZ(14px)",
              }}
            >
              <Img
                src={staticFile(
                  "captures/native-nearby-simulator-2026-09-26.png",
                )}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: 48,
                  width: 38,
                  height: 9,
                  background: "#171a20",
                  borderRadius: 8,
                }}
              />
              <span
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "#111d",
                  padding: 5,
                  color: "white",
                  textAlign: "center",
                  fontSize: 12,
                }}
              >
                SwiftUI Nearby simulator
              </span>
            </div>
          </div>
        </div>
      )}
      {beat.id === "feedback" && (
        <div
          style={{
            position: "absolute",
            bottom: 142,
            right: 120,
            color: "#555",
            fontSize: 17,
          }}
        >
          Submitted to Envoy · private receipt masked
        </div>
      )}
      {beat.id === "sources" && (
        <div
          style={{
            position: "absolute",
            bottom: 140,
            right: 122,
            color: "#555",
            fontSize: 17,
          }}
        >
          Preparation in Envoy · application on publisher site
        </div>
      )}
      {beat.id === "closing" && (
        <div
          style={{
            position: "absolute",
            bottom: 145,
            right: 124,
            fontSize: 33,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          envoy.surf
        </div>
      )}
      <Caption scene={beat.id} frame={frame} />
      {voice && (
        <Sequence from={Math.round(voice.startSeconds * currentFps)}>
          <Audio src={staticFile(voice.file)} volume={1} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

export function EnvoyRecut() {
  let start = 0;
  return (
    <AbsoluteFill style={{ background: paper }}>
      <Audio src={staticFile("music-your-breath-mixkit.mp3")} volume={0.075} />
      {beats.map((beat) => {
        const from = start;
        start += beat.seconds * fps;
        return (
          <Sequence
            key={beat.id}
            from={from}
            durationInFrames={beat.seconds * fps}
          >
            <Scene beat={beat} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
