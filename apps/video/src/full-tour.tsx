import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import narration from "./chat-narration.generated.json";
import { EnvoyChatFilmMotion } from "./chat-film";

const fps = 30;
const originalWithoutClose = 89 * fps;
const extraSeconds = 7;
const extraFrames = extraSeconds * fps;
export const fullTourDurationFrames = (89 + 3 * extraSeconds + 5) * fps;

type NewBeat = "account-profile" | "application" | "staff-workflow";

const scenes: Record<
  NewBeat,
  {
    title: string;
    note: string;
    accent: string;
    images: readonly string[];
  }
> = {
  "account-profile": {
    title: "One account. A profile the applicant controls.",
    note: "Auth0 entry · profile captured locally",
    accent: "#8ea8ed",
    images: [
      "captures/current-auth0-signup-envoy-surf-2026-09-27.png",
      "captures/current-profile-local-2026-09-27.png",
    ],
  },
  application: {
    title: "Apply, then follow the decision.",
    note: "Envoy-hosted practice application · local capture",
    accent: "#e9ab8e",
    images: ["captures/current-applications-local-2026-09-27.png"],
  },
  "staff-workflow": {
    title: "A separate workspace for the people reviewing it.",
    note: "Staff inbox captured in local sandbox",
    accent: "#80cdbb",
    images: ["captures/current-staff-inbox-local-2026-09-27.png"],
  },
};

function NewScene({ id }: { id: NewBeat }) {
  const frame = useCurrentFrame();
  const scene = scenes[id];
  const voice = narration.find((entry) => entry.sceneId === id)!;
  const imageIndex = scene.images.length > 1 && frame >= 92 ? 1 : 0;
  const intro = Math.min(1, frame / 12);
  const outro = Math.min(1, (extraFrames - frame) / 9);
  return (
    <AbsoluteFill
      style={{
        background: "#fbfbfa",
        fontFamily: "Arial, Helvetica, sans-serif",
        opacity: Math.max(0, Math.min(intro, outro)),
        overflow: "hidden",
      }}
    >
      <Img
        src={staticFile(scene.images[imageIndex]!)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1920,
          height: 974,
          objectFit: "cover",
          transform: `scale(${1 + (frame % 92) * 0.0003})`,
          transformOrigin: id === "account-profile" ? "62% 40%" : "58% 45%",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 65,
          padding: "18px 27px",
          maxWidth: 1160,
          borderRadius: 18,
          background: "#fffffff2",
          borderLeft: `9px solid ${scene.accent}`,
          boxShadow: "0 15px 48px #0002",
          color: "#151515",
          fontSize: 40,
          fontWeight: 670,
          letterSpacing: -0.8,
        }}
      >
        {scene.title}
      </div>
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
          justifyContent: "space-between",
          boxSizing: "border-box",
          padding: "0 62px",
          color: "#242424",
        }}
      >
        <span style={{ fontSize: 28, lineHeight: 1.2 }}>{voice.text}</span>
        <span style={{ fontSize: 18, color: "#60696d", marginLeft: 32 }}>
          {scene.note}
        </span>
      </div>
      <Sequence from={Math.round(voice.startSeconds * fps)}>
        <Audio src={staticFile(voice.file)} volume={1} />
      </Sequence>
    </AbsoluteFill>
  );
}

export function EnvoyFullTour() {
  return (
    <AbsoluteFill style={{ background: "#fbfbfa" }}>
      <Sequence from={0} durationInFrames={originalWithoutClose}>
        <EnvoyChatFilmMotion />
      </Sequence>
      <Sequence
        from={originalWithoutClose}
        durationInFrames={3 * extraFrames}
      >
        <Audio
          src={staticFile("music-your-breath-mixkit.mp3")}
          startFrom={originalWithoutClose}
          volume={0.075}
        />
      </Sequence>
      {(["account-profile", "application", "staff-workflow"] as const).map(
        (id, index) => (
          <Sequence
            key={id}
            from={originalWithoutClose + index * extraFrames}
            durationInFrames={extraFrames}
          >
            <NewScene id={id} />
          </Sequence>
        ),
      )}
      <Sequence
        from={originalWithoutClose + 3 * extraFrames}
        durationInFrames={5 * fps}
      >
        <Sequence from={-originalWithoutClose}>
          <EnvoyChatFilmMotion />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
}
