import { Vector3 } from 'three';
import { MIC_AXIS, MIC_MATRIX, MIC_MATRIX_INV, barrelRadius, micToWorld } from './layout';
import type { SectionId } from './scrollState';
import { SECTION_IDS } from './scrollState';

/**
 * Camera choreography as data.
 *
 * The journey coordinate `J` is continuous over the home page: section k
 * (in SECTION_IDS order) spans [k, k+1) and the fraction is how far the
 * viewport centre has travelled through that section. So J = 0.5 is the
 * hero's middle at the viewport centre, 1.2..1.8 is the pinned part of the
 * 250vh theme section, 2.5 is speakers centred, and so on.
 *
 * A shot is a camera pose plus look parameters. Poses are interpolated with
 * Catmull-Rom between shots (eased so the camera settles near each shot) and
 * the camera then follows that path with critically damped springs.
 */

export type V3 = readonly [number, number, number];

export type Shot = {
  at: number;
  /** 'world' (default) or 'mic': mic-space coordinates (+Y along the barrel). */
  space?: 'world' | 'mic';
  pos: V3;
  target: V3;
  /** Camera up; defaults to world +Y, or the barrel axis in mic space. */
  up?: V3;
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
   * A large `right` with small `up` rakes across the surface from screen right.
   */
  keyDir?: V3;
  /** Screen point that stays sharp under the edge blur, 0..1 (x right, y up). */
  focus?: readonly [number, number];
  /** Darken the left / centre of the frame (0..1) behind headline type. */
  scrim?: number;
  /** Darken thin bands along the top and bottom edges (0..1), behind section labels and captions. */
  scrimEdge?: number;
  /** Highlight bloom multiplier (high tier). */
  bloom?: number;
  /** Studio environment (reflection strips) intensity, default 1. */
  env?: number;
};

export type ResolvedShot = {
  at: number;
  pos: Vector3;
  target: Vector3;
  /** Unit offset from the target to the camera, and the log of that distance (the rig damps these, not pos). */
  dir: Vector3;
  logDist: number;
  up: Vector3;
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
  bloom: number;
  env: number;
};

/**
 * Camera rig tuning. The rig follows the sampled path as a target point plus
 * an offset (direction on the sphere, distance in log space), each critically
 * damped (`follow`, seconds), so the camera can never pass through its own
 * subject however fast the page is flung. The view direction then trails
 * that composition through a lightly under-damped spring (a heavy fluid head:
 * a small, bounded angular overshoot), and the camera banks a little into
 * lateral moves.
 */
export const RIG = {
  /** Smoothing of the journey coordinate itself (seconds). */
  journeySmooth: 0.12,
  /** Offset (direction, distance) follow time (seconds). */
  follow: 0.7,
  /** Target point follow time (seconds). */
  targetFollow: 0.6,
  /** View-direction spring frequency (Hz) and damping ratio (< 1 overshoots). */
  targetFreq: 0.9,
  targetZeta: 0.78,
  /** Bank angle per unit of lateral angular velocity (rad per rad/s), and its limit. */
  rollGain: 0.05,
  rollMax: 0.035,
};

/* ------------------------------------------------------------------------- */
/* Helpers to author shots                                                   */
/* ------------------------------------------------------------------------- */

const tuple = (v: Vector3): V3 => [v.x, v.y, v.z];

/** Point on the mic (mic-space y), in world space. */
export const micPoint = (y: number) => micToWorld(new Vector3(0, y, 0));

/**
 * World-space orbit shot around a centre: azimuth from +Z towards +X,
 * elevation, distance. `shift` moves the look target along camera right / up
 * so the subject lands off-centre (e.g. right third).
 */
function orbit(centre: Vector3, az: number, el: number, dist: number, shiftRight = 0, shiftUp = 0) {
  const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const pos = centre.clone().addScaledVector(dir, dist);
  const fwd = centre.clone().sub(pos).normalize();
  const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, fwd).normalize();
  const target = centre.clone().addScaledVector(right, -shiftRight).addScaledVector(up, -shiftUp);
  return { pos: tuple(pos), target: tuple(target) };
}

/** Mic-space macro shot looking at the barrel surface at angle phi, height y. */
function barrel(phi: number, y: number, dist: number, lookY = 0, shift = 0) {
  const r = barrelRadius(y);
  const n = [Math.sin(phi), 0, Math.cos(phi)] as const;
  // Tangent (towards decreasing phi): shifting the target along it slides the barrel across the frame.
  const tg = [-Math.cos(phi), 0, Math.sin(phi)] as const;
  const s = [n[0] * r, y, n[2] * r] as const;
  return {
    space: 'mic' as const,
    pos: [s[0] + n[0] * dist + tg[0] * shift * 0.3, s[1] - lookY * 0.5, s[2] + n[2] * dist + tg[2] * shift * 0.3] as V3,
    target: [s[0] + tg[0] * shift, s[1] + lookY, s[2] + tg[2] * shift] as V3,
  };
}

/**
 * World-space retreat from the barrel: start along the barrel normal at angle
 * phi (mic space, so the move continues straight out of the macro), level the
 * camera to elevation `el` and back off to `dist`, looking at the mic. Keeps
 * the horizon (dark curtain) behind the mic instead of the red rug below.
 */
function pullBackLevel(phi: number, dist: number, el: number, centre: Vector3) {
  const n = new Vector3(Math.sin(phi), 0, Math.cos(phi)).applyMatrix4(MIC_MATRIX).sub(micToWorld(new Vector3()));
  const az = Math.atan2(n.x, n.z);
  return orbit(centre, az, el, dist);
}

/* ------------------------------------------------------------------------- */
/* Shots                                                                     */
/* ------------------------------------------------------------------------- */

const MIC_MID = micPoint(0.095);
const STAGE = new Vector3(0, 0.15, 0);

/** Hero: low, close, heroic three-quarter on the mic, subject on the right third. */
const heroDesk = orbit(MIC_MID, 0.44, -0.07, 0.4, 0.088, -0.004);
/** Barrel angle (mic space) that faces the hero camera, so the push-in is continuous. */
const PHI_HERO = (() => {
  const p = new Vector3(...heroDesk.pos).applyMatrix4(MIC_MATRIX_INV);
  return Math.atan2(p.x, p.z);
})();

const DARK_POS: V3 = [-2.4, 5.4, 20.5];
const DARK_TARGET: V3 = [0, 0.4, 0];

/** Macro look shared by the engraving shots: raking key from screen right, bright side right. */
const MACRO = {
  fov: 28,
  exposure: 1.12,
  dof: 0.85,
  drift: 0.0012,
  parallax: 0.0018,
  cone: 0,
  spot: 0,
  key: 0.48,
  rim: 0.4,
  rimAng: 1.2,
  haze: 0,
  motes: 1,
  vignette: 0.85,
  focus: [0.7, 0.5] as const,
  envRot: 0.6,
  env: 0.22,
  scrim: 0.55,
  scrimEdge: 0.9,
  bloom: 1.3,
};

/**
 * Where the shots sit on the journey (measured on the composed page, desktop
 * 1440x900; phones in brackets):
 * - hero 0..0.55 (scroll 0 lands near J 0.45)
 * - theme opening frame J 0.8..0.98 [0.6..0.83]; theme "engraving only" beat
 *   J 0.98..1.26 [0.83..1.19]; phrases grow J 1.3..2.02 [1.3..2.17]
 * - speakers stage hold (rug unobstructed) J 2.0..2.4 [2.03..2.25]; card strip
 *   along the lower edge J 2.4..3.15 (keep the rug in y 0.30..0.58)
 * - schedule J 3.16..3.84: timeline covers the left 40%
 */

/** Rug, held during the speakers stage moment: low, rug lower-centre-right, beam rising right of the heading. */
const RUG_HOLD = { pos: [3.25, 0.95, 4.6] as V3, target: [-1.35, 0.3, -0.7] as V3 };
/** Rug while the card strip runs along the lower edge: higher, looking down, rug in the upper-middle band. */
const RUG_CARDS = { pos: [3.0, 2.35, 4.9] as V3, target: [-1.0, -1.0, -0.75] as V3 };

const HERO_LOOK = { fov: 30, exposure: 1.05, drift: 0.012, parallax: 0.022, cone: 0.18, spot: 0.45, key: 1.15, rim: 1.5, rimAng: 0.45, haze: 1, vignette: 0.6, bloom: 1 };

export const DESKTOP_SHOTS: Shot[] = [
  { at: 0, ...heroDesk, ...HERO_LOOK },
  { at: 0.55, ...heroDesk, ...HERO_LOOK },
  {
    // Push-in: barrel on the right, mic axis rolled near vertical so the grille sits high right, not behind the heading.
    at: 0.8,
    ...barrel(PHI_HERO - 0.05, 0.075, 0.13, 0.0, 0.012),
    up: tuple(MIC_AXIS),
    space: 'mic',
    fov: 28,
    exposure: 1.05,
    dof: 0.45,
    drift: 0.004,
    parallax: 0.006,
    cone: 0.05,
    spot: 0.15,
    key: 0.7,
    keyCam: 0.7,
    keyDir: [1.1, 1.8, 0.4],
    rim: 0.7,
    rimAng: 1.0,
    haze: 0.3,
    motes: 0.5,
    vignette: 0.75,
    focus: [0.68, 0.5],
    envRot: 0.4,
    env: 0.5,
    scrim: 0.4,
    scrimEdge: 0.85,
    bloom: 1.2,
  },
  { at: 0.98, ...barrel(PHI_HERO + 0.05, 0.088, 0.047, 0, 0.005), ...MACRO, keyDir: [1.1, 2.2, 0.3] },
  { at: 1.3, ...barrel(PHI_HERO + 0.3, 0.077, 0.045, 0, 0.005), ...MACRO, keyDir: [1.5, 2.0, 0.3] },
  { at: 1.62, ...barrel(PHI_HERO + 0.5, 0.068, 0.045, 0, 0.005), ...MACRO, keyDir: [1.8, 1.8, 0.3] },
  { at: 1.8, ...barrel(PHI_HERO + 0.62, 0.064, 0.05, 0, 0.005), ...MACRO, keyDir: [2.0, 1.6, 0.3] },
  {
    at: 1.95,
    ...pullBackLevel(PHI_HERO + 0.72, 0.62, 0.04, micPoint(0.07)),
    fov: 32,
    exposure: 0.95,
    dof: 0.3,
    drift: 0.008,
    parallax: 0.015,
    cone: 0.3,
    spot: 0.04,
    key: 0.9,
    keyCam: 0.3,
    rim: 1.2,
    rimAng: -0.5,
    haze: 0.35,
    motes: 0.2,
    vignette: 0.7,
    scrim: 0.3,
  },
  { at: 2.1, ...RUG_HOLD, fov: 33, exposure: 1, dof: 0.12, drift: 0.02, parallax: 0.04, cone: 1.3, spot: 1, key: 0.5, rim: 0.9, rimAng: -0.6, vignette: 0.62, bloom: 1.1 },
  { at: 2.3, pos: [3.1, 1.05, 4.45], target: [-1.35, 0.28, -0.7], fov: 33, exposure: 1, dof: 0.12, drift: 0.02, parallax: 0.04, cone: 1.3, spot: 1, key: 0.5, rim: 0.9, rimAng: -0.6, vignette: 0.62, bloom: 1.1 },
  { at: 2.48, ...RUG_CARDS, fov: 34, exposure: 0.95, drift: 0.025, parallax: 0.04, cone: 1.15, spot: 0.95, key: 0.5, rim: 0.8, rimAng: -0.6, vignette: 0.66 },
  { at: 3.05, pos: [2.4, 2.45, 5.3], target: [-1.15, -1.08, -0.7], fov: 34, exposure: 0.95, drift: 0.025, parallax: 0.04, cone: 1.15, spot: 0.95, key: 0.5, rim: 0.8, rimAng: -0.6, vignette: 0.66 },
  { at: 3.3, ...orbit(STAGE, 0.5, 0.32, 6.6, 1.3, 0.5), fov: 34, exposure: 1, drift: 0.03, parallax: 0.05, cone: 1.1, key: 0.5, rim: 0.8, vignette: 0.6 },
  { at: 3.6, ...orbit(STAGE, 0.12, 0.3, 6.6, 1.3, 0.45), fov: 34, exposure: 1, drift: 0.03, parallax: 0.05, cone: 1.1, key: 0.5, rim: 0.8, vignette: 0.6 },
  { at: 3.9, ...orbit(STAGE, -0.3, 0.28, 6.6, 1.2, 0.4), fov: 34, exposure: 1, drift: 0.03, parallax: 0.05, cone: 1.1, key: 0.5, rim: 0.8, vignette: 0.6 },
  { at: 4.5, pos: [0.9, 3.3, 15.2], target: [0, 0.55, 0], fov: 30, exposure: 1, drift: 0.04, parallax: 0.08, cone: 1.25, key: 0.3, vignette: 0.6, scrimEdge: 0.7 },
  { at: 5.5, pos: [-1.4, 4.9, 18.4], target: [0, 0.4, 0], fov: 28, exposure: 0.85, drift: 0.04, parallax: 0.08, cone: 1.25, key: 0.3, vignette: 0.65, scrimEdge: 0.7 },
  { at: 6.2, pos: DARK_POS, target: DARK_TARGET, fov: 28, exposure: 0, drift: 0, parallax: 0, cone: 1, key: 0, vignette: 0.8 },
  { at: 9.5, pos: DARK_POS, target: DARK_TARGET, fov: 28, exposure: 0, drift: 0, parallax: 0, cone: 1, key: 0, vignette: 0.8 },
];

/** Portrait hero: mic large, low right, cropped by the frame edge; rim-lit silhouette with a key. */
const heroPortrait = orbit(micPoint(0.105), 0.56, -0.02, 0.5, 0.05, -0.06);

const MACRO_PORTRAIT = { ...MACRO, fov: 34, exposure: 0.85, dof: 0.6, key: 0.5, motes: 0.6, focus: [0.66, 0.45] as const, scrim: 0.35, bloom: 0.9 };

const HERO_PORTRAIT_LOOK = { fov: 34, exposure: 1.15, drift: 0.008, parallax: 0, cone: 0.06, spot: 0.15, key: 0.75, rim: 2.6, rimAng: 0.75, haze: 0.2, vignette: 0.72 };

export const PORTRAIT_SHOTS: Shot[] = [
  { at: 0, ...heroPortrait, ...HERO_PORTRAIT_LOOK },
  { at: 0.45, ...heroPortrait, ...HERO_PORTRAIT_LOOK },
  {
    at: 0.65,
    ...barrel(PHI_HERO - 0.05, 0.075, 0.2, 0.0, 0.012),
    up: tuple(MIC_AXIS),
    space: 'mic',
    fov: 32,
    exposure: 0.9,
    dof: 0.3,
    drift: 0.004,
    cone: 0.05,
    spot: 0.1,
    key: 0.7,
    keyCam: 0.7,
    keyDir: [1.1, 1.8, 0.4],
    rim: 1.2,
    rimAng: 0.9,
    haze: 0.2,
    vignette: 0.75,
    env: 0.5,
    scrim: 0.25,
  },
  { at: 0.85, ...barrel(PHI_HERO + 0.05, 0.08, 0.085, 0, 0.008), ...MACRO_PORTRAIT, keyDir: [0.6, 2.3, 0.3] },
  { at: 1.4, ...barrel(PHI_HERO + 0.35, 0.074, 0.08, 0, 0.008), ...MACRO_PORTRAIT, keyDir: [1.0, 2.2, 0.3] },
  { at: 1.75, ...barrel(PHI_HERO + 0.55, 0.068, 0.085, 0, 0.008), ...MACRO_PORTRAIT, keyDir: [1.3, 2.0, 0.3] },
  { at: 1.95, ...pullBackLevel(PHI_HERO + 0.72, 0.95, 0.04, micPoint(0.07)), keyCam: 0.3, fov: 36, exposure: 0.8, dof: 0.2, drift: 0.008, cone: 0.3, spot: 0.04, key: 0.9, rim: 1.4, rimAng: -0.5, haze: 0.3, vignette: 0.7 },
  { at: 2.1, pos: [8.6, 3.0, 3.6], target: [0.15, 0.0, -0.1], fov: 40, exposure: 0.9, drift: 0.02, cone: 1.2, spot: 0.95, key: 0.5, rim: 1, rimAng: -0.6, vignette: 0.62 },
  { at: 2.3, pos: [8.4, 3.1, 3.4], target: [0.15, 0.0, -0.1], fov: 40, exposure: 0.9, drift: 0.02, cone: 1.2, spot: 0.95, key: 0.5, rim: 1, rimAng: -0.6, vignette: 0.62 },
  { at: 2.6, pos: [8.0, 3.8, 3.8], target: [0.1, -0.2, -0.1], fov: 40, exposure: 0.75, drift: 0.03, cone: 1.1, spot: 0.8, key: 0.5, rim: 0.8, vignette: 0.66 },
  { at: 3.2, ...orbit(STAGE, 0.55, 0.32, 7.4), fov: 40, exposure: 0.8, drift: 0.03, cone: 1.1, key: 0.5, vignette: 0.6 },
  { at: 3.9, ...orbit(STAGE, -0.3, 0.3, 7.4), fov: 40, exposure: 0.8, drift: 0.03, cone: 1.1, key: 0.5, vignette: 0.6 },
  { at: 4.5, pos: [0.4, 2.6, 15.5], target: [0, 0.6, 0], fov: 40, exposure: 0.8, drift: 0.04, cone: 1.2, key: 0.3, vignette: 0.6, scrimEdge: 0.6 },
  { at: 5.5, pos: [-0.8, 4.4, 19], target: [0, 0.3, 0], fov: 38, exposure: 0.7, drift: 0.04, cone: 1.2, key: 0.3, vignette: 0.65 },
  { at: 6.2, pos: DARK_POS, target: DARK_TARGET, fov: 38, exposure: 0, cone: 1, key: 0, vignette: 0.8 },
  { at: 9.5, pos: DARK_POS, target: DARK_TARGET, fov: 38, exposure: 0, cone: 1, key: 0, vignette: 0.8 },
];

/** Calm, dim hero-like framing for routes without the home sections. */
export const AWAY_SHOT: Shot = {
  at: 0,
  ...orbit(MIC_MID, 0.62, 0.0, 0.7, 0.2, 0.02),
  fov: 30,
  exposure: 0.5,
  drift: 0.02,
  parallax: 0.025,
  cone: 0.15,
  spot: 0.4,
  key: 0.8,
  rim: 1.2,
  haze: 0.6,
  vignette: 0.7,
};
export const AWAY_SHOT_PORTRAIT: Shot = {
  ...AWAY_SHOT,
  ...orbit(micPoint(0.08), 0.6, 0.04, 1.2, 0.04, -0.15),
  fov: 36,
  exposure: 0.4,
};

/** Journey position at or beyond which the scene is fully dark. */
export const DARK_FROM = 6.2;

/* ------------------------------------------------------------------------- */
/* Resolution and sampling                                                   */
/* ------------------------------------------------------------------------- */

const WORLD_UP = new Vector3(0, 1, 0);

export function resolveShot(s: Shot): ResolvedShot {
  const mic = s.space === 'mic';
  const pos = new Vector3(...s.pos);
  const target = new Vector3(...s.target);
  if (mic) {
    micToWorld(pos, pos);
    micToWorld(target, target);
  }
  const up = s.up ? new Vector3(...s.up).normalize() : mic ? MIC_AXIS.clone() : WORLD_UP.clone();
  const off = pos.clone().sub(target);
  return {
    at: s.at,
    pos,
    target,
    dir: off.clone().normalize(),
    logDist: Math.log(Math.max(1e-4, off.length())),
    up,
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
    keyCam: s.keyCam ?? (s.space === 'mic' ? 1 : 0),
    vignette: s.vignette ?? 0.6,
    rim: s.rim ?? 1,
    rimAng: s.rimAng ?? 0.5,
    haze: s.haze ?? 0,
    motes: s.motes ?? 0,
    keyDir: new Vector3(...(s.keyDir ?? [-0.18, 0.9, 0])),
    focusX: s.focus?.[0] ?? 0.5,
    focusY: s.focus?.[1] ?? 0.5,
    scrim: s.scrim ?? 0,
    scrimEdge: s.scrimEdge ?? 0,
    bloom: s.bloom ?? 1,
    env: s.env ?? 1,
  };
}

export const resolveShots = (shots: Shot[]) => shots.map(resolveShot);

/**
 * Centripetal Catmull-Rom (Barry-Goldman). Unlike the uniform form it never
 * overshoots or loops when neighbouring shots are very different distances
 * apart (a 4 cm macro move next to a 6 m crane move).
 */
const cr = {
  q0: new Vector3(),
  q3: new Vector3(),
  a1: new Vector3(),
  a2: new Vector3(),
  a3: new Vector3(),
  b1: new Vector3(),
  b2: new Vector3(),
};
function lerpKnots(a: Vector3, b: Vector3, ta: number, tb: number, u: number, out: Vector3) {
  const d = tb - ta;
  return out.copy(a).multiplyScalar((tb - u) / d).addScaledVector(b, (u - ta) / d);
}
function centripetal(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number, out: Vector3) {
  const d12 = p1.distanceTo(p2);
  if (d12 < 1e-7) return out.copy(p1);
  // A repeated end point (first / last shot, or a hold) continues the segment in a straight line.
  const q0 = p0.distanceTo(p1) < 1e-7 ? cr.q0.copy(p1).multiplyScalar(2).sub(p2) : cr.q0.copy(p0);
  const q3 = p3.distanceTo(p2) < 1e-7 ? cr.q3.copy(p2).multiplyScalar(2).sub(p1) : cr.q3.copy(p3);
  const t1 = Math.sqrt(q0.distanceTo(p1));
  const t2 = t1 + Math.sqrt(d12);
  const t3 = t2 + Math.sqrt(q3.distanceTo(p2));
  const u = t1 + (t2 - t1) * t;
  const A1 = lerpKnots(q0, p1, 0, t1, u, cr.a1);
  const A2 = lerpKnots(p1, p2, t1, t2, u, cr.a2);
  const A3 = lerpKnots(p2, q3, t2, t3, u, cr.a3);
  const B1 = lerpKnots(A1, A2, 0, t2, u, cr.b1);
  const B2 = lerpKnots(A2, A3, t1, t3, u, cr.b2);
  return lerpKnots(B1, B2, t1, t2, u, out);
}

const scalarKeys = [
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
  'bloom',
  'env',
] as const;

/** Sample the path at journey position J into `out` (mutated). */
export function sampleShots(shots: ResolvedShot[], J: number, out: ResolvedShot): ResolvedShot {
  const n = shots.length;
  if (n === 1 || J <= shots[0].at) return copyShot(shots[0], out);
  if (J >= shots[n - 1].at) return copyShot(shots[n - 1], out);
  let i = 0;
  while (i < n - 2 && J >= shots[i + 1].at) i++;
  const a = shots[i];
  const b = shots[i + 1];
  const raw = (J - a.at) / (b.at - a.at);
  const smooth = raw * raw * (3 - 2 * raw);
  const t = raw + (smooth - raw) * 0.7;
  const p0 = shots[Math.max(0, i - 1)];
  const p3 = shots[Math.min(n - 1, i + 2)];
  centripetal(p0.target, a.target, b.target, p3.target, t, out.target);
  // Offset: direction lerped on the sphere, distance in log space; the camera never crosses its target.
  out.dir.copy(a.dir).lerp(b.dir, t).normalize();
  out.logDist = a.logDist + (b.logDist - a.logDist) * t;
  out.pos.copy(out.target).addScaledVector(out.dir, Math.exp(out.logDist));
  out.up.copy(a.up).lerp(b.up, t).normalize();
  out.keyDir.copy(a.keyDir).lerp(b.keyDir, t);
  for (const k of scalarKeys) out[k] = a[k] + (b[k] - a[k]) * t;
  out.at = J;
  return out;
}

function copyShot(s: ResolvedShot, out: ResolvedShot) {
  out.pos.copy(s.pos);
  out.target.copy(s.target);
  out.dir.copy(s.dir);
  out.logDist = s.logDist;
  out.up.copy(s.up);
  out.keyDir.copy(s.keyDir);
  for (const k of scalarKeys) out[k] = s[k];
  out.at = s.at;
  return out;
}

export function emptyShot(): ResolvedShot {
  return resolveShot({ at: 0, pos: [0, 0, 1], target: [0, 0, 0], fov: 30, exposure: 1 });
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
