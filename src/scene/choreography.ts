import { Vector3 } from 'three';
import { MIC_AXIS, MIC_MATRIX_INV, barrelRadius, micToWorld } from './layout';
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
};

export type ResolvedShot = {
  at: number;
  pos: Vector3;
  target: Vector3;
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
function barrel(phi: number, y: number, dist: number, lookY = 0) {
  const r = barrelRadius(y);
  const n = [Math.sin(phi), 0, Math.cos(phi)] as const;
  const s = [n[0] * r, y, n[2] * r] as const;
  return {
    space: 'mic' as const,
    pos: [s[0] + n[0] * dist, s[1] - lookY * 0.5, s[2] + n[2] * dist] as V3,
    target: [s[0], s[1] + lookY, s[2]] as V3,
  };
}

/**
 * Mic-space retreat straight out along the barrel normal at angle phi (so the
 * camera never passes through the mic), dropping by `drop` metres, looking
 * back at the middle of the mic.
 */
function pullBack(phi: number, dist: number, drop: number) {
  const n = [Math.sin(phi), 0, Math.cos(phi)] as const;
  return {
    space: 'mic' as const,
    pos: [n[0] * dist, 0.075 + drop * 0.3, n[2] * dist] as V3,
    target: [0, 0.07, 0] as V3,
    // Roll most of the way back to world up while retreating.
    up: tuple(new Vector3(0, 1, 0).lerp(MIC_AXIS, 0.3).normalize()),
  };
}

/* ------------------------------------------------------------------------- */
/* Shots                                                                     */
/* ------------------------------------------------------------------------- */

const MIC_MID = micPoint(0.095);
const STAGE = new Vector3(0, 0.15, 0);

const heroDesk = orbit(MIC_MID, 0.5, 0.04, 0.56, 0.135, 0.012);
/** Barrel angle (mic space) that faces the hero camera, so the push-in is continuous. */
const PHI_HERO = (() => {
  const p = new Vector3(...heroDesk.pos).applyMatrix4(MIC_MATRIX_INV);
  return Math.atan2(p.x, p.z);
})();

const DARK_POS: V3 = [-2.4, 5.4, 20.5];
const DARK_TARGET: V3 = [0, 0.4, 0];

export const DESKTOP_SHOTS: Shot[] = [
  { at: 0, ...heroDesk, fov: 30, exposure: 1, drift: 0.02, parallax: 0.035, cone: 1, key: 1, vignette: 0.55 },
  { at: 0.55, ...heroDesk, fov: 30, exposure: 1, drift: 0.02, parallax: 0.035, cone: 1, key: 1, vignette: 0.55 },
  {
    at: 1.0,
    ...orbit(micPoint(0.08), 0.52, 0.02, 0.22, 0.02, 0),
    up: tuple(new Vector3(0, 1, 0).lerp(MIC_AXIS, 0.6).normalize()),
    fov: 28,
    exposure: 1.05,
    dof: 0.35,
    drift: 0.006,
    parallax: 0.008,
    cone: 0.8,
    key: 1.1,
    vignette: 0.7,
  },
  { at: 1.22, ...barrel(PHI_HERO + 0.05, 0.088, 0.047), fov: 28, exposure: 1.1, dof: 0.8, drift: 0.0015, parallax: 0.002, cone: 0.3, spot: 0.3, key: 1.3, vignette: 0.8, shade: 0.45 },
  { at: 1.5, ...barrel(PHI_HERO + 0.3, 0.077, 0.045), fov: 28, exposure: 1.1, dof: 0.85, drift: 0.0015, parallax: 0.002, cone: 0.3, spot: 0.3, key: 1.3, vignette: 0.8, shade: 0.45 },
  { at: 1.8, ...barrel(PHI_HERO + 0.58, 0.066, 0.045), fov: 28, exposure: 1.1, dof: 0.85, drift: 0.0015, parallax: 0.002, cone: 0.3, spot: 0.3, key: 1.3, vignette: 0.8, shade: 0.45 },
  {
    at: 2.05,
    ...pullBack(PHI_HERO + 0.7, 0.62, -0.18),
    fov: 32,
    exposure: 1,
    dof: 0.25,
    drift: 0.01,
    parallax: 0.02,
    cone: 0.8,
    spot: 0.8,
    key: 1,
    keyCam: 0.3,
    vignette: 0.65,
  },
  { at: 2.5, pos: [3.3, 1.05, 4.7], target: [0.15, 0.1, 0], fov: 34, exposure: 1, drift: 0.03, parallax: 0.05, cone: 1.1, key: 0.6, vignette: 0.6 },
  { at: 3.1, ...orbit(STAGE, 0.62, 0.3, 5.0), fov: 34, exposure: 1, drift: 0.03, parallax: 0.05, cone: 1.1, key: 0.5, vignette: 0.6 },
  { at: 3.5, ...orbit(STAGE, 0.18, 0.28, 5.0), fov: 34, exposure: 1, drift: 0.03, parallax: 0.05, cone: 1.1, key: 0.5, vignette: 0.6 },
  { at: 3.9, ...orbit(STAGE, -0.3, 0.26, 5.0), fov: 34, exposure: 1, drift: 0.03, parallax: 0.05, cone: 1.1, key: 0.5, vignette: 0.6 },
  { at: 4.5, pos: [0.9, 3.3, 15.2], target: [0, 0.55, 0], fov: 30, exposure: 1, drift: 0.04, parallax: 0.08, cone: 1.2, key: 0.3, vignette: 0.6 },
  { at: 5.5, pos: [-1.4, 4.9, 18.4], target: [0, 0.4, 0], fov: 28, exposure: 0.85, drift: 0.04, parallax: 0.08, cone: 1.2, key: 0.3, vignette: 0.65 },
  { at: 6.2, pos: DARK_POS, target: DARK_TARGET, fov: 28, exposure: 0, drift: 0, parallax: 0, cone: 1, key: 0, vignette: 0.8 },
  { at: 9.5, pos: DARK_POS, target: DARK_TARGET, fov: 28, exposure: 0, drift: 0, parallax: 0, cone: 1, key: 0, vignette: 0.8 },
];

const heroPortrait = orbit(micPoint(0.08), 0.5, 0.06, 1.2, 0.05, -0.13);

export const PORTRAIT_SHOTS: Shot[] = [
  { at: 0, ...heroPortrait, fov: 34, exposure: 0.72, drift: 0.02, parallax: 0, cone: 1, key: 0.9, vignette: 0.6 },
  { at: 0.55, ...heroPortrait, fov: 34, exposure: 0.72, drift: 0.02, parallax: 0, cone: 1, key: 0.9, vignette: 0.6 },
  {
    at: 1.0,
    ...orbit(micPoint(0.08), 0.52, 0.02, 0.32, 0, 0),
    up: tuple(new Vector3(0, 1, 0).lerp(MIC_AXIS, 0.6).normalize()),
    fov: 32,
    exposure: 0.85,
    dof: 0.3,
    drift: 0.006,
    cone: 0.8,
    key: 1.1,
    vignette: 0.7,
  },
  { at: 1.25, ...barrel(PHI_HERO + 0.05, 0.086, 0.04), fov: 34, exposure: 0.9, dof: 0.6, drift: 0.0015, cone: 0.3, spot: 0.3, key: 1.3, vignette: 0.8, shade: 0.45 },
  { at: 1.75, ...barrel(PHI_HERO + 0.5, 0.068, 0.038), fov: 34, exposure: 0.9, dof: 0.6, drift: 0.0015, cone: 0.3, spot: 0.3, key: 1.3, vignette: 0.8, shade: 0.45 },
  { at: 2.05, ...pullBack(PHI_HERO + 0.7, 0.95, -0.25), keyCam: 0.3, fov: 36, exposure: 0.8, dof: 0.2, drift: 0.01, cone: 0.8, spot: 0.8, key: 1, vignette: 0.65 },
  { at: 2.5, pos: [3.6, 1.6, 6.6], target: [0.5, 0.0, 0], fov: 40, exposure: 0.8, drift: 0.03, cone: 1.1, key: 0.6, vignette: 0.6 },
  { at: 3.1, ...orbit(STAGE, 0.55, 0.32, 6.6), fov: 40, exposure: 0.8, drift: 0.03, cone: 1.1, key: 0.5, vignette: 0.6 },
  { at: 3.9, ...orbit(STAGE, -0.3, 0.3, 6.6), fov: 40, exposure: 0.8, drift: 0.03, cone: 1.1, key: 0.5, vignette: 0.6 },
  { at: 4.5, pos: [0.4, 2.6, 15.5], target: [0, 0.6, 0], fov: 40, exposure: 0.8, drift: 0.04, cone: 1.2, key: 0.3, vignette: 0.6 },
  { at: 5.5, pos: [-0.8, 4.4, 19], target: [0, 0.3, 0], fov: 38, exposure: 0.7, drift: 0.04, cone: 1.2, key: 0.3, vignette: 0.65 },
  { at: 6.2, pos: DARK_POS, target: DARK_TARGET, fov: 38, exposure: 0, cone: 1, key: 0, vignette: 0.8 },
  { at: 9.5, pos: DARK_POS, target: DARK_TARGET, fov: 38, exposure: 0, cone: 1, key: 0, vignette: 0.8 },
];

/** Calm, dim hero-like framing for routes without the home sections. */
export const AWAY_SHOT: Shot = {
  at: 0,
  ...orbit(MIC_MID, 0.62, 0.08, 0.9, 0.235, 0.03),
  fov: 30,
  exposure: 0.5,
  drift: 0.025,
  parallax: 0.03,
  cone: 0.8,
  key: 0.8,
  vignette: 0.7,
};
export const AWAY_SHOT_PORTRAIT: Shot = {
  ...AWAY_SHOT,
  ...orbit(micPoint(0.08), 0.6, 0.08, 1.5, 0.04, -0.15),
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
  return {
    at: s.at,
    pos,
    target,
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
  };
}

export const resolveShots = (shots: Shot[]) => shots.map(resolveShot);

function catmull(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number, out: Vector3) {
  const t2 = t * t;
  const t3 = t2 * t;
  out.set(0, 0, 0)
    .addScaledVector(p0, -0.5 * t3 + t2 - 0.5 * t)
    .addScaledVector(p1, 1.5 * t3 - 2.5 * t2 + 1)
    .addScaledVector(p2, -1.5 * t3 + 2 * t2 + 0.5 * t)
    .addScaledVector(p3, 0.5 * t3 - 0.5 * t2);
  return out;
}

const scalarKeys = ['fov', 'exposure', 'dof', 'drift', 'parallax', 'cone', 'spot', 'envRot', 'shade', 'key', 'keyCam', 'vignette'] as const;

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
  catmull(p0.pos, a.pos, b.pos, p3.pos, t, out.pos);
  catmull(p0.target, a.target, b.target, p3.target, t, out.target);
  out.up.copy(a.up).lerp(b.up, t).normalize();
  for (const k of scalarKeys) out[k] = a[k] + (b[k] - a[k]) * t;
  out.at = J;
  return out;
}

function copyShot(s: ResolvedShot, out: ResolvedShot) {
  out.pos.copy(s.pos);
  out.target.copy(s.target);
  out.up.copy(s.up);
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
