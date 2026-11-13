/**
 * Per-frame resolved "look" values, written by the camera rig (CameraRig) and
 * read by lights, effects and the post pass. Plain mutable singleton.
 */
export const look = {
  fov: 30,
  exposure: 1,
  /** Edge blur amount (fake shallow depth of field), 0..1. */
  dof: 0,
  /** Volumetric cone + dust multiplier. */
  cone: 1,
  /** Overhead spot intensity multiplier. */
  spot: 1,
  /** Mic key light intensity multiplier. */
  key: 1,
  /** Right-side darkening 0..1 (readability of text over the canvas). */
  shade: 0,
  /** Vignette strength 0..1. */
  vignette: 0.6,
  /** True while the scene is fully faded out (rendering can stop). */
  dark: false,
};
