import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { TurningMonitor } from "./monitor-turn";

export type TechnicalKind = "voice" | "tiger" | "presage" | "auth";

const ink = "#172126";
const muted = "#546269";

function enter(frame: number, start: number): CSSProperties {
  const amount = Math.max(0, Math.min(1, (frame - start) / 12));
  return {
    opacity: amount,
    transform: `translateY(${(1 - amount) * 22}px)`,
  };
}

function Stage({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: "0 0 106px",
        overflow: "hidden",
        background: "#f8faf9",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: ink,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -125,
          right: 45,
          width: 390,
          height: 260,
          borderRadius: "50%",
          background: accent,
          opacity: 0.13,
          filter: "blur(48px)",
        }}
      />
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 21,
        fontWeight: 700,
        color: muted,
        letterSpacing: 1.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function VoiceMotion({ frame }: { frame: number }) {
  const bars = Array.from({ length: 72 }, (_, index) => {
    const wave = Math.abs(
      Math.sin(index * 0.58 + frame * 0.19) *
        Math.sin(index * 0.14 - frame * 0.09),
    );
    return 18 + wave * 115;
  });
  return (
    <Stage accent="#7597e8">
      <div style={{ position: "absolute", left: 115, top: 132 }}>
        <Eyebrow>ElevenLabs voice agent</Eyebrow>
        <div
          style={{
            marginTop: 22,
            fontSize: 66,
            fontWeight: 750,
            lineHeight: 1.02,
            letterSpacing: -2,
          }}
        >
          A concern becomes
          <br />a useful question.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 112,
          right: 112,
          top: 418,
          height: 145,
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderTop: "1px solid #bccbce",
          borderBottom: "1px solid #bccbce",
        }}
      >
        {bars.map((height, index) => (
          <div
            key={index}
            style={{
              width: 16,
              height,
              borderRadius: 9,
              background: index % 5 === 0 ? "#3559ac" : "#82a4e9",
              opacity: 0.83,
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 655,
          left: 115,
          right: 110,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 72,
        }}
      >
        <div style={enter(frame, 24)}>
          <Eyebrow>Resident concern</Eyebrow>
          <div style={{ marginTop: 11, fontSize: 37, fontWeight: 650 }}>
            A streetlight in Toronto
          </div>
        </div>
        <div style={enter(frame, 69)}>
          <Eyebrow>Agent follow-up</Eyebrow>
          <div style={{ marginTop: 11, fontSize: 37, fontWeight: 650 }}>
            Nearest intersection?
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 115,
          bottom: 44,
          fontSize: 19,
          color: muted,
        }}
      >
        Signed session and spoken follow-up
      </div>
    </Stage>
  );
}

function TigerMotion({ frame }: { frame: number }) {
  const steps = [
    ["D1", "Private report words", "remain in Envoy"],
    ["Outbox", "Metadata event", "leaves through a bounded job"],
    ["Tiger", "Daily trend count", "4 delivered events · Sep 26"],
  ] as const;
  return (
    <Stage accent="#6bc5b1">
      <div style={{ position: "absolute", left: 112, top: 112 }}>
        <Eyebrow>D1 → Tiger Data</Eyebrow>
        <div
          style={{
            marginTop: 19,
            fontSize: 59,
            fontWeight: 750,
            letterSpacing: -2,
            lineHeight: 1.05,
          }}
        >
          Count the work.
          <br />
          Keep the words private.
        </div>
      </div>
      <div style={{ position: "absolute", top: 337, left: 112, width: 640 }}>
        {steps.map(([name, title, detail], index) => (
          <div
            key={name}
            style={{
              ...enter(frame, index * 37),
              height: 136,
              display: "grid",
              gridTemplateColumns: "155px 1fr",
              alignItems: "center",
              borderTop: "1px solid #aab8b9",
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 700, color: "#267b6a" }}>
              {name}
            </span>
            <span>
              <strong style={{ display: "block", fontSize: 30 }}>
                {title}
              </strong>
              <span
                style={{
                  display: "block",
                  marginTop: 6,
                  fontSize: 20,
                  color: muted,
                }}
              >
                {detail}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 788,
          top: 205,
          transform: `scale(0.88) rotate(${Math.sin(frame / 40) * 0.35}deg)`,
          transformOrigin: "left top",
        }}
      >
        <TurningMonitor frame={frame}>
          <Img
            src={staticFile(
              "captures/feedback-review-pre-submit-2026-09-26.png",
            )}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </TurningMonitor>
      </div>
      <div
        style={{
          position: "absolute",
          right: 113,
          bottom: 40,
          fontSize: 19,
          color: muted,
        }}
      >
        Read-only Tiger result at 19:41 UTC, September 26
      </div>
    </Stage>
  );
}

function Phone({ frame }: { frame: number }) {
  const active = Math.min(2, Math.floor(Math.max(0, frame - 10) / 52));
  const steps = [
    ["01", "Ask for camera consent"],
    ["02", "Collect a stable sample"],
    ["03", "Offer a quieter editor"],
  ] as const;
  return (
    <div
      style={{
        width: 408,
        height: 710,
        borderRadius: 54,
        padding: 18,
        boxSizing: "border-box",
        background: "linear-gradient(90deg, #101b22, #26343b 75%, #0c1519)",
        boxShadow: "20px 22px 5px #17212631, 34px 39px 55px #1721263d",
        transform: `perspective(1250px) rotateY(${-18 + Math.sin(frame / 53) * 2}deg) rotateX(3deg)`,
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: 39,
          background: "#fdfefd",
          overflow: "hidden",
          padding: "42px 25px 25px",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "37%",
            top: 13,
            width: "26%",
            height: 9,
            borderRadius: 9,
            background: "#182329",
          }}
        />
        <div style={{ fontSize: 17, color: muted }}>
          SwiftUI accessibility flow
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 35,
            fontWeight: 750,
            lineHeight: 1.04,
          }}
        >
          Make room
          <br />
          to focus.
        </div>
        <div style={{ marginTop: 37 }}>
          {steps.map(([number, label], index) => (
            <div
              key={number}
              style={{
                padding: "18px 0",
                borderTop: "1px solid #d6dfdc",
                color: active === index ? ink : "#899399",
                transform: `translateX(${active === index ? 5 : 0}px)`,
              }}
            >
              <span style={{ fontSize: 18, marginRight: 18, color: "#c3704d" }}>
                {number}
              </span>
              <span style={{ fontSize: 23, fontWeight: 650 }}>{label}</span>
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: 26,
            right: 26,
            borderTop: "1px solid #d6dfdc",
            paddingTop: 16,
            fontSize: 16,
            color: muted,
          }}
        >
          Consent and quieter-layout flow
        </div>
      </div>
    </div>
  );
}

function PresageMotion({ frame }: { frame: number }) {
  return (
    <Stage accent="#e7a580">
      <div style={{ position: "absolute", left: 118, top: 138, width: 790 }}>
        <Eyebrow>Native SwiftUI · Presage</Eyebrow>
        <div
          style={{
            marginTop: 22,
            fontSize: 66,
            fontWeight: 750,
            lineHeight: 1.04,
            letterSpacing: -2,
          }}
        >
          Consent comes
          <br />
          before a camera sample.
        </div>
        <div
          style={{
            marginTop: 52,
            fontSize: 31,
            lineHeight: 1.35,
            color: muted,
          }}
        >
          The native flow can offer a quieter writing layout when the user opts
          in.
        </div>
      </div>
      <div style={{ position: "absolute", left: 1230, top: 105 }}>
        <Phone frame={frame} />
      </div>
    </Stage>
  );
}

function AuthMotion({ frame }: { frame: number }) {
  if (frame < 106) {
    return (
      <Stage accent="#8299d8">
        <Img
          src={staticFile("captures/current-signin-envoy-surf-2026-09-27.png")}
          style={{
            position: "absolute",
            inset: 0,
            width: 1920,
            height: 974,
            objectFit: "cover",
            transform: `scale(${1 + frame * 0.00042})`,
            transformOrigin: "68% 38%",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 305,
            top: 252,
            height: 270,
            width: 470,
            border: "4px solid #5578ba",
            borderRadius: 20,
            opacity: Math.min(0.78, frame / 20),
            boxShadow: "0 0 0 700px #15243112",
          }}
        />
      </Stage>
    );
  }
  const steps = [
    ["Auth0", "Hosted organization sign-in"],
    ["Worker", "Check token issuer and scopes"],
    ["D1", "Intersect organization membership"],
  ] as const;
  return (
    <Stage accent="#8299d8">
      <div style={{ position: "absolute", top: 132, left: 114 }}>
        <Eyebrow>Staff boundary</Eyebrow>
        <div
          style={{
            marginTop: 20,
            fontSize: 66,
            fontWeight: 750,
            letterSpacing: -2,
          }}
        >
          Access is checked at every step.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 116,
          right: 116,
          top: 370,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 55,
        }}
      >
        {steps.map(([name, detail], index) => (
          <div key={name} style={enter(frame - 106, index * 24)}>
            <div
              style={{
                width: 67,
                height: 67,
                borderRadius: "50%",
                background: index === 2 ? "#d8e1f4" : "#4e70b7",
                color: index === 2 ? "#304869" : "white",
                display: "grid",
                placeItems: "center",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {index + 1}
            </div>
            <div style={{ marginTop: 43, fontSize: 44, fontWeight: 750 }}>
              {name}
            </div>
            <div style={{ marginTop: 13, fontSize: 28, color: muted }}>
              {detail}
            </div>
            <div style={{ marginTop: 38, borderTop: "4px solid #7694cd" }} />
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 116,
          bottom: 55,
          fontSize: 23,
          color: muted,
        }}
      >
        Protected tools require token, organization membership, and scope.
      </div>
    </Stage>
  );
}

export function TechnicalMotion({
  kind,
  frame,
}: {
  kind: TechnicalKind;
  frame: number;
}) {
  if (kind === "voice") return <VoiceMotion frame={frame} />;
  if (kind === "tiger") return <TigerMotion frame={frame} />;
  if (kind === "presage") return <PresageMotion frame={frame} />;
  return <AuthMotion frame={frame} />;
}
