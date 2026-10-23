/**
 * Isabella Cinematic Intro — Barrel Exports
 */

export { CinematicIntro } from "./CinematicIntro";
export {
  type IntroPhase,
  type IntroState,
  type CameraShot,
  TIMELINE,
  TOTAL_DURATION,
  resolveIntroPhase,
  getPhaseProgress,
  resolveCameraShot,
  createInitialState,
  detectPerformanceProfile,
  getPerformanceLimits,
  CAMERA_SHOTS,
} from "./timeline";
export { COLORS, COLORS_THREE, STAR_LAYERS, COMET_COLORS } from "./colors";
