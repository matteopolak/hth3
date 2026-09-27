import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import evidence from "./evidence-snippets.generated.json";
import narration from "./chat-narration.generated.json";
import { Monitor } from "./recut";
import { highlightCode } from "./syntax";

const fps = 30;
const beats = [
  {
    id: "opening",
    seconds: 9,
    color: "#77cbbb",
    line: "Finding work can send you through page after page. Start with the question instead: what jobs are open in Ottawa right now?",
    marker: "A question, then a source",
  },
  {
    id: "jobs",
    seconds: 11,
    color: "#8ea8ed",
    line: "There are ten City of Ottawa roles here, with dates and sources. On a separate BC posting, prepare your answers in Envoy; the application still happens on the publisher's site.",
    marker: "Ottawa jobs · separate BC posting",
  },
  {
    id: "training",
    seconds: 11,
    color: "#e9ab8e",
    line: "Maybe training is the next move. Ask about Ontario support, and Better Jobs Ontario appears with its source. A separate BC funding question brings up StudentAid grants.",
    marker: "Ontario support · separate BC funding",
  },
  {
    id: "nearby",
    seconds: 9,
    color: "#7dcaba",
    line: "If you need to go in person, ask where the office is. Nearby confirms the Ottawa address, and its wider map helps you explore other services.",
    marker: "Ottawa address · wider service map",
  },
  {
    id: "concern",
    seconds: 10,
    color: "#ec9d89",
    line: "Now a different question, in Toronto: a damaged bench. Envoy puts the resident's words into an editable report and stops for review.",
    marker: "Toronto · report awaits approval",
  },
  {
    id: "submit",
    seconds: 9,
    color: "#b795da",
    line: "A separate note to Envoy shows the last step. The destination is Envoy's own review team. The private receipt stays with the resident.",
    marker: "Envoy review team · receipt hidden",
  },
  {
    id: "voice",
    seconds: 9,
    color: "#8da9ef",
    line: "Typing is not the only way in. In one verified voice call, a streetlight concern led to a useful follow-up: what is the nearest intersection?",
    marker: "Voice follow-up verified · web handoff pending",
  },
  {
    id: "tiger",
    seconds: 9,
    color: "#80cdbb",
    line: "The words of a report stay in Envoy's database. Tiger receives event details for trend counts, without a copy of the private message.",
    marker: "4 delivered events · Sep 26, 19:41 UTC",
  },
  {
    id: "presage",
    seconds: 9,
    color: "#e9ab8e",
    line: "On iPhone, the accessibility path asks permission first, then offers a quieter writing layout.",
    marker: "SwiftUI implementation · physical reading pending",
  },
  {
    id: "auth",
    seconds: 12,
    color: "#8da9ef",
    line: "Staff work sits behind a separate door. Auth0 sign-in and Worker membership checks guard the queue, assignment, and replies.",
    marker: "Scoped staff action · live acceptance pending",
  },
  {
    id: "close",
    seconds: 6,
    color: "#78cbb9",
    line: "Ask the question. Check the source. Choose the next step. Envoy dot surf.",
    marker: "envoy.surf",
  },
] as const;

type Beat = (typeof beats)[number];
export const chatFilmFps = fps;
export const chatFilmDurationFrames = beats.reduce(
  (total, beat) => total + beat.seconds * fps,
  0,
);

const screen: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 1920,
  height: 974,
  objectFit: "contain",
};

function Video({
  path,
  start = 0,
  speed = 1,
}: {
  path: string;
  start?: number;
  speed?: number;
}) {
  return (
    <OffthreadVideo
      src={staticFile(path)}
      startFrom={start * fps}
      playbackRate={speed}
      volume={0}
      style={screen}
    />
  );
}

function Still({
  path,
  frame,
  drift = 0,
}: {
  path: string;
  frame: number;
  drift?: number;
}) {
  return (
    <Img
      src={staticFile(path)}
      style={{
        ...screen,
        transform: `scale(${1 + drift * frame})`,
        transformOrigin: "64% 44%",
      }}
    />
  );
}

function SourceCode({
  kind,
  frame,
}: {
  kind: "voice" | "tiger" | "presage" | "auth";
  frame: number;
}) {
  const item = evidence[kind][kind === "tiger" ? 1 : 0]!;
  const rows = item.rows.slice(0, kind === "voice" ? 6 : 8);
  return (
    <div
      style={{
        position: "absolute",
        top: 187,
        left: 260,
        right: 260,
        height: 505,
        padding: "32px 42px",
        background: "#18202b",
        border: "1px solid #445263",
        borderRadius: 18,
        boxShadow: "0 30px 80px #0007",
        color: "#e8edf3",
        fontFamily: "SFMono-Regular, Menlo, Consolas, monospace",
        transform: `translateY(${Math.max(0, 9 - frame)}px)`,
      }}
    >
      <div
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 23,
          fontWeight: 650,
          color: "#d4e0ea",
          marginBottom: 15,
        }}
      >
        {kind === "voice"
          ? "ElevenLabs session"
          : kind === "tiger"
            ? "D1 event outbox"
            : kind === "presage"
              ? "Native consent"
              : "Auth0 organization sign-in"}
      </div>
      <div
        style={{
          color: "#9dd6f3",
          background: "#ffffff0e",
          borderRadius: 7,
          padding: "9px 14px",
          marginBottom: 18,
          fontSize: 20,
        }}
      >
        {item.file.split("/").slice(-2).join("/")}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "55px 1fr",
          gap: "12px 18px",
          fontSize: 25,
          lineHeight: 1.28,
        }}
      >
        {rows.map((row) => (
          <div key={row.number} style={{ display: "contents" }}>
            <span style={{ color: "#8392a5", textAlign: "right" }}>
              {row.number}
            </span>
            <span
              style={{
                whiteSpace: "pre",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {highlightCode(row.text, item.file)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntroModel({ frame }: { frame: number }) {
  return (
    <AbsoluteFill
      style={{
        background: "#f8faf8",
        color: "#171717",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 102,
          top: 255,
          fontSize: 82,
          fontWeight: 700,
          letterSpacing: -4,
          lineHeight: 1.02,
        }}
      >
        Start with
        <br />a question.
      </div>
      <div style={{ position: "absolute", top: 160, left: 650 }}>
        <Monitor frame={frame}>
          <Img
            src={staticFile("captures/current-home-envoy-surf-2026-09-26.png")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Monitor>
      </div>
    </AbsoluteFill>
  );
}

function Product({ beat, frame }: { beat: Beat; frame: number }) {
  if (beat.id === "opening")
    return frame < 45 ? (
      <IntroModel frame={frame} />
    ) : (
      <Video
        path="captures/current-chat-jobs-envoy-surf-2026-09-27.mp4"
        speed={1.15}
      />
    );
  if (beat.id === "jobs")
    return frame < 3 * fps ? (
      <Video
        path="captures/current-chat-jobs-envoy-surf-2026-09-27.mp4"
        start={12}
      />
    ) : (
      <Sequence from={3 * fps}>
        <Video
          path="captures/current-job-flow-envoy-surf-2026-09-26.mp4"
          speed={2}
        />
      </Sequence>
    );
  if (beat.id === "training")
    return frame < 6 * fps ? (
      <Video
        path="captures/current-chat-support-envoy-surf-2026-09-27.mp4"
        start={8}
        speed={1.5}
      />
    ) : (
      <Sequence from={6 * fps}>
        <Video
          path="captures/current-chat-funding-bc-envoy-surf-2026-09-27.mp4"
          start={10}
          speed={2}
        />
      </Sequence>
    );
  if (beat.id === "nearby")
    return frame < 4 * fps ? (
      <Video
        path="captures/current-chat-nearby-envoy-surf-2026-09-27.mp4"
        start={8}
        speed={1.5}
      />
    ) : frame < 6 * fps ? (
      <Still
        path="captures/current-nearby-ottawa-list-envoy-surf-2026-09-27.png"
        frame={frame - 4 * fps}
        drift={0.00012}
      />
    ) : (
      <Still
        path="captures/current-nearby-envoy-surf-2026-09-26.png"
        frame={frame - 6 * fps}
        drift={0.00025}
      />
    );
  if (beat.id === "concern")
    return frame < 6 * fps ? (
      <Video
        path="captures/current-agent-envoy-surf-2026-09-26.mp4"
        start={7}
        speed={1.8}
      />
    ) : (
      <Still
        path="captures/current-agent-pending-envoy-surf-2026-09-26.png"
        frame={frame - 6 * fps}
        drift={0.0003}
      />
    );
  if (beat.id === "submit")
    return (
      <Video
        path="captures/production-feedback-submit-redacted-2026-09-26.mp4"
        start={2}
        speed={2.4}
      />
    );
  if (beat.id === "voice")
    return (
      <Still
        path="captures/current-home-envoy-surf-2026-09-26.png"
        frame={frame}
        drift={0.00013}
      />
    );
  if (beat.id === "tiger")
    return (
      <Still
        path="captures/feedback-review-pre-submit-2026-09-26.png"
        frame={frame}
        drift={0.0001}
      />
    );
  if (beat.id === "presage" || beat.id === "auth")
    return (
      <Still
        path="captures/current-agent-pending-envoy-surf-2026-09-26.png"
        frame={frame}
        drift={0.00008}
      />
    );
  return (
    <Video
      path="captures/current-chat-jobs-envoy-surf-2026-09-27.mp4"
      start={12}
      speed={0.8}
    />
  );
}

function Caption({ beat, frame }: { beat: Beat; frame: number }) {
  const voice = narration.find((entry) => entry.sceneId === beat.id)!;
  const sentences = voice.text
    .match(/[^.!?]+[.!?]?/g)
    ?.map((line) => line.trim()) ?? [voice.text];
  const spoken = frame - voice.startSeconds * fps;
  const line =
    spoken < 0 || spoken >= voice.durationSeconds * fps
      ? ""
      : sentences[
          Math.min(
            sentences.length - 1,
            Math.floor(
              (spoken / (voice.durationSeconds * fps)) * sentences.length,
            ),
          )
        ];
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 106,
        background: "#fbfbfa",
        borderTop: "1px solid #e2e2e0",
        display: "flex",
        alignItems: "center",
        padding: "0 62px",
        boxSizing: "border-box",
        color: "#242424",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <span
        style={{
          fontSize: 29,
          lineHeight: 1.18,
          fontWeight: 520,
          width: 1260,
        }}
      >
        {line}
      </span>
      <span
        style={{
          marginLeft: "auto",
          paddingLeft: 30,
          fontSize: 19,
          fontWeight: 650,
          color: "#4a5356",
          maxWidth: 480,
          textAlign: "right",
        }}
      >
        {beat.marker}
      </span>
    </div>
  );
}

function BeatScene({ beat }: { beat: Beat }) {
  const frame = useCurrentFrame();
  const voice = narration.find((entry) => entry.sceneId === beat.id)!;
  const codeKind =
    beat.id === "voice" ||
    beat.id === "tiger" ||
    beat.id === "presage" ||
    beat.id === "auth"
      ? beat.id
      : null;
  const fade = Math.min(1, frame / 5, (beat.seconds * fps - frame) / 5);
  return (
    <AbsoluteFill
      style={{
        background: "#fbfbfa",
        overflow: "hidden",
        opacity: Math.max(0, fade),
      }}
    >
      <Product beat={beat} frame={frame} />
      {codeKind && frame < 85 && (
        <>
          <AbsoluteFill style={{ background: "#1423339a" }} />
          <SourceCode kind={codeKind} frame={frame} />
        </>
      )}
      <div
        style={{
          position: "absolute",
          left: -90,
          top: -110,
          height: 200,
          width: 250,
          borderRadius: "45% 55% 60% 40%",
          background: beat.color,
          opacity: frame < 28 ? 0.6 * (1 - frame / 28) : 0,
          transform: `rotate(${frame * 3}deg)`,
          pointerEvents: "none",
        }}
      />
      <Caption beat={beat} frame={frame} />
      <Sequence from={Math.round(voice.startSeconds * fps)}>
        <Audio src={staticFile(voice.file)} volume={1} />
      </Sequence>
    </AbsoluteFill>
  );
}

function MusicBed() {
  const frame = useCurrentFrame();
  const fade = Math.min(
    1,
    frame / (1.5 * fps),
    (chatFilmDurationFrames - frame) / (2.5 * fps),
  );
  return (
    <Audio
      src={staticFile("music-your-breath-mixkit.mp3")}
      volume={0.075 * Math.max(0, fade)}
    />
  );
}

export function EnvoyChatFilm() {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: "#fbfbfa" }}>
      <MusicBed />
      {beats.map((beat) => {
        const start = from;
        from += beat.seconds * fps;
        return (
          <Sequence
            key={beat.id}
            from={start}
            durationInFrames={beat.seconds * fps}
          >
            <BeatScene beat={beat} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
