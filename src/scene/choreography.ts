import { Vector3 } from 'three';
import { MIC_AXIS, VIEW_AZ, micToWorld } from './layout';
import type { SectionId } from './scrollState';
import { SECTION_IDS } from './scrollState';

/**
 * Camera choreography as data.
 *
 * THE PRINCIPLE: ONE SUBJECT, ONE AXIS.
 *
 * The subject of the whole page is the microphone on its stand at the centre
 * of the red rug. The camera never orbits it, never swings sideways and never
 * re-aims at something else: it only travels in and out along one straight
 * dolly track through the subject (heading VIEW_AZ, a slight downward
 * elevation), with a slow crane rise only at the very end. What changes from
 * section to section is distance and light, never direction. The subject
 * keeps one place on screen (a lens shift, not a turn): on landscape about
 * two thirds across, clear of the page copy on the left; on portrait centred,
 * in the lower middle. Every frame follows from the one before, so the eye
 * never has to look for the subject again.
 *
 * When you edit the shots below, keep to that:
 * - change `dist` (in and out), `aim` (which point of the subject is held at
 *   the anchor: a point on the mic barrel, or a height on the stand line) and
 *   the light; leave the heading alone (there is no per-shot heading);
 * - keep `anchor` nearly constant (a few percent of the frame at most between
 *   neighbouring shots; the engraving macro is the one exception, where the
 *   barrel slides right to leave the headline clear);
 * - keep `dist` monotonic from the end of the macro to the end of Tickets
 *   (never push back in); a hold is two shots with the same values;
 * - spread a big change of distance over enough scroll, in steps of roughly
 *   equal ratio (the pull back out of the macro grows about 1.6-2x per step of
 *   0.0725), and bring light up after the framing has settled, not with it, so
 *   neighbouring frames always follow from each other. `__sceneSim.metrics()`
 *   (?scene-debug=1) reports heading change, lateral deviation, anchor drift,
 *   monotonicity and the largest framing jump: check them after an edit.
 *
 * Journey coordinate `J`: continuous over the home page; section k (in
 * SECTION_IDS order) spans [k, k+1) and the fraction is how far the viewport
 * centre has travelled through it. So J = 0.5 is the hero's middle at the
 * viewport centre; on a 1440x900 screen 1.22..1.78 is the pinned part of the
 * 225vh theme runway and the speakers stage pins at about 2.25; 2.5 is
 * speakers centred, and so on.
 *
 * Every channel (track distance, aim point, anchor, roll, light) is
 * interpolated with a monotone cubic (Fritsch-Carlson) through the shots: no
 * overshoot, velocity continuous across shots (moves flow from one section
 * into the next without a stop-start), zero velocity where two shots hold the
 * same value. The camera then follows that path with critically damped
 * springs (rig.ts).
 */

export type V3 = readonly [number, number, number];

/** The point of the subject held at the screen anchor. */
export type Aim =
  /** A point on the microphone's axis, mic-space height (m, tail = 0, the engraved band is 0.05..0.10). */
  | { mic: number }
  /** A height above the floor (m) on the vertical line through the barrel's middle (the stand line). */
  | { stand: number };

export type Shot = {
  at: number;
  aim: Aim;
  /** Camera distance along the dolly track (m), measured from the aim's track origin. */
  dist: number;
  /** Extra camera height (m) added to the track: the crane rise at the end of the journey. */
  lift?: number;
  /** Where the aim point sits on screen, [x from the left, y from the top], 0..1. Applied as a lens shift. */
  anchor: readonly [number, number];
  /** Roll about the view axis towards the barrel: 0 horizon level, 1 the barrel upright on screen (engraved rows level). */
  roll?: number;
  fov: number;
  exposure: number;
  /** Edge blur 0..1 (fake depth of field). */
  dof?: number;
  /** Idle drift amplitude, metres. */
  drift?: number;
  /** Pointer parallax amplitude, metres. */
  parallax?: number;
  /** Volumetric cone visibility multiplier. */
  cone?: number;
  /** Overhead spot intensity multiplier. */
  spot?: number;
  /** Extra environment rotation (radians): moves the reflected strip highlights. */
  envRot?: number;
  /** Darken the right side of the frame (0..1), for text over the canvas. */
  shade?: number;
  /** Key light on the mic, multiplier. */
  key?: number;
  /** 0: key light orbits the mic; 1: key light rides with the camera (macro glints). */
  keyCam?: number;
  vignette?: number;
  /** Rim light on the mic and hardware, multiplier (default 1). */
  rim?: number;
  /** Where the rim light sits around the view axis, radians: 0 = above, +PI/2 = screen right. */
  rimAng?: number;
  /** Soft atmospheric glow behind the subject, 0..1. */
  haze?: number;
  /** Out-of-focus dust motes in front of the lens, 0..1. */
  motes?: number;
  /**
   * Camera-relative position of the key light while it rides the camera
   * (keyCam = 1): [right, up, forward] in multiples of the focus distance.
   */
  keyDir?: V3;
  /** Screen point that stays sharp under the edge blur, 0..1 (x right, y up); defaults to the anchor. */
  focus?: readonly [number, number];
  /** Darken the left / centre of the frame (0..1) behind headline type. */
  scrim?: number;
  /** Darken thin bands along the top and bottom edges (0..1), behind section labels and captions. */
  scrimEdge?: number;
  /** Darken a soft horizontal band across the upper middle of the frame (0..1), behind a full-width heading. */
  band?: number;
  /** Highlight bloom multiplier (high tier). */
  bloom?: number;
  /** Studio environment (reflection strips) intensity, default 1. */
  env?: number;
};

export type ResolvedShot = {
  at: number;
  /** Camera position. */
  pos: Vector3;
  /** Aim point (held at the screen anchor). */
  target: Vector3;
  /** Unit offset from the target to the camera, and the log of that distance (the rig damps these, not pos). */
  dir: Vector3;
  logDist: number;
  up: Vector3;
  /** Track: origin, log of the distance along it, crane lift. The camera is origin + TRACK * exp(logU) + lift * Y. */
  origin: Vector3;
  logU: number;
  lift: number;
  /** Roll about the view axis (radians). */
  roll: number;
  /** Screen anchor of the target (fractions from the left / top). */
  shiftX: number;
  shiftY: number;
  fov: number;
  exposure: number;
  dof: number;
  drift: number;
  parallax: number;
  cone: number;
  spot: number;
  envRot: number;
  shade: number;
  key: number;
  keyCam: number;
  vignette: number;
  rim: number;
  rimAng: number;
  haze: number;
  motes: number;
  keyDir: Vector3;
  focusX: number;
  focusY: number;
  scrim: number;
  scrimEdge: number;
  band: number;
  bloom: number;
  env: number;
};

/**
 * Camera rig tuning. The rig follows the sampled path as a target point plus
 * an offset (direction on the sphere, distance in log space), each critically
 * damped (`follow`, seconds), so the camera can never pass through its own
 * subject however fast the page is flung. The view direction trails that
 * through a critically damped spring (no overshoot: nothing swings back).
 */
export const RIG = {
  /** Smoothing of the journey coordinate itself (seconds). */
  journeySmooth: 0.5,
  /** Offset (direction, distance) follow time (seconds). */
  follow: 0.3,
  /** Target point follow time (seconds). */
  targetFollow: 0.3,
  /** View-direction spring frequency (Hz) and damping ratio (1: critically damped). */
  targetFreq: 1.2,
  targetZeta: 1,
  /** Bank angle per unit of lateral angular velocity (rad per rad/s), and its limit (the axis has no lateral moves). */
  rollGain: 0.05,
  rollMax: 0.035,
  /** Lens-shift (screen anchor) follow time (seconds). */
  anchorFollow: 0.4,
};

/* ------------------------------------------------------------------------- */
/* The axis                                                                  */
/* ------------------------------------------------------------------------- */

/** Point on the mic (mic-space y), in world space. */
export const micPoint = (y: number) => micToWorld(new Vector3(0, y, 0));

/** The middle of the barrel (the hero's aim): the top of the stand line and the origin of the track. */
export const SPINE = micPoint(0.095);
/** Elevation of the dolly track (radians): the camera looks a little down on the subject. */
export const TRACK_ELEV = 0.07;
/** Unit direction of the dolly track, from the subject towards the camera. */
export const TRACK = new Vector3(Math.sin(VIEW_AZ) * Math.cos(TRACK_ELEV), Math.sin(TRACK_ELEV), Math.cos(VIEW_AZ) * Math.cos(TRACK_ELEV));

/** World position of an aim point. */
export function aimPoint(aim: Aim, out = new Vector3()): Vector3 {
  if ('mic' in aim) return micToWorld(out.set(0, aim.mic, 0), out);
  return out.set(SPINE.x, aim.stand, SPINE.z);
}
/**
 * Where a shot's track starts: the aim point itself on the barrel (a slide
 * along the barrel carries the camera with it, so it never turns), the top of
 * the stand line otherwise (the camera stays on the one track while the aim
 * moves down the stand).
 */
function trackOrigin(aim: Aim, out = new Vector3()): Vector3 {
  return 'mic' in aim ? aimPoint(aim, out) : out.copy(SPINE);
}

/* ------------------------------------------------------------------------- */
/* Shots                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Where the page puts its copy (desktop 1440x900; phones in brackets), which
 * the anchor (about 68% across) keeps clear of:
 * - hero 0..0.55 (scroll 0 lands near J 0.45): the text column covers the left 60%
 * - theme J 0.8..2.02: headline phrases left / centre, the right 42% open for the engraving
 * - speakers J 2..3: heading top left (left 45%), one glass panel low left
 *   (x 3-36%, y 62-76%); when speakers are announced, a strip of cards along
 *   the lower edge from about 44% of the pin
 * - schedule J 3..4: a column on the left 40%
 * - venue J 4..5: heading top left, details across the lower half over a scrim
 * - tickets J 5..6: text left, big numerals at the bottom
 */

const DARK = { exposure: 0, drift: 0, parallax: 0, key: 0, spot: 0, cone: 1, vignette: 0.8 };

/** Macro look shared by the engraving shots: raking key from screen right, bright side right. */
const MACRO = {
  fov: 28,
  exposure: 1.12,
  dof: 0.85,
  drift: 0.0012,
  parallax: 0.0018,
  cone: 0,
  spot: 0,
  key: 0.75,
  keyCam: 1,
  rim: 0.4,
  rimAng: 1.2,
  haze: 0,
  motes: 1,
  vignette: 0.85,
  // The studio strips walk round the barrel (choreography never circles it): the streak runs down
  // the engraved column, a little right of the row starts, so the etched copy reads bright.
  envRot: -0.72,
  env: 0.4,
  focus: [0.78, 0.5] as const,
  scrim: 0.55,
  scrimEdge: 0.9,
  bloom: 1.3,
  roll: 1,
};

const HERO_LOOK = { fov: 30, exposure: 1.05, drift: 0.012, parallax: 0.022, cone: 0.05, spot: 0.45, key: 1.15, rim: 1.5, rimAng: 0.45, haze: 1, vignette: 0.6, bloom: 1 };
/** The stage under its light: the speakers hold and everything after it. */
/** The stage before the light comes on: the spot barely warm, no shaft yet, the key on the mic. */
const STAGE_WARM = { spot: 0.3, cone: 0.09, key: 0.6, haze: 0.03, dof: 0.12 };
const STAGE_LOOK = { fov: 32, exposure: 1, dof: 0.1, drift: 0.006, parallax: 0.025, cone: 1.3, spot: 1, key: 0.5, keyCam: 0, rim: 0.9, rimAng: -0.6, haze: 0, motes: 0, vignette: 0.62, bloom: 1.1, env: 1 };

/*
 * Looks along the pull back, between the macro and the lit stage. The key light leaves the
 * camera (keyCam 1 -> 0) and the rim swings from screen right to the upstage side, while the
 * overhead spot stays off until the stand and the rug are in frame.
 */
/** The barrel standing back from upright, the engraving still lit by the raking key. */
const PULL_BARREL = { fov: 29, exposure: 1.06, dof: 0.5, drift: 0.003, parallax: 0.006, cone: 0, spot: 0, key: 0.8, keyCam: 0.75, keyDir: [1.8, 1.7, 0.35] as V3, rim: 0.7, rimAng: 0.6, haze: 0.15, motes: 0.5, vignette: 0.8, envRot: -0.5, env: 0.45, scrim: 0.45, scrimEdge: 0.75, bloom: 1.2 };
/** Barrel and grille. */
const PULL_MIC = { fov: 29.5, exposure: 1.03, dof: 0.4, drift: 0.004, parallax: 0.008, cone: 0.02, spot: 0.02, key: 0.85, keyCam: 0.5, keyDir: [1.5, 1.6, 0.3] as V3, rim: 1.0, rimAng: 0.1, haze: 0.3, motes: 0.3, vignette: 0.75, envRot: -0.2, env: 0.55, scrim: 0.4, scrimEdge: 0.6, bloom: 1.1 };
/** The whole microphone on a dark stage. */
const PULL_DARK = { fov: 30, exposure: 1, dof: 0.3, drift: 0.004, parallax: 0.012, cone: 0.04, spot: 0.04, key: 0.85, keyCam: 0.3, keyDir: [1.4, 1.6, 0.3] as V3, rim: 1.2, rimAng: -0.3, haze: 0.25, motes: 0.05, vignette: 0.72, envRot: 0, env: 0.6, scrim: 0.35, scrimEdge: 0.5, bloom: 1.1 };
/** Microphone and upper stand, the spot just beginning to warm. */
const PULL_STAND = { fov: 31, exposure: 1, dof: 0.22, drift: 0.005, parallax: 0.016, cone: 0.03, spot: 0.15, key: 0.8, keyCam: 0.1, rim: 1.15, rimAng: -0.45, haze: 0.08, motes: 0, vignette: 0.68, env: 0.75, scrim: 0.2, scrimEdge: 0.3, bloom: 1.1 };

/** In the macro the barrel slides right so its engraved column clears the theme headline (left edge past ~58%). */
const ANCHOR_MACRO: readonly [number, number] = [0.8, 0.5];

export const DESKTOP_SHOTS: Shot[] = [
  { at: 0, aim: { mic: 0.095 }, dist: 0.4, anchor: [0.68, 0.4], ...HERO_LOOK },
  { at: 0.55, aim: { mic: 0.095 }, dist: 0.4, anchor: [0.68, 0.4], ...HERO_LOOK },
  {
    // Push in along the axis; the barrel starts to stand upright as the engraving fills the frame.
    at: 0.8,
    aim: { mic: 0.09 },
    dist: 0.14,
    anchor: [0.82, 0.46],
    roll: 0.7,
    fov: 28,
    exposure: 1.05,
    dof: 0.45,
    drift: 0.004,
    parallax: 0.006,
    cone: 0.015,
    spot: 0.15,
    key: 0.7,
    keyCam: 0.7,
    keyDir: [1.1, 1.8, 0.4],
    rim: 0.7,
    rimAng: 1.0,
    haze: 0.3,
    motes: 0.5,
    vignette: 0.75,
    envRot: 0.4,
    env: 0.5,
    scrim: 0.4,
    scrimEdge: 0.85,
    bloom: 1.2,
  },
  // The macro: the same push settles on the engraving, then slides slowly down the barrel (rows go by).
  // The barrel arrives upright (roll ~1) and the roll unwinds evenly from 1.3 until the stage shots
  // (about 20 deg spread over a screen and a half), so the subject never spins as it recedes:
  // __sceneSim.metrics().rollPullBack and scroll[*].maxRollRateDegS measure it.
  { at: 0.98, aim: { mic: 0.088 }, dist: 0.066, anchor: ANCHOR_MACRO, ...MACRO, roll: 0.94, keyDir: [1.1, 2.2, 0.3] },
  { at: 1.3, aim: { mic: 0.081 }, dist: 0.066, anchor: ANCHOR_MACRO, ...MACRO, roll: 0.92, keyDir: [1.5, 2.0, 0.3] },
  { at: 1.6, aim: { mic: 0.074 }, dist: 0.066, anchor: ANCHOR_MACRO, ...MACRO, roll: 0.63, keyDir: [1.8, 1.8, 0.3] },
  { at: 1.72, aim: { mic: 0.072 }, dist: 0.067, anchor: ANCHOR_MACRO, ...MACRO, roll: 0.51, keyDir: [2.0, 1.6, 0.3] },
  // The pull back: straight out along the same line, the distance growing evenly in log space
  // (eight steps of 0.0725, eased: about 1.6x at the ends, 2x in the middle) so every frame
  // follows from the one before, over about 1.2 screens of scroll on a 1440x900 screen. The
  // engraving recedes, the barrel stands back from upright, the whole microphone comes into frame,
  // then its stand, then the rug, and only then does the overhead spot come up.
  { at: 1.7925, aim: { mic: 0.075 }, dist: 0.1054, anchor: [0.785, 0.485], ...MACRO, roll: 0.44, keyDir: [2.0, 1.6, 0.3], dof: 0.7, motes: 0.8, scrim: 0.5 },
  { at: 1.865, aim: { mic: 0.082 }, dist: 0.1814, anchor: [0.755, 0.465], roll: 0.37, ...PULL_BARREL },
  { at: 1.9375, aim: { mic: 0.09 }, dist: 0.3268, anchor: [0.725, 0.445], roll: 0.3, ...PULL_MIC },
  // The whole microphone, still in the dark: only its key and rim light.
  { at: 2.01, aim: { mic: 0.1 }, dist: 0.6445, anchor: [0.7, 0.43], roll: 0.23, ...PULL_DARK },
  // The aim slides down the stand line in step with the distance, so the head rises on screen
  // slowly (about 0.42 to 0.25 of the height) while the stand, then the rug, enter from below.
  { at: 2.0825, aim: { stand: 1.5 }, dist: 1.271, anchor: [0.685, 0.43], roll: 0.16, ...PULL_STAND, fov: 31 },
  // The overhead spot stays low until the framing has settled: the stand and the rug arrive in
  // the key light and a faint warm-up of the spot.
  { at: 2.155, aim: { stand: 1.395 }, dist: 2.29, anchor: [0.68, 0.43], roll: 0.09, ...STAGE_LOOK, ...STAGE_WARM, spot: 0.18, cone: 0.05, key: 0.7, rim: 1.05 },
  { at: 2.2275, aim: { stand: 1.195 }, dist: 3.942, anchor: [0.68, 0.425], roll: 0.02, ...STAGE_LOOK, ...STAGE_WARM, spot: 0.24, cone: 0.07, key: 0.65, rim: 1.0 },
  // Speakers: locked off on the microphone on the red circle (the stand's foot about y 0.65, clear
  // of the glass panel along the bottom, x 0.05-0.72, y 0.73-0.96). The light coming on is the event:
  // the frame holds while the spot and its shaft fade up over the first part of the pin.
  { at: 2.3, aim: { stand: 0.9 }, dist: 6.2, anchor: [0.68, 0.42], ...STAGE_LOOK, ...STAGE_WARM },
  { at: 2.4, aim: { stand: 0.9 }, dist: 6.2, anchor: [0.68, 0.42], ...STAGE_LOOK, spot: 0.72, cone: 0.6, key: 0.55, haze: 0 },
  { at: 2.5, aim: { stand: 0.9 }, dist: 6.2, anchor: [0.68, 0.42], ...STAGE_LOOK },
  { at: 2.96, aim: { stand: 0.9 }, dist: 6.2, anchor: [0.68, 0.42], ...STAGE_LOOK },
  // Schedule: the same frame drifts back a few percent; the light carries the change (denser haze, a little dimmer).
  { at: 3.92, aim: { stand: 0.88 }, dist: 6.55, anchor: [0.68, 0.42], ...STAGE_LOOK, cone: 1.5, spot: 0.95, exposure: 0.97 },
  // Venue -> Tickets: the same track backs out over the seats with a slow crane rise; the rows enter from the bottom.
  // The stage also rises slowly on screen (lens shift, no turn) into the upper right, above the
  // Tickets fact list (x 0.59-0.95, y 0.24-0.56 when the section is centred) and the numerals.
  { at: 4.6, aim: { stand: 0.72 }, dist: 10.5, lift: 0.3, anchor: [0.68, 0.41], ...STAGE_LOOK, fov: 31, cone: 0.42, spot: 0.95, key: 0.35, vignette: 0.6, scrimEdge: 0.5 },
  { at: 5.3, aim: { stand: 0.56 }, dist: 15.2, lift: 0.85, anchor: [0.68, 0.18], ...STAGE_LOOK, fov: 30, exposure: 0.95, cone: 0.38, spot: 0.95, key: 0.3, vignette: 0.62, scrimEdge: 0.7 },
  // The wide room: stage small, subject still at the anchor, seats as silhouettes below. Locked off.
  { at: 5.78, aim: { stand: 0.5 }, dist: 17.5, lift: 1.1, anchor: [0.68, 0.18], ...STAGE_LOOK, fov: 30, exposure: 0.9, cone: 0.28, spot: 0.95, key: 0.3, vignette: 0.65, scrimEdge: 0.7 },
  // After Tickets the lights go down. No camera move.
  { at: 6.0, aim: { stand: 0.5 }, dist: 17.5, lift: 1.1, anchor: [0.68, 0.18], ...STAGE_LOOK, fov: 30, ...DARK },
  { at: 9.5, aim: { stand: 0.5 }, dist: 17.5, lift: 1.1, anchor: [0.68, 0.18], ...STAGE_LOOK, fov: 30, ...DARK },
];

/** Portrait: the same axis, the subject centred, in the lower middle (the copy sits above it on full-width scrims). */
const P_ANCHOR: readonly [number, number] = [0.5, 0.62];
const MACRO_PORTRAIT = { ...MACRO, fov: 34, exposure: 1.15, dof: 0.6, key: 0.85, motes: 0.6, scrim: 0.35, bloom: 0.9, focus: [0.6, 0.45] as const };
const HERO_PORTRAIT_LOOK = { fov: 34, exposure: 1.15, drift: 0.008, parallax: 0, cone: 0.02, spot: 0.15, key: 0.75, rim: 3.4, rimAng: 0.75, haze: 0.2, vignette: 0.72 };
/** On phones the speakers and schedule copy sits over the beam: a thinner shaft, darker at the top edge, keeps it at 4.5:1. */
const STAGE_PORTRAIT = { ...STAGE_LOOK, fov: 40, exposure: 1.0, parallax: 0, cone: 0.55, spot: 1.1, scrimEdge: 0.55 };

export const PORTRAIT_SHOTS: Shot[] = [
  { at: 0, aim: { mic: 0.1 }, dist: 0.62, anchor: [0.5, 0.66], ...HERO_PORTRAIT_LOOK },
  { at: 0.45, aim: { mic: 0.1 }, dist: 0.62, anchor: [0.5, 0.66], ...HERO_PORTRAIT_LOOK },
  {
    at: 0.65,
    aim: { mic: 0.09 },
    dist: 0.22,
    anchor: [0.52, 0.6],
    roll: 0.7,
    fov: 32,
    exposure: 0.78,
    dof: 0.3,
    drift: 0.004,
    cone: 0.015,
    spot: 0.1,
    key: 0.7,
    keyCam: 0.7,
    keyDir: [1.1, 1.8, 0.4],
    rim: 1.2,
    rimAng: 0.9,
    haze: 0.2,
    vignette: 0.75,
    env: 0.5,
    // The barrel slides up behind the hero title: keep it dim there.
    scrim: 0.6,
    scrimEdge: 0.9,
    shade: 1,
  },
  { at: 0.85, aim: { mic: 0.088 }, dist: 0.1, anchor: [0.55, 0.55], ...MACRO_PORTRAIT, roll: 0.94, keyDir: [0.6, 2.3, 0.3] },
  { at: 1.4, aim: { mic: 0.08 }, dist: 0.1, anchor: [0.55, 0.55], ...MACRO_PORTRAIT, roll: 0.82, keyDir: [1.0, 2.2, 0.3] },
  { at: 1.72, aim: { mic: 0.072 }, dist: 0.1, anchor: [0.55, 0.55], ...MACRO_PORTRAIT, roll: 0.51, keyDir: [1.3, 2.0, 0.3] },
  // The same pull back as on landscape, at portrait distances.
  { at: 1.7925, aim: { mic: 0.075 }, dist: 0.158, anchor: [0.54, 0.56], ...MACRO_PORTRAIT, roll: 0.44, keyDir: [1.4, 1.9, 0.3], dof: 0.5 },
  { at: 1.865, aim: { mic: 0.082 }, dist: 0.273, anchor: [0.53, 0.575], roll: 0.37, ...PULL_BARREL, fov: 33, exposure: 1.08, scrim: 0.35, parallax: 0 },
  { at: 1.9375, aim: { mic: 0.09 }, dist: 0.494, anchor: [0.515, 0.59], roll: 0.3, ...PULL_MIC, fov: 34.5, scrim: 0.35, parallax: 0 },
  { at: 2.01, aim: { mic: 0.1 }, dist: 0.98, anchor: [0.5, 0.6], roll: 0.23, ...PULL_DARK, fov: 36, parallax: 0 },
  { at: 2.0825, aim: { stand: 1.5 }, dist: 1.943, anchor: P_ANCHOR, roll: 0.16, ...PULL_STAND, fov: 37, parallax: 0 },
  { at: 2.155, aim: { stand: 1.38 }, dist: 3.517, anchor: P_ANCHOR, roll: 0.09, ...STAGE_PORTRAIT, ...STAGE_WARM, spot: 0.18, cone: 0.04, key: 0.7 },
  { at: 2.2275, aim: { stand: 1.16 }, dist: 6.08, anchor: P_ANCHOR, roll: 0.02, ...STAGE_PORTRAIT, ...STAGE_WARM, spot: 0.24, cone: 0.05, key: 0.65 },
  { at: 2.3, aim: { stand: 0.85 }, dist: 9.6, anchor: P_ANCHOR, ...STAGE_PORTRAIT, ...STAGE_WARM, cone: 0.06 },
  { at: 2.4, aim: { stand: 0.85 }, dist: 9.6, anchor: P_ANCHOR, ...STAGE_PORTRAIT, spot: 0.8, cone: 0.3, key: 0.55 },
  { at: 2.5, aim: { stand: 0.85 }, dist: 9.6, anchor: P_ANCHOR, ...STAGE_PORTRAIT },
  { at: 2.96, aim: { stand: 0.85 }, dist: 9.6, anchor: P_ANCHOR, ...STAGE_PORTRAIT },
  { at: 3.92, aim: { stand: 0.83 }, dist: 10.1, anchor: P_ANCHOR, ...STAGE_PORTRAIT, cone: 0.7, spot: 1.05, exposure: 0.97 },
  { at: 4.6, aim: { stand: 0.68 }, dist: 15, lift: 0.4, anchor: P_ANCHOR, ...STAGE_PORTRAIT, cone: 1.5, key: 0.3, scrimEdge: 0.6 },
  { at: 5.3, aim: { stand: 0.52 }, dist: 21, lift: 1.1, anchor: P_ANCHOR, ...STAGE_PORTRAIT, exposure: 0.95, cone: 1.6, key: 0.3, vignette: 0.64 },
  { at: 5.78, aim: { stand: 0.45 }, dist: 24, lift: 1.4, anchor: P_ANCHOR, ...STAGE_PORTRAIT, exposure: 0.88, cone: 1.6, key: 0.3, vignette: 0.66 },
  { at: 6.0, aim: { stand: 0.45 }, dist: 24, lift: 1.4, anchor: P_ANCHOR, ...STAGE_PORTRAIT, ...DARK },
  { at: 9.5, aim: { stand: 0.45 }, dist: 24, lift: 1.4, anchor: P_ANCHOR, ...STAGE_PORTRAIT, ...DARK },
];

/** Calm, dim hero-like framing for routes without the home sections. */
export const AWAY_SHOT: Shot = {
  at: 0,
  aim: { mic: 0.095 },
  dist: 0.7,
  anchor: [0.7, 0.42],
  fov: 30,
  exposure: 0.5,
  drift: 0.02,
  parallax: 0.025,
  cone: 0.04,
  spot: 0.4,
  key: 0.8,
  rim: 1.2,
  haze: 0.6,
  vignette: 0.7,
};
export const AWAY_SHOT_PORTRAIT: Shot = {
  ...AWAY_SHOT,
  aim: { mic: 0.08 },
  dist: 1.2,
  anchor: [0.5, 0.62],
  fov: 36,
  exposure: 0.4,
};

/**
 * Journey position at or beyond which the scene is fully dark: the end of
 * Tickets. The text-only partner band after Tickets has no data-section, so J
 * rests at 6 while it scrolls past; the scene is already black behind it.
 */
export const DARK_FROM = 6.0;

/* ------------------------------------------------------------------------- */
/* Content-dependent variants                                                */
/* ------------------------------------------------------------------------- */

export type ShotOptions = {
  /** No speaker announced yet: no card strip, one panel low-left; the stage frame holds through the whole pin. */
  speakersTba: boolean;
  /** Schedule height / a full schedule's height (0.4..1): a short schedule drifts back less. */
  scheduleScale: number;
};

/** The shot list for the current page content (defaults reproduce DESKTOP_SHOTS / PORTRAIT_SHOTS). */
export function shotsFor(portrait: boolean, opts: ShotOptions): Shot[] {
  const base = portrait ? PORTRAIT_SHOTS : DESKTOP_SHOTS;
  const k = Math.min(1, Math.max(0.4, opts.scheduleScale));
  const hold = base.find((s) => s.at === 2.96);
  // Speakers announced (landscape): when the card strip comes up along the lower edge, the frame
  // drifts a little further back and the stage rises into the upper-middle band, on the same axis.
  const announced = !opts.speakersTba && !portrait && hold ? { ...hold, aim: { stand: 0.6 }, dist: 7.0, anchor: [0.68, 0.36] as const } : null;
  return base.flatMap((sh): Shot[] => {
    // Schedule: the drift back continues from the hold that actually comes before it (never a
    // push back in); a short schedule drifts back less.
    if (sh.at === 3.92 && hold) {
      const prev = announced ?? hold;
      const drop = 'stand' in sh.aim && 'stand' in hold.aim ? hold.aim.stand - sh.aim.stand : 0;
      return [{ ...sh, aim: 'stand' in prev.aim ? { stand: prev.aim.stand - drop } : sh.aim, anchor: prev.anchor, dist: prev.dist + (sh.dist - hold.dist) * k }];
    }
    if (announced && sh.at === 2.96) return [{ ...announced, at: 2.58 }, announced];
    return [sh];
  });
}

/* ------------------------------------------------------------------------- */
/* Resolution and sampling                                                   */
/* ------------------------------------------------------------------------- */

const WORLD_UP = new Vector3(0, 1, 0);
const rs = { f: new Vector3(), u0: new Vector3(), m: new Vector3(), c: new Vector3() };

/** Camera up for a view direction `fwd` rolled by `roll` radians (0: horizon level). */
function upFor(fwd: Vector3, roll: number, out: Vector3): Vector3 {
  const u0 = rs.u0.copy(WORLD_UP).addScaledVector(fwd, -WORLD_UP.dot(fwd)).normalize();
  if (roll === 0) return out.copy(u0);
  const r = rs.c.crossVectors(fwd, u0); // screen left
  return out.copy(u0).multiplyScalar(Math.cos(roll)).addScaledVector(r, Math.sin(roll)).normalize();
}

/** Roll (radians) that turns the mic barrel upright on screen for a view direction. */
function barrelRoll(fwd: Vector3): number {
  const u0 = rs.u0.copy(WORLD_UP).addScaledVector(fwd, -WORLD_UP.dot(fwd)).normalize();
  const m = rs.m.copy(MIC_AXIS).addScaledVector(fwd, -MIC_AXIS.dot(fwd)).normalize();
  const left = rs.c.crossVectors(fwd, u0);
  return Math.atan2(m.dot(left), m.dot(u0));
}

export function resolveShot(s: Shot): ResolvedShot {
  const target = aimPoint(s.aim);
  const origin = trackOrigin(s.aim);
  const lift = s.lift ?? 0;
  const pos = origin.clone().addScaledVector(TRACK, s.dist);
  pos.y += lift;
  const off = pos.clone().sub(target);
  const dir = off.clone().normalize();
  const fwd = dir.clone().negate();
  const roll = (s.roll ?? 0) * barrelRoll(fwd);
  return {
    at: s.at,
    pos,
    target,
    dir,
    logDist: Math.log(Math.max(1e-4, off.length())),
    up: upFor(fwd, roll, new Vector3()),
    origin,
    logU: Math.log(Math.max(1e-4, s.dist)),
    lift,
    roll,
    shiftX: s.anchor[0],
    shiftY: s.anchor[1],
    fov: s.fov,
    exposure: s.exposure,
    dof: s.dof ?? 0,
    drift: s.drift ?? 0,
    parallax: s.parallax ?? 0,
    cone: s.cone ?? 1,
    spot: s.spot ?? 1,
    envRot: s.envRot ?? 0,
    shade: s.shade ?? 0,
    key: s.key ?? 1,
    keyCam: s.keyCam ?? ('mic' in s.aim && s.dist < 0.2 ? 1 : 0),
    vignette: s.vignette ?? 0.6,
    rim: s.rim ?? 1,
    rimAng: s.rimAng ?? 0.5,
    haze: s.haze ?? 0,
    motes: s.motes ?? 0,
    keyDir: new Vector3(...(s.keyDir ?? [-0.18, 0.9, 0])),
    focusX: s.focus?.[0] ?? s.anchor[0],
    focusY: s.focus?.[1] ?? 1 - s.anchor[1],
    scrim: s.scrim ?? 0,
    scrimEdge: s.scrimEdge ?? 0,
    band: s.band ?? 0,
    bloom: s.bloom ?? 1,
    env: s.env ?? 1,
  };
}

export const resolveShots = (shots: Shot[]) => shots.map(resolveShot);

const scalarKeys = [
  'logU',
  'lift',
  'roll',
  'shiftX',
  'shiftY',
  'fov',
  'exposure',
  'dof',
  'drift',
  'parallax',
  'cone',
  'spot',
  'envRot',
  'shade',
  'key',
  'keyCam',
  'vignette',
  'rim',
  'rimAng',
  'haze',
  'motes',
  'focusX',
  'focusY',
  'scrim',
  'scrimEdge',
  'band',
  'bloom',
  'env',
] as const;
const vectorKeys = ['target', 'origin', 'keyDir'] as const;

/**
 * Fritsch-Carlson monotone cubic slopes for samples ys at xs: never
 * overshoots, zero slope at local extrema and at holds, C1 everywhere.
 */
export function pchipSlopes(xs: readonly number[], ys: readonly number[]): number[] {
  const n = xs.length;
  const m = new Array<number>(n).fill(0);
  if (n < 3) return m;
  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]));
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) continue;
    const h0 = xs[k] - xs[k - 1];
    const h1 = xs[k + 1] - xs[k];
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
  }
  return m;
}

function hermite(y0: number, y1: number, m0: number, m1: number, h: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1;
}

type Spline = { xs: number[]; ys: Record<string, number[]>; ms: Record<string, number[]> };
const splines = new WeakMap<ResolvedShot[], Spline>();

function splineFor(shots: ResolvedShot[]): Spline {
  let sp = splines.get(shots);
  if (sp) return sp;
  const xs = shots.map((s) => s.at);
  const ys: Record<string, number[]> = {};
  for (const k of scalarKeys) ys[k] = shots.map((s) => s[k]);
  for (const k of vectorKeys) for (const c of ['x', 'y', 'z'] as const) ys[`${k}.${c}`] = shots.map((s) => s[k][c]);
  const ms: Record<string, number[]> = {};
  for (const k of Object.keys(ys)) ms[k] = pchipSlopes(xs, ys[k]);
  sp = { xs, ys, ms };
  splines.set(shots, sp);
  return sp;
}

/** Fill the derived pose (camera, direction, distance, up) from the track channels. */
function derivePose(out: ResolvedShot) {
  out.pos.copy(out.origin).addScaledVector(TRACK, Math.exp(out.logU));
  out.pos.y += out.lift;
  out.dir.subVectors(out.pos, out.target);
  out.logDist = Math.log(Math.max(1e-4, out.dir.length()));
  out.dir.normalize();
  upFor(rs.f.copy(out.dir).negate(), out.roll, out.up);
}

/** Sample the path at journey position J into `out` (mutated). */
export function sampleShots(shots: ResolvedShot[], J: number, out: ResolvedShot): ResolvedShot {
  const n = shots.length;
  if (n === 1 || J <= shots[0].at) return copyShot(shots[0], out);
  if (J >= shots[n - 1].at) return copyShot(shots[n - 1], out);
  const sp = splineFor(shots);
  let i = 0;
  while (i < n - 2 && J >= shots[i + 1].at) i++;
  const h = sp.xs[i + 1] - sp.xs[i];
  const t = (J - sp.xs[i]) / h;
  const ev = (k: string) => hermite(sp.ys[k][i], sp.ys[k][i + 1], sp.ms[k][i], sp.ms[k][i + 1], h, t);
  for (const k of scalarKeys) out[k] = ev(k);
  for (const k of vectorKeys) out[k].set(ev(`${k}.x`), ev(`${k}.y`), ev(`${k}.z`));
  derivePose(out);
  out.at = J;
  return out;
}

function copyShot(s: ResolvedShot, out: ResolvedShot) {
  out.pos.copy(s.pos);
  out.target.copy(s.target);
  out.dir.copy(s.dir);
  out.logDist = s.logDist;
  out.up.copy(s.up);
  out.origin.copy(s.origin);
  out.keyDir.copy(s.keyDir);
  for (const k of scalarKeys) out[k] = s[k];
  out.at = s.at;
  return out;
}

export function emptyShot(): ResolvedShot {
  return resolveShot({ at: 0, aim: { mic: 0.095 }, dist: 1, anchor: [0.5, 0.5], fov: 30, exposure: 1 });
}

/* ------------------------------------------------------------------------- */
/* Journey coordinate                                                        */
/* ------------------------------------------------------------------------- */

/**
 * J from per-section progress (scrollState.sections) plus the measured
 * section heights (px) and viewport height. Returns -1 when no home
 * sections are present.
 */
export function journey(
  sections: Record<SectionId, number>,
  heights: Partial<Record<SectionId, number>>,
  vh: number,
): number {
  let any = false;
  let last = -1;
  for (let k = 0; k < SECTION_IDS.length; k++) {
    const id = SECTION_IDS[k];
    const h = heights[id];
    if (!h) continue;
    any = true;
    const p = sections[id];
    const c = (p * (h + vh) - vh / 2) / h;
    if (c >= 0 && c < 1) return k + c;
    if (c >= 1) last = k + 1;
    else return last >= 0 ? last : Math.max(0, k + c);
  }
  return any ? Math.max(0, last) : -1;
}
