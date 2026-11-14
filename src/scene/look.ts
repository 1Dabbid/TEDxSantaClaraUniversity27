/**
 * Per-frame resolved "look" values, written by the camera rig (Experience) and
 * read by lights, effects and the post pass. Plain mutable singleton.
 */
export const look = {
  fov: 30,
  exposure: 1,
  /** Edge blur amount (fake shallow depth of field), 0..1. */
  dof: 0,
  /** Screen point kept sharp by the edge blur (0..1, y up). */
  focusX: 0.5,
  focusY: 0.5,
  /** Volumetric cone + dust multiplier. */
  cone: 1,
  /** Overhead spot intensity multiplier. */
  spot: 1,
  /** Mic key light intensity multiplier. */
  key: 1,
  /** Rim light multiplier. */
  rim: 1,
  /** Background haze glow, 0..1. */
  haze: 0,
  /** Foreground dust motes, 0..1. */
  motes: 0,
  /** Right-side darkening 0..1 (readability of text over the canvas). */
  shade: 0,
  /** Left / centre darkening 0..1 behind headline type. */
  scrim: 0,
  /** Top / bottom edge darkening 0..1. */
  scrimEdge: 0,
  /** Upper-middle band darkening 0..1 behind a full-width heading. */
  band: 0,
  /** Highlight bloom multiplier. */
  bloom: 1,
  /** Vignette strength 0..1. */
  vignette: 0.6,
  /** Colour temperature of the overhead spot and its beam: +1 warm, 0 neutral, -1 cool. */
  warm: 0,
  /** Turn of the mic's barrel sleeve (engraving, knurl) about its axis, radians. */
  turn: 0,
  /** True while the scene is fully faded out (rendering can stop). */
  dark: false,
};
