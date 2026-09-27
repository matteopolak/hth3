import { Composition } from "remotion";
import {
  EnvoyChatFilm,
  EnvoyChatFilmMotion,
  chatFilmDurationFrames,
  chatFilmFps,
  chatFilmMotionDurationFrames,
} from "./chat-film";
import { EnvoyEvidence } from "./video";
import { EnvoyRecut, recutDurationFrames } from "./recut";
import {
  EnvoyStageFallback,
  stageFallbackDurationFrames,
  stageFallbackFps,
} from "./stage-fallback";
import { durationInFrames, FPS } from "./story";
import { EnvoyFullTour, fullTourDurationFrames } from "./full-tour";

const Review = () => <EnvoyEvidence review />;

export const Root = () => (
  <>
    <Composition
      id="EnvoyFullTour"
      component={EnvoyFullTour}
      durationInFrames={fullTourDurationFrames}
      fps={chatFilmFps}
      width={1920}
      height={1080}
    />
    <Composition
      id="EnvoyChatFilmMotion"
      component={EnvoyChatFilmMotion}
      durationInFrames={chatFilmMotionDurationFrames}
      fps={chatFilmFps}
      width={1920}
      height={1080}
    />
    <Composition
      id="EnvoyChatFilm"
      component={EnvoyChatFilm}
      durationInFrames={chatFilmDurationFrames}
      fps={chatFilmFps}
      width={1920}
      height={1080}
    />
    <Composition
      id="EnvoyStageFallback"
      component={EnvoyStageFallback}
      durationInFrames={stageFallbackDurationFrames}
      fps={stageFallbackFps}
      width={1920}
      height={1080}
    />
    <Composition
      id="EnvoyRecut"
      component={EnvoyRecut}
      durationInFrames={recutDurationFrames}
      fps={FPS}
      width={1920}
      height={1080}
    />
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
