import { Vector3 } from 'three';
import { MIC_AXIS, VIEW_AZ, micToWorld } from './layout';
import type { SectionId } from './scrollState';
import { SECTION_IDS } from './scrollState';

/**
 * Camera choreography as data.
 *
 * THE PRINCIPLE: ONE SUBJECT, ONE CONTINUOUS MOVE.
 *
 * The subject of the whole page is the microphone on its stand at the centre
 * of the red rug. It is always the subject and, once the engraving macro is
 * over, always wholly in frame, at a screen place that changes only slowly
 * (a lens shift, never a turn of the camera to look for it). The camera makes
 * ONE slow move over the whole journey, the way a motion-control crane shot
 * in a car film travels round its car: every frame follows from the one
 * before, nothing ever cuts, whips or reverses, and while a 3D section is on
 * screen the move never quite stops.
 *
 * The move, beat by beat (landscape; portrait is the same move with smaller
 * amplitudes):
 * 1. Hero -> Theme: push in along the camera axis to the engraved band. In
 *    the macro the camera tracks slowly down the barrel and the barrel's
 *    sleeve turns a few degrees on its own axis (`turn`), so the engraved rows
 *    roll past; the object moves, the camera does not fly.
 * 2. Theme -> Speakers: one spiral pull out. The camera retreats along the
 *    mic while it starts to orbit (towards the grille side) and sinks to
 *    about mic height, so the stand, the rug and the beam arrive with
 *    parallax; the light comes up as the stage arrives.
 * 3. Speakers -> Schedule -> Venue: the same orbit continues in the same
 *    direction, slowly, while the camera rises steadily: low and heroic at
 *    Speakers (the beam towering), a high crane view down on the rug at the
 *    end of Venue. Schedule's light beat is the beam's colour temperature
 *    going from warm to cool as the programme passes (`warm`).
 * 4. Venue -> Tickets: still the same orbit, now pulling back and up over the
 *    seats into the wide house view.
 * 5. After Tickets: the lights go down; the move eases to a stop in the dark.
 * 6. Idle: with the page at rest the frame still breathes (a few millimetres
 *    of camera float, the dust and the haze in the beam). The static tier
 *    (reduced motion) has no canvas at all.
 *
 * The camera is held on a sphere round the subject: an aim point (`aim`,
 * held at the screen anchor), a distance (`dist`), an orbit angle (`orbit`,
 * degrees round the vertical, 0 = the hero's heading VIEW_AZ) and an
 * elevation (`elev`, degrees). The camera path is written as a few keys per
 * channel (see `track()` and the *_MOVE tables below) and the shot list is
 * sampled from them at an even spacing, so the speed of the move is decided
 * in one place and stays even across section boundaries.
 *
 * When you edit the move, keep to the rules the debug simulator checks
 * (`__sceneSim.motion()` with ?scene-debug=1; it prints pass / fail):
 * - the orbit angle never reverses; from the end of the macro the distance to
 *   the subject only grows; from Speakers to the end of Tickets the camera
 *   only rises;
 * - per filmstrip step (2.5% of the Theme..Tickets journey, J 0.125) the
 *   view direction turns by at most MOTION_LIMITS.viewDeg and the subject
 *   moves by at most MOTION_LIMITS.screen of the frame width, with no single
 *   step more than about twice the median step of its beat (no stop-start at
 *   section boundaries: the channels are monotone cubics, velocity continuous);
 * - no run of more than MOTION_LIMITS.stillRun steps without camera change
 *   while a 3D section is on screen;
 * - the subject stays clear of the copy column (landscape: right of
 *   MOTION_LIMITS.copyX of the width) and inside the frame;
 * - light changes ride on the move (they come up after the framing has
 *   arrived, never in one step), and nothing bright passes behind body copy
 *   (the veils: scrim, scrimEdge, band, shade).
 *
 * Journey coordinate `J`: continuous over the home page; section k (in
 * SECTION_IDS order) spans [k, k+1) and the fraction is how far the viewport
 * centre has travelled through it. So J = 0.5 is the hero's middle at the
 * viewport centre; on a 1440x900 screen 1.22..1.78 is the pinned part of the
 * 225vh theme runway and the speakers stage pins at about 2.25; 2.5 is
 * speakers centred, and so on.
 *
 * Every channel (distance, orbit, elevation, aim point, anchor, roll, light)
 * is interpolated with a monotone cubic (Fritsch-Carlson) through the shots:
 * no overshoot, velocity continuous across shots, zero velocity where two
 * shots hold the same value. The camera then follows that path with
 * critically damped springs (rig.ts).
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
  /** Camera distance (m) from the aim's track origin. */
  dist: number;
  /**
   * Orbit angle round the vertical through the subject (degrees, 0 = the hero's
   * heading VIEW_AZ; negative swings the camera round towards the grille side).
   */
  orbit?: number;
  /** Elevation of the camera above the subject (degrees, default TRACK_ELEV). */
  elev?: number;
  /** Extra camera height (m), straight up. */
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
  /** Colour temperature of the overhead spot and its beam: +1 warm, 0 neutral, -1 cool. */
  warm?: number;
  /** Turn of the barrel sleeve (engraving, knurl) about the mic axis, radians. */
  turn?: number;
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
  /**
   * Track: origin, log of the distance, orbit and elevation (radians), lift.
   * The camera is origin + trackDir(orbit, elev) * exp(logU) + lift * Y.
   */
  origin: Vector3;
  logU: number;
  orbit: number;
  elev: number;
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
  warm: number;
  turn: number;
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
  /**
   * Bank angle per unit of lateral angular velocity (rad per rad/s), and its
   * limit: a crane does not bank, so only a hint of it on a fast fling round the orbit.
   */
  rollGain: 0.02,
  rollMax: 0.012,
  /** Lens-shift (screen anchor) follow time (seconds). */
  anchorFollow: 0.4,
};

/* ------------------------------------------------------------------------- */
/* The sphere round the subject                                              */
/* ------------------------------------------------------------------------- */

/** Point on the mic (mic-space y), in world space. */
export const micPoint = (y: number) => micToWorld(new Vector3(0, y, 0));

/** The middle of the barrel (the hero's aim): the top of the stand line and the centre of the orbit. */
export const SPINE = micPoint(0.095);
/** Elevation of the hero's camera axis (radians): the camera looks a little down on the subject. */
export const TRACK_ELEV = 0.07;
const DEG = Math.PI / 180;

/** Unit direction from the subject towards the camera for an orbit and an elevation (radians). */
export function trackDir(orbit: number, elev: number, out = new Vector3()): Vector3 {
  const az = VIEW_AZ + orbit;
  return out.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
}
/** The hero's camera axis (orbit 0). */
export const TRACK = trackDir(0, TRACK_ELEV);

/**
 * The calm limits of the move (checked by `__sceneSim.motion()`), per
 * filmstrip step of J 0.125 (2.5% of the Theme..Tickets journey).
 */
export const MOTION_LIMITS = {
  /** Largest turn of the view direction per step (degrees). */
  viewDeg: 3.5,
  /** Largest move of the subject on screen per step (fraction of the frame width). */
  screen: 0.025,
  /** No step may be more than this many times the median step of its beat. */
  spike: 2.2,
  /** While a 3D section is on screen, at most this many consecutive steps without camera change. */
  stillRun: 3,
  /** Landscape: the subject stays right of this fraction of the width (the copy column is left of it). */
  copyX: 0.55,
};

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
const PULL_MIC = { fov: 29.5, exposure: 1.03, dof: 0.4, drift: 0.004, parallax: 0.008, cone: 0.02, spot: 0.02, key: 0.85, keyCam: 0.5, keyDir: [1.5, 1.6, 0.3] as V3, rim: 1.0, rimAng: 0.1, haze: 0.3, motes: 0.2, vignette: 0.75, envRot: -0.2, env: 0.55, scrim: 0.4, scrimEdge: 0.6, bloom: 1.1 };
/** The whole microphone on a dark stage. */
const PULL_DARK = { fov: 30, exposure: 1, dof: 0.3, drift: 0.004, parallax: 0.012, cone: 0.04, spot: 0.04, key: 0.85, keyCam: 0.3, keyDir: [1.4, 1.6, 0.3] as V3, rim: 1.2, rimAng: -0.3, haze: 0.25, motes: 0, vignette: 0.72, envRot: 0, env: 0.6, scrim: 0.35, scrimEdge: 0.5, bloom: 1.1 };
/** Microphone and upper stand, the spot just beginning to warm. */
const PULL_STAND = { fov: 31, exposure: 1, dof: 0.22, drift: 0.005, parallax: 0.016, cone: 0.03, spot: 0.15, key: 0.8, keyCam: 0.1, rim: 1.15, rimAng: -0.45, haze: 0.08, motes: 0, vignette: 0.68, env: 0.75, scrim: 0.2, scrimEdge: 0.3, bloom: 1.1 };

/**
 * Journey position at or beyond which the scene is fully dark: the end of
 * Tickets. The text-only partner band after Tickets has no data-section, so J
 * rests at 6 while it scrolls past; the scene is already black behind it.
 */
export const DARK_FROM = 6.0;

/** In the macro the barrel slides right so its engraved column clears the theme headline (left edge past ~58%). */
const ANCHOR_MACRO: readonly [number, number] = [0.8, 0.5];

/* ------------------------------------------------------------------------- */
/* The move: keys per channel                                                */
/* ------------------------------------------------------------------------- */

/** Keys of one channel: [J, value] pairs, J increasing. */
type Keys = readonly (readonly [number, number])[];

const trackSlopes = new WeakMap<Keys, number[]>();
/** Monotone cubic through `keys` at J (held flat outside the keys). */
export function track(keys: Keys, J: number): number {
  const n = keys.length;
  if (J <= keys[0][0] || n === 1) return keys[0][1];
  if (J >= keys[n - 1][0]) return keys[n - 1][1];
  let m = trackSlopes.get(keys);
  if (!m) {
    m = pchipSlopes(
      keys.map((k) => k[0]),
      keys.map((k) => k[1]),
    );
    trackSlopes.set(keys, m);
  }
  let i = 0;
  while (i < n - 2 && J >= keys[i + 1][0]) i++;
  const h = keys[i + 1][0] - keys[i][0];
  return hermite(keys[i][1], keys[i + 1][1], m[i], m[i + 1], h, (J - keys[i][0]) / h);
}

/**
 * The camera move from the end of the engraving macro to the end of the
 * journey, one set of keys per channel, all starting at the macro's last shot:
 * - `dist` (m, interpolated in log space) grows fast in the spiral pull out
 *   and then keeps growing slowly to the end: it never stops;
 * - `orbit`, `elev` (degrees) swing round and rise;
 * - the aim slides up the barrel (`mic`, mic-space height) until `micUntil`,
 *   then down the stand line: first so that the middle of the barrel glides
 *   evenly to its stage place on screen (`barrelY`, fraction from the top;
 *   the aim height follows from the distance), from the last `barrelY` key
 *   on by height (`stand`, metres);
 * - `ax`, `ay`: the screen anchor; `roll`: the macro's roll unwinding.
 * `pull` is where the pull out starts and lands (its looks are chosen by it).
 */
type Move = {
  pull: { from: number; to: number };
  micUntil: number;
  orbit: Keys;
  elev: Keys;
  dist: Keys;
  mic: Keys;
  barrelY: Keys;
  stand: Keys;
  ax: Keys;
  ay: Keys;
  roll: Keys;
};


/**
 * Landscape. The orbit swings round towards the grille side in one direction
 * only: about 15 degrees in the pull out, 45 more over Speakers, Schedule and
 * Venue (while the camera rises from mic height, looking slightly up, to a
 * crane view about 19 degrees down), 10 more over Tickets. The rates are kept
 * even (about 2.5 to 3 degrees of turn per filmstrip step), so the move flows
 * across the section boundaries.
 */
const DESKTOP_MOVE: Move = {
  pull: { from: 1.66, to: 2.5 },
  micUntil: 2.05,
  orbit: [
    [1.66, 0],
    [2.5, -13],
    [5.0, -60],
    [5.85, -70],
    [6.0, -70.6],
  ],
  elev: [
    [1.66, TRACK_ELEV / DEG],
    [2.25, -1.5],
    [5.0, 18],
    [5.85, 19],
    [6.0, 19.05],
  ],
  // The pull out: about 2x per filmstrip step at its fastest, landing softly into the slow drift
  // back of the stage beats.
  dist: [
    [1.66, 0.067],
    [1.8, 0.11],
    [2.0, 0.45],
    [2.2, 2.0],
    [2.4, 4.6],
    [2.55, 5.6],
    [2.7, 5.95],
    [3.0, 6.3],
    [4.0, 7.5],
    [5.0, 9.6],
    [5.5, 13.2],
    [5.85, 16.3],
    [6.0, 16.5],
  ],
  mic: [
    [1.66, 0.0725],
    [2.05, 0.1],
  ],
  // The barrel glides from the anchor up to about a third of the height while the stand and the
  // rug come in below it (about 1.5% of the width per step, with the anchor's own slide).
  barrelY: [
    [1.85, 0.475],
    [2.1, 0.435],
    [2.35, 0.395],
    [2.6, 0.352],
    [2.85, 0.315],
  ],
  // Speakers: on the red circle, the stand's foot clear of the glass panel low left. Tickets: the
  // stage rises into the upper right, above the fact list (x 0.59-0.95, y 0.24-0.56) and the numerals.
  stand: [
    [3.0, 1.03],
    [4.0, 0.82],
    [5.0, 0.62],
    [5.85, 0.52],
    [6.0, 0.52],
  ],
  // The barrel's slide right in the macro unwinds evenly (about 1.8% of the width per step).
  ax: [
    [1.66, ANCHOR_MACRO[0]],
    [1.9, 0.77],
    [2.2, 0.725],
    [2.55, 0.69],
    [2.9, 0.68],
    [6.0, 0.68],
  ],
  ay: [
    [1.66, ANCHOR_MACRO[1]],
    [2.0, 0.46],
    [2.5, 0.42],
    [4.0, 0.42],
    [4.5, 0.4],
    [5.6, 0.21],
    [6.0, 0.2],
  ],
  roll: [
    [1.66, 0.55],
    [2.4, 0],
  ],
};

/** Portrait: the same move, smaller (about two thirds of the orbit and of the rise), the subject centred. */
const PORTRAIT_MOVE: Move = {
  pull: { from: 1.66, to: 2.5 },
  micUntil: 2.05,
  orbit: [
    [1.66, 0],
    [2.5, -10],
    [5.0, -40],
    [5.85, -46],
    [6.0, -46.4],
  ],
  elev: [
    [1.66, TRACK_ELEV / DEG],
    [2.2, 1],
    [5.0, 13],
    [5.85, 14],
    [6.0, 14.05],
  ],
  dist: [
    [1.66, 0.1],
    [1.8, 0.16],
    [2.0, 0.62],
    [2.2, 2.7],
    [2.4, 6.1],
    [2.55, 7.5],
    [2.7, 7.95],
    [3.0, 8.3],
    [4.0, 9.0],
    [5.0, 13.5],
    [5.5, 19],
    [5.85, 23],
    [6.0, 23.3],
  ],
  mic: [
    [1.66, 0.0725],
    [2.05, 0.1],
  ],
  barrelY: [
    [1.85, 0.56],
    [2.1, 0.52],
    [2.35, 0.475],
    [2.6, 0.43],
    [2.85, 0.39],
  ],
  stand: [
    [3.0, 0.58],
    [4.0, 0.53],
    [5.0, 0.5],
    [5.85, 0.45],
    [6.0, 0.45],
  ],
  ax: [
    [1.66, 0.55],
    [2.4, 0.5],
    [6.0, 0.5],
  ],
  ay: [
    [1.66, 0.55],
    [2.4, 0.57],
    [6.0, 0.57],
  ],
  roll: [
    [1.66, 0.55],
    [2.4, 0],
  ],
};

/** Look values carried by the light keys (every key spreads a full look, so every field has a value at every key). */
type Look = Omit<Shot, 'at' | 'aim' | 'dist' | 'orbit' | 'elev' | 'lift' | 'anchor' | 'roll' | 'keyDir' | 'focus'>;
type LightKey = { at: number } & Look;

const lightTracks = new WeakMap<readonly LightKey[], Map<string, Keys>>();
/** The look at J, every numeric field interpolated through the light keys. */
function lightAt(keys: readonly LightKey[], J: number): Look {
  let tracks = lightTracks.get(keys);
  if (!tracks) {
    tracks = new Map();
    const fields = new Set<string>();
    for (const k of keys) for (const f of Object.keys(k)) if (f !== 'at') fields.add(f);
    for (const f of fields) {
      const ks: [number, number][] = [];
      for (const k of keys) {
        const v = (k as unknown as Record<string, number | undefined>)[f];
        if (typeof v === 'number') ks.push([k.at, v]);
      }
      tracks.set(f, ks);
    }
    lightTracks.set(keys, tracks);
  }
  const out: Record<string, number> = {};
  for (const [f, ks] of tracks) out[f] = track(ks, J);
  return out as unknown as Look;
}

/*
 * The stage light along the move. The spot and its shaft come up as the pull out lands on the
 * stage (Speakers); over Schedule the beam's colour temperature goes from warm to cool, as the
 * programme passes; at Venue the shaft thins (the crane looks down past it, the location card and
 * the copy sit beside it); after Tickets the lights go down.
 */
const STAGE_KEYS_DESKTOP: LightKey[] = [
  { at: 2.5, ...STAGE_LOOK, ...STAGE_WARM, spot: 0.3, cone: 0.1, key: 0.6, warm: 0.1 },
  { at: 2.62, ...STAGE_LOOK, spot: 0.75, cone: 0.65, key: 0.55, warm: 0.15 },
  { at: 2.75, ...STAGE_LOOK, warm: 0.2 },
  { at: 3.1, ...STAGE_LOOK, warm: 0.45 },
  { at: 3.9, ...STAGE_LOOK, cone: 1.45, spot: 0.95, exposure: 0.97, warm: -0.45 },
  { at: 4.6, ...STAGE_LOOK, fov: 31, cone: 0.45, spot: 0.95, key: 0.35, vignette: 0.6, scrimEdge: 0.5, warm: -0.35 },
  { at: 5.3, ...STAGE_LOOK, fov: 30, exposure: 0.95, cone: 0.38, spot: 0.95, key: 0.3, vignette: 0.62, scrimEdge: 0.7, warm: -0.2 },
  { at: 5.8, ...STAGE_LOOK, fov: 30, exposure: 0.9, cone: 0.28, spot: 0.95, key: 0.3, vignette: 0.65, scrimEdge: 0.7, warm: -0.15 },
  { at: 6.0, ...STAGE_LOOK, fov: 30, ...DARK, scrimEdge: 0.7, warm: -0.15 },
];

/** On phones the speakers and schedule copy sits over the beam: a thinner shaft, darker at the top edge, keeps it at 4.5:1. */
const STAGE_PORTRAIT = { ...STAGE_LOOK, fov: 36, exposure: 1.0, parallax: 0, cone: 0.4, spot: 1.1, scrimEdge: 0.55 };
const STAGE_KEYS_PORTRAIT: LightKey[] = [
  { at: 2.5, ...STAGE_PORTRAIT, ...STAGE_WARM, cone: 0.06, warm: 0.1 },
  { at: 2.62, ...STAGE_PORTRAIT, spot: 0.8, cone: 0.3, key: 0.55, warm: 0.15 },
  { at: 2.75, ...STAGE_PORTRAIT, warm: 0.2 },
  { at: 3.1, ...STAGE_PORTRAIT, warm: 0.45 },
  { at: 3.9, ...STAGE_PORTRAIT, cone: 0.7, spot: 1.05, exposure: 0.97, warm: -0.45 },
  { at: 4.6, ...STAGE_PORTRAIT, cone: 1.5, key: 0.3, scrimEdge: 0.6, warm: -0.35 },
  { at: 5.3, ...STAGE_PORTRAIT, exposure: 0.95, cone: 1.6, key: 0.3, vignette: 0.64, warm: -0.2 },
  { at: 5.8, ...STAGE_PORTRAIT, exposure: 0.88, cone: 1.6, key: 0.3, vignette: 0.66, warm: -0.15 },
  { at: 6.0, ...STAGE_PORTRAIT, ...DARK, warm: -0.15 },
];

const MACRO_PORTRAIT = { ...MACRO, fov: 34, exposure: 1.15, dof: 0.6, key: 0.85, motes: 0.6, scrim: 0.35, bloom: 0.9, focus: [0.6, 0.45] as const };

/** Looks along the spiral pull out, by how far through it the journey is (0 = the macro, 1 = landed on the stage). */
function pullLook(f: number, portrait: boolean): Look & { keyDir?: V3; focus?: readonly [number, number] } {
  const p = portrait ? { parallax: 0 } : {};
  if (f < 0.12) return { ...(portrait ? MACRO_PORTRAIT : MACRO), keyDir: [2.0, 1.6, 0.3], dof: portrait ? 0.5 : 0.7, motes: 0.8, scrim: portrait ? 0.35 : 0.5 };
  if (f < 0.25) return { ...PULL_BARREL, ...(portrait ? { fov: 33, exposure: 1.08, scrim: 0.35 } : {}), ...p };
  if (f < 0.4) return { ...PULL_MIC, ...(portrait ? { fov: 34.5, scrim: 0.35 } : {}), ...p };
  if (f < 0.52) return { ...PULL_DARK, ...(portrait ? { fov: 36 } : {}), ...p };
  if (f < 0.64) return { ...PULL_STAND, fov: portrait ? 36 : 31, ...p };
  const stage = portrait ? STAGE_PORTRAIT : STAGE_LOOK;
  if (f < 0.76) return { ...stage, ...STAGE_WARM, spot: 0.18, cone: 0.05, key: 0.7, rim: 1.05 };
  return { ...stage, ...STAGE_WARM, spot: 0.25, cone: 0.07, key: 0.65, rim: 1.0 };
}

/** Sleeve turn along the hero, the macro and the start of the pull out (radians). */
const TURN: Keys = [
  [0.8, 0.075],
  [0.98, 0.07],
  [1.66, -0.045],
  [2.0, -0.07],
];

/** Step of the sampled shots of the move (J). */
const MOVE_STEP = 0.0625;

/**
 * The shot list of one move, sampled from its keys at an even spacing from
 * the macro's last shot to the end of Tickets: the spiral pull out (looks by
 * how far it has gone), then the stage under its light keys. `variant`
 * overrides the anchor height and barrel glide keys (a content variant).
 */
function moveShots(move: Move, lights: readonly LightKey[], portrait: boolean, variant: Partial<Pick<Move, 'ay' | 'barrelY'>> = {}): Shot[] {
  const mv = { ...move, ...variant };
  const ay = mv.ay;
  const out: Shot[] = [];
  const logDist: Keys = mv.dist.map(([j, d]) => [j, Math.log(d)] as const);
  const { from, to } = mv.pull;
  const lookAt = (J: number) => (J < to ? pullLook((J - from) / (to - from), portrait) : lightAt(lights, J));
  // While the barrel glides to its stage place, the aim height follows from where the barrel should
  // be on screen: it sits (anchor - barrelY) of the frame height above the aim.
  const glideTo = mv.barrelY[mv.barrelY.length - 1][0];
  const glideAim = (J: number) => {
    const half = Math.tan(((lookAt(J).fov ?? 30) * DEG) / 2);
    return SPINE.y - (track(ay, J) - track(mv.barrelY, J)) * 2 * Math.exp(track(logDist, J)) * half;
  };
  const stand: Keys = [[glideTo, glideAim(glideTo)], ...mv.stand.filter(([j]) => j > glideTo)];
  for (let k = 1; ; k++) {
    const J = +(from + k * MOVE_STEP).toFixed(4);
    if (J > DARK_FROM + 1e-9) break;
    out.push({
      ...lookAt(J),
      at: J,
      aim: J < mv.micUntil ? { mic: track(mv.mic, J) } : { stand: J < glideTo ? glideAim(J) : track(stand, J) },
      dist: Math.exp(track(logDist, J)),
      orbit: track(mv.orbit, J),
      elev: track(mv.elev, J),
      anchor: [track(mv.ax, J), track(ay, J)],
      roll: track(mv.roll, J),
      turn: track(TURN, J),
    } as Shot);
  }
  // After Tickets the lights stay down and the move has come to rest.
  out.push({ ...out[out.length - 1], at: 9.5 });
  return out;
}

/** Desktop: the hero, the push in and the engraving macro, then the move. */
const DESKTOP_OPENING: Shot[] = [
  { at: 0, aim: { mic: 0.095 }, dist: 0.4, anchor: [0.68, 0.4], turn: 0.08, ...HERO_LOOK },
  // The hero is never quite still: a very slow push of a centimetre and a half over its scroll.
  { at: 0.55, aim: { mic: 0.095 }, dist: 0.385, anchor: [0.68, 0.4], turn: 0.078, ...HERO_LOOK },
  {
    // Push in along the axis; the barrel starts to stand upright as the engraving fills the frame.
    at: 0.8,
    aim: { mic: 0.09 },
    dist: 0.14,
    anchor: [0.82, 0.46],
    roll: 0.7,
    turn: 0.075,
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
  // The macro: the same push settles on the engraving, then tracks slowly down the barrel while the
  // sleeve turns a few degrees (the rows roll past). The barrel arrives upright (roll ~1) and the
  // roll unwinds evenly into the pull out, so the subject never spins as it recedes.
  { at: 0.98, aim: { mic: 0.088 }, dist: 0.066, anchor: ANCHOR_MACRO, ...MACRO, roll: 0.94, turn: track(TURN, 0.98), keyDir: [1.1, 2.2, 0.3] },
  { at: 1.3, aim: { mic: 0.081 }, dist: 0.066, anchor: ANCHOR_MACRO, ...MACRO, roll: 0.9, turn: track(TURN, 1.3), keyDir: [1.5, 2.0, 0.3] },
  { at: 1.6, aim: { mic: 0.074 }, dist: 0.066, anchor: ANCHOR_MACRO, ...MACRO, roll: 0.63, turn: track(TURN, 1.6), keyDir: [1.8, 1.8, 0.3] },
  { at: 1.66, aim: { mic: 0.0725 }, dist: 0.067, anchor: ANCHOR_MACRO, ...MACRO, roll: 0.55, turn: track(TURN, 1.66), keyDir: [2.0, 1.6, 0.3] },
];

/** Portrait: the subject centred, in the lower middle (the copy sits above it on full-width scrims). */
const HERO_PORTRAIT_LOOK = { fov: 34, exposure: 1.15, drift: 0.008, parallax: 0, cone: 0.02, spot: 0.15, key: 0.75, rim: 3.4, rimAng: 0.75, haze: 0.2, vignette: 0.72 };
const PORTRAIT_OPENING: Shot[] = [
  { at: 0, aim: { mic: 0.1 }, dist: 0.62, anchor: [0.5, 0.66], turn: 0.08, ...HERO_PORTRAIT_LOOK },
  { at: 0.45, aim: { mic: 0.1 }, dist: 0.6, anchor: [0.5, 0.66], turn: 0.078, ...HERO_PORTRAIT_LOOK },
  {
    at: 0.65,
    aim: { mic: 0.09 },
    dist: 0.22,
    anchor: [0.52, 0.6],
    roll: 0.7,
    turn: 0.075,
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
  { at: 0.85, aim: { mic: 0.088 }, dist: 0.1, anchor: [0.55, 0.55], ...MACRO_PORTRAIT, roll: 0.94, turn: track(TURN, 0.85), keyDir: [0.6, 2.3, 0.3] },
  { at: 1.4, aim: { mic: 0.08 }, dist: 0.1, anchor: [0.55, 0.55], ...MACRO_PORTRAIT, roll: 0.82, turn: track(TURN, 1.4), keyDir: [1.0, 2.2, 0.3] },
  { at: 1.66, aim: { mic: 0.0725 }, dist: 0.1, anchor: [0.55, 0.55], ...MACRO_PORTRAIT, roll: 0.55, turn: track(TURN, 1.66), keyDir: [1.3, 2.0, 0.3] },
];

/**
 * Speakers announced (landscape): the strip of speaker cards comes up along the lower edge early
 * in the pin, so the pull out lands the stage a little higher on screen (the same aim, the anchor
 * and the barrel's glide both about 7% higher) and it settles back down through Schedule.
 */
const DESKTOP_ANNOUNCED: Partial<Pick<Move, 'ay' | 'barrelY'>> = {
  ay: [
    [1.66, ANCHOR_MACRO[1]],
    [2.0, 0.44],
    [2.5, 0.355],
    [3.1, 0.35],
    [3.9, 0.415],
    [4.1, 0.42],
    [4.5, 0.4],
    [5.6, 0.21],
    [6.0, 0.2],
  ],
  barrelY: [
    [1.85, 0.47],
    [2.1, 0.42],
    [2.35, 0.36],
    [2.6, 0.3],
    [2.85, 0.245],
  ],
};

export const DESKTOP_SHOTS: Shot[] = [...DESKTOP_OPENING, ...moveShots(DESKTOP_MOVE, STAGE_KEYS_DESKTOP, false)];
export const PORTRAIT_SHOTS: Shot[] = [...PORTRAIT_OPENING, ...moveShots(PORTRAIT_MOVE, STAGE_KEYS_PORTRAIT, true)];

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


/* ------------------------------------------------------------------------- */
/* Content-dependent variants                                                */
/* ------------------------------------------------------------------------- */

export type ShotOptions = {
  /** No speaker announced yet: no card strip, one panel low-left; the stage frame holds through the whole pin. */
  speakersTba: boolean;
  /**
   * Schedule height / a full schedule's height (0.4..1). The move is written in
   * journey units, so a short schedule passes the same stretch of the orbit in
   * less scroll; the shots do not change.
   */
  scheduleScale: number;
};

/** The shot list for the current page content (defaults reproduce DESKTOP_SHOTS / PORTRAIT_SHOTS). */
export function shotsFor(portrait: boolean, opts: ShotOptions): Shot[] {
  if (portrait || opts.speakersTba) return portrait ? PORTRAIT_SHOTS : DESKTOP_SHOTS;
  return [...DESKTOP_OPENING, ...moveShots(DESKTOP_MOVE, STAGE_KEYS_DESKTOP, false, DESKTOP_ANNOUNCED)];
}

/* ------------------------------------------------------------------------- */
/* Resolution and sampling                                                   */
/* ------------------------------------------------------------------------- */

const WORLD_UP = new Vector3(0, 1, 0);
const rs = { f: new Vector3(), u0: new Vector3(), m: new Vector3(), c: new Vector3(), d: new Vector3() };

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
  const orbit = (s.orbit ?? 0) * DEG;
  const elev = s.elev === undefined ? TRACK_ELEV : s.elev * DEG;
  const pos = origin.clone().addScaledVector(trackDir(orbit, elev), s.dist);
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
    orbit,
    elev,
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
    warm: s.warm ?? 0,
    turn: s.turn ?? 0,
  };
}

export const resolveShots = (shots: Shot[]) => shots.map(resolveShot);

const scalarKeys = [
  'logU',
  'orbit',
  'elev',
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
  'warm',
  'turn',
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
  out.pos.copy(out.origin).addScaledVector(trackDir(out.orbit, out.elev, rs.d), Math.exp(out.logU));
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
