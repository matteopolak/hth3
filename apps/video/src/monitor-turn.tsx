import type { ReactNode } from "react";
import { Img, staticFile } from "remotion";
import turn from "../public/models/turn/manifest.json";

export function TurningMonitor({
  children,
  frame,
  travelFrames = 52,
  endIndex = 18,
}: {
  children: ReactNode;
  frame: number;
  travelFrames?: number;
  endIndex?: number;
}) {
  const progress = Math.max(0, Math.min(1, frame / travelFrames));
  const eased = progress * progress * (3 - 2 * progress);
  const item = turn[Math.round(eased * endIndex)]!;
  const [topLeft, topRight, , bottomLeft] = item.screen as [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  const skewDegrees =
    (Math.atan2(topRight[1] - topLeft[1], topRight[0] - topLeft[0]) * 180) /
    Math.PI;
  return (
    <div
      data-yaw={item.yaw}
      style={{
        position: "relative",
        width: 1176,
        height: 700,
        filter: "drop-shadow(0 27px 23px #10111429)",
      }}
    >
      <Img
        src={staticFile(item.image)}
        style={{ position: "absolute", inset: 0, width: 1176, height: 700 }}
      />
      <div
        style={{
          position: "absolute",
          left: topLeft[0] - 1,
          top: topLeft[1] - 1,
          width: topRight[0] - topLeft[0] + 2,
          height: bottomLeft[1] - topLeft[1] + 2,
          overflow: "hidden",
          background: "#111216",
          transformOrigin: "left top",
          transform: `skewY(${skewDegrees}deg)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
