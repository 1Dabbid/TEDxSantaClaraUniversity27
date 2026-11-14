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
 * amplitudes and the subject small and high in the frame):
 * 1. Hero -> Theme: one push in along the camera axis to the engraved band
 *    (an even zoom profile, at most about 1.45x per filmstrip step). In the
 *    macro the camera tracks slowly down the barrel and the barrel's sleeve
 *    turns a few degrees on its own axis (`turn`), so the engraved rows roll
 *    past; the object moves, the camera does not fly.
 * 2. Theme -> Speakers: one spiral pull out over the whole of Speakers
 *    (J 1.6 to 3.2). The camera retreats along the mic while it starts to
 *    orbit (towards the grille side) and sinks to about mic height, so the
 *    stand, the rug and the beam arrive with parallax. The light follows the
 *    reveal (keyed by the distance): the spot already glows in the haze while
 *    the whole microphone is still on its own, so the stage is never dark.
 * 3. Speakers -> Schedule -> Venue: the same orbit continues in the same
 *    direction, slowly, while the camera rises steadily from mic height,
 *    looking slightly up, to a crane view down on the rug at the end of Venue.
 *    Schedule's light beat is the beam's colour temperature going from warm
 *    to cool as the programme passes (`warm`).
 * 4. Venue -> Tickets: still the same orbit, now drawing back and up over the
 *    seats into the wide house view; the key and rim stay on the microphone.
 * 5. After Tickets: the lights go down; the move eases to a stop in the dark.
 * 6. Idle: with the page at rest the frame still breathes (a few millimetres
 *    of camera float, the dust and the haze in the beam). The static tier
 *    (reduced motion) has no canvas at all.
 *
 * The camera is held on a sphere round the subject: an aim point (`aim`,
 * held at the screen anchor), a distance (`dist`), an orbit angle (`orbit`,
 * degrees round the vertical, 0 = the hero's heading VIEW_AZ) and an
 * elevation (`elev`, degrees). The whole move is written as a few keys per
 * channel (the *_MOVE tables below) and the shot list is sampled from them at
 * an even spacing, so the speed of the move is decided in one place and stays
 * even across section boundaries. Where the subject sits across the width over
 * Speakers, Venue and Tickets is measured from the page layout
 * (contentLayout.ts), so it keeps clear of the copy at every desktop width.
 *
 * When you edit the move, keep to the rules the debug simulator checks
 * (`__sceneSim.motion()` with ?scene-debug=1; it prints pass / fail):
 * - the orbit angle never reverses; from the end of the macro the distance to
 *   the subject only grows; from Speakers to the end of Tickets the camera
 *   only rises;
 * - per filmstrip step (2.5% of the Theme..Tickets journey, J 0.125) the
 *   view direction turns by at most MOTION_LIMITS.viewDeg, the subject moves
 *   by at most MOTION_LIMITS.screen of the frame and the scale changes by at
 *   most MOTION_LIMITS.zoom (log of the distance), with no single step more
 *   than MOTION_LIMITS.spike times the median step of its beat and no sudden
 *   change of speed between neighbouring steps (MOTION_LIMITS.accel,
 *   zoomAccel): the channels are monotone cubics, velocity continuous;
 * - no run of more than MOTION_LIMITS.stillRun steps without camera change
 *   while a 3D section is on screen;
 * - the subject stays inside the frame and, given the copy boxes of the page
 *   at each step (the audit script collects them), clear of every line of
 *   text and every panel (landscape), or behind headings, buttons and panels
 *   only briefly or under the band veil (portrait);
 * - light changes ride on the move (never in one step), and nothing bright
 *   passes behind body copy (the veils: scrim, scrimEdge, band, shade; the
 *   rendered frames are checked for the contrast behind the copy).
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
  /**
   * Largest move of the subject on screen per step (fraction of the frame's long side). 3%: the
   * subject is larger in the frame than in the earlier cut (the camera works closer over the stage
   * beats, so the head and clip read as it turns), and part of every step is the stand shrinking
   * about its middle as the camera draws back.
   */
  screen: 0.03,
  /** No step may be more than this many times the median step of its beat. */
  spike: 2.2,
  /** Largest change of scale per step: |change of ln(camera-to-aim distance)| (0.47 is 1.6x). */
  zoom: 0.55,
  /**
   * Velocity continuity: the largest change between neighbouring steps, relative to the larger of
   * the two, for the view turn and for the change of scale (counted once the step is visible).
   */
  accel: 0.5,
  zoomAccel: 0.5,
  /** The scale continuity rule counts once a step changes the scale by more than this (ln; 0.15 is 16%). */
  zoomAccelFrom: 0.15,
  /**
   * Copy keep-out with the real layout (the audit script passes the copy boxes): from the landing of
   * the pull out on the stage to the moment the Tickets copy fills the frame (after it the lights go
   * down and the legibility of the copy is checked on the rendered frames instead). Landscape: the
   * subject never touches a line of text or a panel, with `copyAirPx` of air round text and
   * `copyPanelAirPx` round a panel's edge.
   */
  copyJ: [2.25, 5.45] as const,
  copyAirPx: 24,
  copyPanelAirPx: 12,
  /**
   * Portrait: the copy runs the full width and scrolls through the whole height, so no screen place
   * stays clear of it. Headings, buttons and panels may pass the subject only briefly (at most
   * `portraitRun` consecutive steps, at most `portraitShare` of the steps) unless the band veil is
   * at least `portraitVeil` there (the subject taken down under the heading); body text may pass
   * over it where the frame behind the text stays dark enough (checked on the rendered frames).
   */
  portraitRun: 2,
  portraitShare: 0.3,
  portraitVeil: 0.45,
  /**
   * The subject's frame: the whole microphone in frame from `frameMicFrom` (the pull out has left the
   * barrel; before it the aim point's lens shift is what moves on screen), the stand's foot from
   * `frameFootFrom` (the pull out has landed; before it the foot rising into the frame as the stand
   * shrinks is the reveal itself, and its speed is the pull out's, which the scale rule limits).
   */
  frameMicFrom: 2.375,
  frameFootFrom: 3.25,
  /** While a 3D section is on screen, at most this many consecutive steps without camera change. */
  stillRun: 3,
};

/** World position of an aim point. */
export function aimPoint(aim: Aim, out = new Vector3()): Vector3 {
  if ('mic' in aim) return micToWorld(out.set(0, aim.mic, 0), out);
  return out.set(SPINE.x, aim.stand, SPINE.z);
}
/**
 * The centre of the camera's sphere: the aim point itself on the barrel (a
 * slide along the barrel carries the camera with it, so it never turns), the
 * top of the stand line otherwise (the camera orbits and rises round the stand
 * line while the aim moves down it).
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
 * - speakers J 2..3: heading top left (left 45%), a glass panel along the
 *   bottom (x 2-72%, y 72-96%; it has its own backing, the rug may pass behind
 *   it); when speakers are announced, a strip of cards along the lower edge
 *   from early in the pin
 * - schedule J 3..4: a column on the left 40%
 * - venue J 4..5: heading top left, details across the lower half over a scrim,
 *   a location card with a small map at the top right (over the upper beam,
 *   left edge near 68%): the anchor drifts to about 62% while it is up
 * - tickets J 5..6: text left, big numerals at the bottom
 */

const DARK = { exposure: 0, drift: 0, parallax: 0, key: 0, spot: 0, cone: 1, vignette: 0.8 };

/**
 * Look values: everything a shot carries besides its geometry. The key light's
 * camera-relative direction (Shot.keyDir) is carried as three numbers and the
 * sharp point of the edge blur as an offset from the screen anchor, so that
 * every field interpolates along the move.
 */
type Look = Omit<Shot, 'at' | 'aim' | 'dist' | 'orbit' | 'elev' | 'lift' | 'anchor' | 'roll' | 'keyDir' | 'focus' | 'turn'> & {
  kx?: number;
  ky?: number;
  kz?: number;
  /** Sharp point of the edge blur relative to the anchor (fractions of the frame; x right, y up). */
  fdx?: number;
  fdy?: number;
};
/** Every look field with its neutral value: each light key starts from it, so every key carries every field. */
const LOOK_BASE: Required<Look> = {
  fov: 30,
  exposure: 1,
  dof: 0,
  drift: 0,
  parallax: 0,
  cone: 1,
  spot: 1,
  envRot: 0,
  shade: 0,
  key: 1,
  keyCam: 0,
  vignette: 0.6,
  rim: 1,
  rimAng: 0.5,
  haze: 0,
  motes: 0,
  scrim: 0,
  scrimEdge: 0,
  band: 0,
  bloom: 1,
  env: 1,
  warm: 0,
  kx: -0.18,
  ky: 0.9,
  kz: 0,
  fdx: 0,
  fdy: 0,
};

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
  // The studio strips walk round the barrel (the macro itself holds orbit 0): the streak runs down
  // the engraved column, a little right of the row starts, so the etched copy reads bright.
  envRot: -0.72,
  env: 0.4,
  fdx: -0.02,
  scrim: 0.55,
  scrimEdge: 0.9,
  bloom: 1.3,
};

const HERO_LOOK = { fov: 30, exposure: 1.05, drift: 0.012, parallax: 0.022, cone: 0.05, spot: 0.45, key: 1.15, rim: 1.5, rimAng: 0.45, haze: 1, vignette: 0.6, bloom: 1 };
/** Halfway along the push in: the barrel fills the right of the frame, the key starts to ride the camera. */
const PUSH_LOOK = { fov: 28, exposure: 1.05, dof: 0.45, drift: 0.004, parallax: 0.006, cone: 0.015, spot: 0.15, key: 0.7, keyCam: 0.7, kx: 1.1, ky: 1.8, kz: 0.4, rim: 0.7, rimAng: 1.0, haze: 0.3, motes: 0.5, vignette: 0.75, envRot: 0.4, env: 0.5, scrim: 0.4, scrimEdge: 0.85, bloom: 1.2 };
/** The stage under its light: Speakers and everything after it. */
const STAGE_LOOK = { fov: 32, exposure: 1, dof: 0.1, drift: 0.006, parallax: 0.025, cone: 1.3, spot: 1, key: 0.5, keyCam: 0, rim: 0.9, rimAng: -0.6, haze: 0, motes: 0, vignette: 0.62, bloom: 1.1, env: 1 };

/*
 * Looks along the spiral pull out, between the macro and the lit stage. The key light leaves the
 * camera (keyCam 1 -> 0) and the rim swings from screen right to the upstage side. The stage is
 * never dark behind the subject: the overhead spot already glows warm in the haze while the whole
 * microphone is still in frame on its own, and the shaft grows as the stand and the rug arrive.
 */
/** The barrel standing back from upright, the engraving still lit by the raking key. */
const PULL_BARREL = { fov: 29, exposure: 1.06, dof: 0.5, drift: 0.003, parallax: 0.006, cone: 0, spot: 0, key: 0.8, keyCam: 0.75, kx: 1.8, ky: 1.7, kz: 0.35, rim: 0.7, rimAng: 0.6, haze: 0.15, motes: 0.5, vignette: 0.8, envRot: -0.5, env: 0.45, scrim: 0.45, scrimEdge: 0.75, bloom: 1.2 };
/** Barrel and grille; the spot starts to warm the haze behind. */
const PULL_MIC = { fov: 29.5, exposure: 1.03, dof: 0.4, drift: 0.004, parallax: 0.008, cone: 0.1, spot: 0.32, key: 0.85, keyCam: 0.5, kx: 1.5, ky: 1.6, kz: 0.3, rim: 1.0, rimAng: 0.1, haze: 0.3, motes: 0.2, vignette: 0.75, envRot: -0.2, env: 0.55, scrim: 0.4, scrimEdge: 0.6, bloom: 1.1 };
/** The whole microphone in the warm haze of the spot. */
const PULL_WHOLE = { fov: 30, exposure: 1, dof: 0.3, drift: 0.004, parallax: 0.012, cone: 0.2, spot: 0.46, key: 0.85, keyCam: 0.3, kx: 1.4, ky: 1.6, kz: 0.3, rim: 1.2, rimAng: -0.3, haze: 0.25, motes: 0, vignette: 0.72, envRot: 0, env: 0.6, scrim: 0.35, scrimEdge: 0.5, bloom: 1.1 };
/** Microphone and upper stand, the spot warming. */
const PULL_STAND = { fov: 31, exposure: 1, dof: 0.22, drift: 0.005, parallax: 0.016, cone: 0.26, spot: 0.55, key: 0.8, keyCam: 0.1, rim: 1.15, rimAng: -0.45, haze: 0.08, motes: 0, vignette: 0.68, env: 0.75, scrim: 0.2, scrimEdge: 0.3, bloom: 1.1 };

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

/** Filmstrip step (J): 2.5% of the Theme..Tickets journey. The speed limits are per step. */
const FILM_STEP = 0.125;

/**
 * Keys for a change of distance (log space) from d0 to d1 starting at J0, one
 * key per filmstrip step, with the given relative speed for each step (scaled
 * so the steps add up to the whole change). The speed profile is the shape of
 * the zoom: ramps of at most 2x between neighbouring steps, a flat top, so the
 * scale changes at an even, readable rate and starts and stops softly.
 */
function zoomKeys(J0: number, d0: number, d1: number, profile: readonly number[]): [number, number][] {
  const total = profile.reduce((a, b) => a + b, 0);
  const l0 = Math.log(d0);
  const dl = Math.log(d1) - l0;
  const keys: [number, number][] = [[J0, l0]];
  let acc = 0;
  profile.forEach((p, k) => {
    acc += p;
    keys.push([+(J0 + (k + 1) * FILM_STEP).toFixed(4), l0 + (dl * acc) / total]);
  });
  return keys;
}
/** The push in from the hero to the engraving: nine filmstrip steps, at most 1.45x per step. */
const PUSH_PROFILE = [0.15, 0.3, 0.55, 0.85, 1, 0.85, 0.55, 0.3, 0.15];
/** The spiral pull out: thirteen filmstrip steps (desktop), at most about 1.7x per step, with a long soft landing. */
const PULL_PROFILE = [0.25, 0.4, 0.6, 0.8, 0.95, 1, 1, 0.95, 0.8, 0.6, 0.42, 0.27, 0.15];
/** Phones pull further out (the subject is smaller in the frame): one more step at full speed. */
const PULL_PROFILE_PORTRAIT = [0.25, 0.4, 0.6, 0.8, 0.95, 1, 1, 1, 0.95, 0.8, 0.6, 0.42, 0.27, 0.15];

/**
 * The whole camera move, hero to the end of Tickets, one set of keys per channel:
 * - `push`: the push in (start, distances); then the macro holds its distance
 *   while it tracks down the barrel and the sleeve turns, until `pull.from`;
 * - `pull`: the spiral pull out (start, landing distance, speed profile); it
 *   lands at `pull.to` (derived) and `dist` continues from there, slowly, to
 *   the end: from the start of the pull out the distance never stops growing;
 * - `orbit`, `elev` (degrees) swing round in one direction and rise;
 * - the aim: a point on the mic axis (`mic`, mic-space height) until
 *   `micUntil`, then on the stand line: first so that the middle of the barrel
 *   glides evenly from the anchor to its stage place on screen (`barrelY`,
 *   fraction from the top, its first key at `micUntil`; the aim height follows
 *   from the distance), from the last `barrelY` key on by height (`stand`, m);
 * - `ax`, `ay`: the screen anchor (a lens shift); `roll`: the barrel standing
 *   upright for the macro and unwinding in the pull out;
 * - `looks`: the light keys before the pull out (by J), along it (by the log of
 *   the distance: the light follows the reveal), and on the stage (by J).
 */
type Move = {
  push: { from: number; d0: number; d1: number };
  pull: { from: number; d0: number; d1: number; profile: readonly number[] };
  dist: Keys;
  micUntil: number;
  mic: Keys;
  barrelY: Keys;
  stand: Keys;
  orbit: Keys;
  elev: Keys;
  ax: Keys;
  ay: Keys;
  roll: Keys;
  looks: { open: readonly LightKey[]; pull: readonly LightKey[]; stage: readonly LightKey[] };
  /** Optional: the upper-middle band veil (Shot.band) by J, over the looks. */
  band?: Keys;
};
type LightKey = { at: number } & Required<Look>;
const lk = (at: number, ...parts: Partial<Look>[]): LightKey => Object.assign({ at }, LOOK_BASE, ...parts);

const lightTracks = new WeakMap<readonly LightKey[], Map<string, Keys>>();
/** The look at x (J, or the log of the distance for the pull out), every field interpolated through the keys. */
function lightAt(keys: readonly LightKey[], x: number): Required<Look> {
  let tracks = lightTracks.get(keys);
  if (!tracks) {
    tracks = new Map();
    for (const f of Object.keys(LOOK_BASE)) tracks.set(f, keys.map((k) => [k.at, (k as unknown as Record<string, number>)[f]] as const));
    lightTracks.set(keys, tracks);
  }
  const out: Record<string, number> = {};
  for (const [f, ks] of tracks) out[f] = track(ks, x);
  return out as unknown as Required<Look>;
}

/** Sleeve turn along the hero, the push in, the macro and the start of the pull out (radians). */
const TURN: Keys = [
  [0, 0.08],
  [0.5, 0.078],
  [0.95, 0.075],
  [1.25, 0.07],
  [1.8, -0.045],
  [2.25, -0.07],
];

/*
 * Landscape. The hero holds, then one push in along the camera axis (J 0.5 to
 * 1.25) settles on the engraved band; the macro tracks down the barrel while
 * the sleeve turns; the spiral pull out (J 1.6 to 3.1) retreats along the mic
 * while the orbit starts round towards the grille side and the camera sinks to
 * mic height, so the stand, the rug and the beam arrive with parallax over
 * Speakers. The orbit carries on in the same direction (about 40 degrees over
 * Schedule and Venue, 9 more over Tickets) while the camera rises from mic
 * height, looking slightly up, to a crane view about 19 degrees down, pulling
 * back over the seats at the end.
 */
/** Speakers, Venue and Tickets x when the layout is not measured (1440 wide). */
const SPEAKERS_X = 0.73;
const VENUE_X = 0.64;
const TICKETS_X = 0.56;

const DESKTOP_MOVE: Move = {
  push: { from: 0.45, d0: 0.4, d1: 0.066 },
  pull: { from: 1.6, d0: 0.067, d1: 4.5, profile: PULL_PROFILE },
  // After the landing: the slow drift back over the stage beats, then the pull back over the seats
  // (capped so the microphone still reads at the wide end).
  dist: [
    [4.0, 6.3],
    [5.0, 9.0],
    [5.5, 11.8],
    [5.85, 14.2],
    [6.0, 14.4],
  ],
  micUntil: 2.4,
  // The macro tracks a little way down the barrel; the pull out slides the aim back to the barrel's
  // middle slowly, while the camera is already far enough away for it to read as part of the retreat.
  mic: [
    [0.5, 0.095],
    [0.95, 0.09],
    [1.3, 0.087],
    [1.8, 0.082],
    [2.4, 0.095],
  ],
  // The middle of the barrel glides from the anchor up to above a third of the height while the
  // stand and the rug come in below it, and settles back a little as the pull out lands, so the
  // stand shrinks about its middle and neither end of the subject travels far on screen; the aim
  // (held at the anchor) ends half way down the stand.
  barrelY: [
    [2.4, 0.43],
    [2.65, 0.37],
    [2.9, 0.315],
    [3.1, 0.285],
    [3.25, 0.28],
    [3.45, 0.295],
    [3.6, 0.3],
    [3.9, 0.298],
    [4.2, 0.293],
  ],
  // Tickets: the stage rises into the upper right, above the ticket status row.
  stand: [
    [5.0, 0.62],
    [5.85, 0.52],
    [6.0, 0.52],
  ],
  orbit: [
    [1.6, 0],
    [2.0, -0.6],
    [2.3, -2.5],
    [2.7, -7.2],
    [3.1, -14],
    [5.0, -51],
    [5.85, -60],
    [6.0, -60.5],
  ],
  elev: [
    [1.6, TRACK_ELEV / DEG],
    [2.4, -1.2],
    [3.0, 1.5],
    [5.0, 16.5],
    [5.85, 23],
    [6.0, 23.1],
  ],
  // The barrel's slide right for the macro (even, about 2% of the width per step); an even slide
  // over the pull out to its place right of the Speakers panel; then an even drift left over Schedule
  // into the gutter between the Venue facts and the location plate; over Tickets into the gap between
  // the heading and the ticket details (stageAx).
  ax: [
    [0.45, 0.68],
    [0.6, 0.69],
    [1.3, 0.79],
    [1.45, ANCHOR_MACRO[0]],
    [1.75, 0.798],
    ...stageAx(SPEAKERS_X, VENUE_X, TICKETS_X),
  ],
  ay: [
    [0.45, 0.4],
    [0.6, 0.405],
    [1.3, 0.495],
    [1.45, ANCHOR_MACRO[1]],
    [1.9, 0.49],
    [2.4, 0.43],
    [3.3, 0.47],
    [4.0, 0.47],
    [4.2, 0.462],
    [5.5, 0.265],
    [5.6, 0.26],
    [6.0, 0.255],
  ],
  roll: [
    [0.5, 0],
    [0.95, 0.7],
    [1.25, 0.94],
    [1.55, 0.88],
    [2.1, 0.45],
    [2.75, 0],
  ],
  looks: {
    open: [
      lk(0.5, HERO_LOOK),
      lk(0.95, PUSH_LOOK),
      lk(1.25, MACRO, { kx: 1.1, ky: 2.2, kz: 0.3 }),
      lk(1.45, MACRO, { kx: 1.5, ky: 2.0, kz: 0.3 }),
      lk(1.6, MACRO, { kx: 2.0, ky: 1.6, kz: 0.3, dof: 0.7, motes: 0.8, scrim: 0.5 }),
    ],
    pull: [
      lk(Math.log(0.067), MACRO, { kx: 2.0, ky: 1.6, kz: 0.3, dof: 0.7, motes: 0.8, scrim: 0.5 }),
      lk(Math.log(0.12), PULL_BARREL),
      lk(Math.log(0.3), PULL_MIC),
      lk(Math.log(0.7), PULL_WHOLE),
      lk(Math.log(1.4), PULL_STAND),
      lk(Math.log(2.4), STAGE_LOOK, { spot: 0.52, cone: 0.3, key: 0.65, rim: 1.0, haze: 0.02, dof: 0.12 }),
      lk(Math.log(3.5), STAGE_LOOK, { spot: 0.66, cone: 0.5, key: 0.6, rim: 0.95, warm: 0.1 }),
      lk(Math.log(4.5), STAGE_LOOK, { spot: 0.78, cone: 0.7, key: 0.55, warm: 0.12 }),
    ],
    // The spot and its shaft are fully up early in Schedule; over Schedule the beam's colour
    // temperature goes from warm to cool as the programme passes; over Venue the shaft thins a
    // little (the location card has its own dark backing) and the key and rim stay on the
    // microphone; after Tickets the lights go down.
    stage: [
      lk(3.225, STAGE_LOOK, { spot: 0.78, cone: 0.7, key: 0.55, warm: 0.12 }),
      lk(3.4, STAGE_LOOK, { spot: 0.92, cone: 1.05, key: 0.52, warm: 0.25 }),
      lk(3.55, STAGE_LOOK, { warm: 0.4 }),
      lk(4.0, STAGE_LOOK, { cone: 1.4, spot: 0.95, warm: -0.45 }),
      lk(4.3, STAGE_LOOK, { fov: 31.5, cone: 1.2, spot: 0.95, key: 0.45, rim: 1.1, vignette: 0.61, scrimEdge: 0.3, warm: -0.4 }),
      lk(4.6, STAGE_LOOK, { fov: 31, cone: 1.0, spot: 0.95, key: 0.45, rim: 1.1, vignette: 0.6, scrimEdge: 0.5, warm: -0.35 }),
      // Tickets: the house view; the spot a little up and a soft glow in the air behind the subject,
      // so the stage still reads from the back of the room.
      lk(5.0, STAGE_LOOK, { fov: 31, cone: 1.15, spot: 1.0, key: 0.5, rim: 1.15, haze: 0.15, vignette: 0.6, scrimEdge: 0.6, warm: -0.3 }),
      lk(5.3, STAGE_LOOK, { fov: 32, exposure: 1.03, cone: 1.3, spot: 1.08, key: 0.52, rim: 1.2, haze: 0.3, vignette: 0.58, scrimEdge: 0.7, warm: -0.2 }),
      lk(5.6, STAGE_LOOK, { fov: 32.5, exposure: 1.0, cone: 1.25, spot: 1.08, key: 0.5, rim: 1.15, haze: 0.3, vignette: 0.6, scrimEdge: 0.7, warm: -0.17 }),
      lk(5.8, STAGE_LOOK, { fov: 32.5, exposure: 0.8, cone: 1.1, spot: 1.0, key: 0.45, rim: 1.0, haze: 0.2, vignette: 0.64, scrimEdge: 0.7, warm: -0.15 }),
      lk(6.0, STAGE_LOOK, { fov: 32.5 }, DARK, { scrimEdge: 0.7, warm: -0.15 }),
    ],
  },
};

/**
 * The anchor's x from Speakers to the end, for the subject's place right of
 * the Speakers panel (`sx`) and over Venue (`vx`), measured from the
 * layout (contentLayout), and over Tickets (`tx`) in the gap between the
 * heading and the ticket details.
 */
function stageAx(sx: number, vx: number, tx: number): [number, number][] {
  // The drift from Speakers to Venue at an even rate, eased in and out over a step or so.
  const a = sx - 0.008;
  const b = vx + 0.004;
  return [
    [2.9, sx + 0.004],
    [3.0, sx],
    [3.15, a],
    [3.3, a + (b - a) * 0.12],
    [3.75, a + (b - a) * 0.88],
    [3.9, b],
    [4.1, vx + 0.001],
    [4.85, vx],
    [4.95, vx + (tx - vx) * 0.1],
    [5.5, vx + (tx - vx) * 0.9],
    [5.6, tx],
    [6.0, tx + 0.005],
  ];
}

/** On phones the copy sits over the beam: a thinner shaft, darker at the top edge. */
const STAGE_PORTRAIT = { ...STAGE_LOOK, fov: 36, exposure: 1.0, parallax: 0, cone: 0.4, spot: 1.1, scrimEdge: 0.55 };
/** Phone macro: the engraving sits behind the theme's body copy, so the veil over it is heavier. */
const MACRO_PORTRAIT = { ...MACRO, fov: 34, exposure: 1.05, dof: 0.6, key: 0.8, motes: 0.6, scrim: 0.75, scrimEdge: 0.95, bloom: 0.8, fdx: -0.08 };
const HERO_PORTRAIT_LOOK = { fov: 34, exposure: 1.15, drift: 0.008, parallax: 0, cone: 0.02, spot: 0.15, key: 0.75, rim: 3.4, rimAng: 0.75, haze: 0.2, vignette: 0.72 };
// The barrel slides up behind the hero title: keep it dim there.
const PUSH_PORTRAIT_LOOK = { fov: 32, exposure: 0.78, dof: 0.3, drift: 0.004, cone: 0.015, spot: 0.1, key: 0.7, keyCam: 0.7, kx: 1.1, ky: 1.8, kz: 0.4, rim: 1.2, rimAng: 0.9, haze: 0.2, vignette: 0.75, env: 0.5, scrim: 0.6, scrimEdge: 0.9, shade: 1 };
const P0 = { parallax: 0 };

/*
 * Portrait: the same move with smaller amplitudes (about two thirds of the orbit
 * and of the rise). The copy runs the full width and scrolls through the whole
 * height, so the subject is kept small and high, in the upper middle of the
 * frame, where each section's opening lines pass it only briefly.
 */
const PORTRAIT_MOVE: Move = {
  push: { from: 0.4, d0: 0.6, d1: 0.1 },
  pull: { from: 1.6, d0: 0.101, d1: 10.5, profile: PULL_PROFILE_PORTRAIT },
  dist: [
    [4.0, 12.0],
    [5.0, 15.5],
    [5.5, 19.0],
    [5.85, 22.0],
    [6.0, 22.3],
  ],
  micUntil: 2.4,
  mic: [
    [0.45, 0.1],
    [0.9, 0.09],
    [1.25, 0.087],
    [1.8, 0.082],
    [2.4, 0.095],
  ],
  barrelY: [
    [2.4, 0.4],
    [2.65, 0.36],
    [2.9, 0.32],
    [3.1, 0.29],
    [3.25, 0.283],
    [3.45, 0.298],
    [3.6, 0.303],
    [3.9, 0.3],
    [4.2, 0.295],
  ],
  stand: [
    [5.0, 0.66],
    [5.85, 0.6],
    [6.0, 0.6],
  ],
  orbit: [
    [1.6, 0],
    [2.0, -0.45],
    [2.3, -1.9],
    [2.7, -5.6],
    [3.1, -11],
    [5.0, -38],
    [5.85, -44],
    [6.0, -44.4],
  ],
  elev: [
    [1.6, TRACK_ELEV / DEG],
    [2.4, 1],
    [3.0, 2],
    [5.0, 13],
    [5.85, 14],
    [6.0, 14.05],
  ],
  // The macro pushes the barrel right, part of it off the frame, away from the theme's body copy.
  ax: [
    [0.4, 0.5],
    [0.5, 0.505],
    [1.4, 0.665],
    [1.5, 0.67],
    [1.8, 0.665],
    [2.8, 0.505],
    [2.9, 0.5],
    [6.0, 0.5],
  ],
  // One even rise of the anchor from the hero's lower middle, through the macro, to the upper middle
  // where the stage lands.
  ay: [
    [0.4, 0.66],
    [0.5, 0.655],
    [1.45, 0.528],
    [2.4, 0.4],
    [3.5, 0.345],
    [6.0, 0.34],
  ],
  roll: [
    [0.45, 0],
    [0.85, 0.7],
    [1.2, 0.94],
    [1.55, 0.82],
    [2.1, 0.4],
    [2.75, 0],
  ],
  // Where a section's heading scrolls up through the subject's place (the opening lines of Schedule,
  // Venue and Tickets), the band veil over the upper middle takes the subject down under it.
  band: [
    [2.85, 0],
    [3.0, 0.55],
    [3.5, 0.55],
    [3.65, 0],
    [3.95, 0],
    [4.1, 0.55],
    [4.8, 0.55],
    [4.95, 0],
    [5.2, 0],
    [5.33, 0.55],
    [5.45, 0.55],
    [5.6, 0],
  ],
  looks: {
    open: [
      lk(0.45, HERO_PORTRAIT_LOOK),
      lk(0.8, PUSH_PORTRAIT_LOOK),
      lk(1.2, MACRO_PORTRAIT, { kx: 0.6, ky: 2.3, kz: 0.3 }),
      lk(1.4, MACRO_PORTRAIT, { kx: 1.0, ky: 2.2, kz: 0.3 }),
      lk(1.6, MACRO_PORTRAIT, { kx: 1.3, ky: 2.0, kz: 0.3, dof: 0.5, motes: 0.8 }),
    ],
    pull: [
      lk(Math.log(0.101), MACRO_PORTRAIT, { kx: 1.3, ky: 2.0, kz: 0.3, dof: 0.5, motes: 0.8 }),
      lk(Math.log(0.18), PULL_BARREL, { fov: 33, exposure: 1.0, scrim: 0.6, scrimEdge: 0.85 }, P0),
      lk(Math.log(0.45), PULL_MIC, { fov: 34.5, scrim: 0.5 }, P0),
      lk(Math.log(1.0), PULL_WHOLE, { fov: 36, scrim: 0.4 }, P0),
      lk(Math.log(2.2), PULL_STAND, { fov: 36 }, P0),
      lk(Math.log(4.5), STAGE_PORTRAIT, { spot: 0.52, cone: 0.15, key: 0.65, rim: 1.0, haze: 0.02, dof: 0.12 }),
      lk(Math.log(7.5), STAGE_PORTRAIT, { spot: 0.66, cone: 0.22, key: 0.6, rim: 0.95, warm: 0.1 }),
      lk(Math.log(10.5), STAGE_PORTRAIT, { spot: 0.78, cone: 0.28, key: 0.55, warm: 0.12 }),
    ],
    stage: [
      lk(3.35, STAGE_PORTRAIT, { spot: 0.78, cone: 0.28, key: 0.55, warm: 0.12 }),
      lk(3.5, STAGE_PORTRAIT, { spot: 0.92, cone: 0.34, key: 0.55, warm: 0.3 }),
      lk(3.6, STAGE_PORTRAIT, { warm: 0.4 }),
      lk(4.0, STAGE_PORTRAIT, { cone: 0.7, spot: 1.05, exposure: 0.97, warm: -0.45 }),
      lk(4.6, STAGE_PORTRAIT, { cone: 1.5, key: 0.4, rim: 1.1, scrimEdge: 0.6, warm: -0.35 }),
      lk(5.3, STAGE_PORTRAIT, { exposure: 0.95, cone: 1.6, key: 0.4, rim: 1.1, vignette: 0.64, warm: -0.2 }),
      lk(5.8, STAGE_PORTRAIT, { exposure: 0.8, cone: 1.6, key: 0.35, vignette: 0.66, warm: -0.15 }),
      lk(6.0, STAGE_PORTRAIT, DARK, { warm: -0.15 }),
    ],
  },
};

/** Step of the sampled shots of the move (J). */
const MOVE_STEP = 0.0625;

/**
 * The shot list of one move: a shot at J 0 (the hero at rest), then shots
 * sampled from the keys at an even spacing from the start of the push in to the
 * end of Tickets. `variant` overrides the anchor height and barrel glide keys
 * (a content variant).
 */
function moveShots(move: Move, variant: Partial<Pick<Move, 'ay' | 'barrelY' | 'ax'>> = {}): Shot[] {
  const mv = { ...move, ...variant };
  const { ay, looks } = mv;
  const pullKeys = zoomKeys(mv.pull.from, mv.pull.d0, mv.pull.d1, mv.pull.profile);
  const pullTo = pullKeys[pullKeys.length - 1][0];
  const logDist: Keys = [
    [0, Math.log(mv.push.d0 * 1.04)],
    ...zoomKeys(mv.push.from, mv.push.d0, mv.push.d1, PUSH_PROFILE),
    ...pullKeys,
    ...mv.dist.filter(([j]) => j > pullTo).map(([j, d]) => [j, Math.log(d)] as const),
  ];
  const look = (J: number) => {
    if (J < mv.pull.from) return lightAt(looks.open, J);
    if (J < pullTo) return lightAt(looks.pull, track(logDist, J));
    return lightAt(looks.stage, J);
  };
  // While the barrel glides to its stage place, the aim height follows from where the barrel should
  // be on screen: it sits (anchor - barrelY) of the frame height above the aim.
  const glideTo = mv.barrelY[mv.barrelY.length - 1][0];
  const glideAim = (J: number) => {
    const half = Math.tan((look(J).fov * DEG) / 2);
    return SPINE.y - (track(ay, J) - track(mv.barrelY, J)) * 2 * Math.exp(track(logDist, J)) * half;
  };
  const stand: Keys = [[glideTo, glideAim(glideTo)], ...mv.stand.filter(([j]) => j > glideTo)];
  const shotAt = (J: number): Shot => {
    const { kx, ky, kz, fdx, fdy, ...rest } = look(J);
    const anchor = [track(mv.ax, J), track(ay, J)] as const;
    return {
      ...rest,
      at: J,
      aim: J < mv.micUntil ? { mic: track(mv.mic, J) } : { stand: J < glideTo ? glideAim(J) : track(stand, J) },
      dist: Math.exp(track(logDist, J)),
      orbit: track(mv.orbit, J),
      elev: track(mv.elev, J),
      anchor,
      roll: track(mv.roll, J),
      turn: track(TURN, J),
      keyDir: [kx, ky, kz],
      focus: [anchor[0] + fdx, 1 - anchor[1] + fdy],
      band: mv.band ? track(mv.band, J) : rest.band,
    };
  };
  const out: Shot[] = [shotAt(0)];
  for (let k = 0; ; k++) {
    const J = +(mv.push.from + k * MOVE_STEP).toFixed(4);
    if (J > DARK_FROM + 1e-9) break;
    out.push(shotAt(J));
  }
  // After Tickets the lights stay down and the move has come to rest.
  out.push({ ...out[out.length - 1], at: 9.5 });
  return out;
}

/**
 * Speakers announced (landscape): the strip of speaker cards comes up along the lower edge early
 * in the pin, so the pull out lands the stage a little higher on screen (the same aim, the anchor
 * and the barrel's glide both about 7% higher) and it settles back down through Schedule.
 */
const DESKTOP_ANNOUNCED: Partial<Pick<Move, 'ay' | 'barrelY' | 'ax'>> = {
  ay: [
    ...DESKTOP_MOVE.ay.filter(([j]) => j < 2.4),
    [2.4, 0.43],
    [3.0, 0.41],
    [3.6, 0.42],
    [4.0, 0.47],
    [4.2, 0.462],
    [5.5, 0.265],
    [5.6, 0.26],
    [6.0, 0.255],
  ],
  barrelY: [
    [2.4, 0.43],
    [2.65, 0.365],
    [2.9, 0.305],
    [3.1, 0.27],
    [3.25, 0.262],
    [3.45, 0.27],
    [3.6, 0.275],
    [3.9, 0.278],
    [4.2, 0.28],
  ],
};

export const DESKTOP_SHOTS: Shot[] = moveShots(DESKTOP_MOVE);
export const PORTRAIT_SHOTS: Shot[] = moveShots(PORTRAIT_MOVE);

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
  /** Landscape: the subject's x right of the Speakers panel, over Venue and over Tickets (fractions of the width), measured from the layout. */
  speakersX?: number;
  venueX?: number;
  ticketsX?: number;
};

/** The shot list for the current page content (defaults reproduce DESKTOP_SHOTS / PORTRAIT_SHOTS). */
export function shotsFor(portrait: boolean, opts: ShotOptions): Shot[] {
  if (portrait) return PORTRAIT_SHOTS;
  const vx = opts.venueX === undefined ? VENUE_X : Math.min(0.68, Math.max(0.5, opts.venueX));
  // Without a speakers panel (speakers announced: the card strip along the lower edge) the default holds.
  // Over Speakers the subject sits right of the panel, and well right of its Venue place (on wide
  // screens the content column, and with it everything, sits nearer the middle).
  const sx = Math.min(0.82, Math.max(vx + 0.085, opts.speakersTba ? (opts.speakersX ?? SPEAKERS_X) : 0));
  const tx = opts.ticketsX === undefined ? TICKETS_X : Math.min(0.62, Math.max(0.5, opts.ticketsX));
  const measured = vx !== VENUE_X || sx !== SPEAKERS_X || tx !== TICKETS_X;
  if (opts.speakersTba && !measured) return DESKTOP_SHOTS;
  const ax = measured ? { ax: [...DESKTOP_MOVE.ax.filter(([j]) => j < 2.9), ...stageAx(sx, vx, tx)] } : {};
  return moveShots(DESKTOP_MOVE, opts.speakersTba ? ax : { ...DESKTOP_ANNOUNCED, ...ax });
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
