import { Composition } from "remotion";
import { EnvoyEvidence } from "./video";
import { durationInFrames, FPS } from "./story";

const Review = () => <EnvoyEvidence review />;

export const Root = () => (
  <>
    <Composition
      id="EnvoyEvidence"
      component={EnvoyEvidence}
      durationInFrames={durationInFrames}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="EnvoyReview"
      component={Review}
      durationInFrames={300 * 15}
      fps={15}
      width={1920}
      height={1080}
    />
  </>
);
