import { Composition } from "remotion";
import { EnvoyEvidence } from "./video";
import { durationInFrames, FPS } from "./story";

export const Root = () => (
  <Composition
    id="EnvoyEvidence"
    component={EnvoyEvidence}
    durationInFrames={durationInFrames}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
