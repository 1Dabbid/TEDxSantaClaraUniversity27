import { Vector3 } from 'three';
import { RIG, emptyShot, sampleShots, type ResolvedShot } from './choreography';
import { Damped, DampedVec3, SpringVec3 } from './damp';
import { clearance } from './clearance';
import type { look as lookState } from './look';

/**
 * The camera rig as a pure stepper: journey position in, camera pose and look
 * values out. Experience drives it once per frame; the debug simulator
 * (`?scene-debug=1`, see debugSim.ts) drives the same code with a fixed clock
 * to audit transitions.
 */

export type LookOut = Omit<typeof lookState, 'dark'>;

/**
 * Distance from the camera to the far corner of the near plane, for a near
 * distance, a vertical fov (degrees), a lens shift (where the optical axis
 * lands on screen, fractions from the left / top) and an aspect. The shift
 * moves the frustum off centre, so its far corner is further out on the
 * shifted side. Shared by the rig (near plane) and the debug simulator.
 */
export function nearCorner(near: number, fov: number, shiftX: number, shiftY: number, aspect: number): number {
  const ty = Math.tan((fov * Math.PI) / 360);
  const kx = 1 + 2 * Math.abs(shiftX - 0.5);
  const ky = 1 + 2 * Math.abs(shiftY - 0.5);
  return near * Math.sqrt(1 + ty * ty * (ky * ky + (kx * aspect) ** 2));
}

export function createRig() {
  return {
    sample: emptyShot(),
    /** Look target, offset direction (unit) and log distance, each critically damped. */
    pivot: new DampedVec3(),
    dir: new DampedVec3(),
    logD: new Damped(0),
    /** View direction: lightly under-damped spring towards the pivot. */
    view: new SpringVec3(),
    up: new DampedVec3(),
    prevPos: new Vector3(),
    fov: new Damped(30),
    exposure: new Damped(0),
    dof: new Damped(0),
    cone: new Damped(1),
    spot: new Damped(1),
    envRot: new Damped(0),
    key: new Damped(1),
    vig: new Damped(0.6),
    shade: new Damped(0),
    rim: new Damped(1),
    rimAng: new Damped(0.5),
    haze: new Damped(0),
    motes: new Damped(0),
    focusX: new Damped(0.5),
    focusY: new Damped(0.5),
    scrim: new Damped(0),
    scrimEdge: new Damped(0),
    band: new Damped(0),
    bloom: new Damped(1),
    env: new Damped(1),
    warm: new Damped(0),
    turn: new Damped(0),
    roll: new Damped(0),
    keyDir: new DampedVec3(),
    keyCam: new Damped(0),
    /** Screen anchor of the target (lens shift), fractions from the left / top. */
    shiftX: new Damped(0.5),
    shiftY: new Damped(0.5),
    px: new Damped(0),
    py: new Damped(0),
    J: new Damped(0),
    started: false,
    tmpA: new Vector3(),
    tmpB: new Vector3(),
    tmpC: new Vector3(),
    tmpD: new Vector3(),
  };
}
export type Rig = ReturnType<typeof createRig>;

/** Camera pose and per-frame values produced by one rig step. */
export function createRigOut() {
  return {
    /** The (smoothed) shot sample the rig is chasing. */
    s: emptyShot(),
    position: new Vector3(),
    target: new Vector3(),
    /** Camera up after roll. */
    up: new Vector3(),
    fwd: new Vector3(),
    right: new Vector3(),
    camUp: new Vector3(),
    dist: 1,
    roll: 0,
    near: 0.1,
    /** Distance from the camera to the nearest solid surface (m). */
    gap: 1,
    rimAng: 0.5,
    keyDir: new Vector3(),
    keyCam: 0,
    env: 1,
    envRot: 0,
    /** Smoothed journey coordinate actually sampled. */
    Js: 0,
    /** Where the target sits on screen (lens shift), fractions from the left / top. */
    shiftX: 0.5,
    shiftY: 0.5,
  };
}
export type RigOut = ReturnType<typeof createRigOut>;

export type RigInput = {
  /** Journey coordinate (< 0: away from home). */
  J: number;
  dt: number;
  /** Clock (seconds) for drift and breathing. */
  t: number;
  pointerX: number;
  pointerY: number;
  /** Jump straight to the shot (debug snapshots). */
  snap: boolean;
  /** Optional camera override [px,py,pz,tx,ty,tz] (debug). */
  camOverride?: number[] | null;
  /** Viewport width / height (near-plane corner distance). */
  aspect?: number;
};

/** Near plane for a focus distance: tight in macro, generous on wide shots. */
export const nearFor = (dist: number) => Math.min(0.2, Math.max(0.002, dist * 0.12));

export function stepRig(
  rig: Rig,
  shots: ResolvedShot[],
  away: ResolvedShot,
  input: RigInput,
  look: LookOut,
  out: RigOut,
): RigOut {
  const { J, dt, t, snap } = input;
  if (snap) rig.J.snap(Math.max(0, J));
  const s = J < 0 ? away : sampleShots(shots, rig.J.step(J, RIG.journeySmooth, dt), rig.sample);
  if (J < 0) rig.J.snap(0);
  out.Js = rig.J.value;
  const co = input.camOverride;
  if (co && co.length === 6) {
    s.pos.set(co[0], co[1], co[2]);
    s.target.set(co[3], co[4], co[5]);
    s.up.set(0, 1, 0);
  }

  // Position: critically damped. Look-at: under-damped (overshoot + settle).
  const st = RIG.follow;
  if (!rig.started || snap) {
    const first = !rig.started;
    rig.started = true;
    rig.pivot.snap(s.target);
    rig.dir.snap(s.dir);
    rig.logD.snap(s.logDist);
    rig.view.snap(rig.tmpD.copy(s.dir).negate());
    rig.up.snap(s.up);
    rig.prevPos.copy(s.pos);
    rig.fov.snap(s.fov);
    rig.dof.snap(s.dof);
    rig.cone.snap(s.cone);
    rig.spot.snap(s.spot);
    rig.key.snap(s.key);
    rig.vig.snap(s.vignette);
    rig.rim.snap(s.rim);
    rig.rimAng.snap(s.rimAng);
    rig.haze.snap(s.haze);
    rig.motes.snap(s.motes);
    rig.focusX.snap(s.focusX);
    rig.focusY.snap(s.focusY);
    rig.scrim.snap(s.scrim);
    rig.scrimEdge.snap(s.scrimEdge);
    rig.band.snap(s.band);
    rig.bloom.snap(s.bloom);
    rig.env.snap(s.env);
    rig.warm.snap(s.warm);
    rig.turn.snap(s.turn);
    rig.envRot.snap(s.envRot);
    rig.keyDir.snap(s.keyDir);
    rig.keyCam.snap(s.keyCam);
    rig.shade.snap(s.shade);
    rig.shiftX.snap(s.shiftX);
    rig.shiftY.snap(s.shiftY);
    if (snap) rig.exposure.snap(s.exposure);
    else if (first) rig.exposure.snap(0);
  }
  const pivot = rig.pivot.step(s.target, RIG.targetFollow, dt, rig.tmpB);
  const dir = rig.dir.step(s.dir, st, dt, rig.tmpA).normalize();
  // Keep the damped components on the unit sphere so the next step starts from there.
  rig.dir.x.value = dir.x;
  rig.dir.y.value = dir.y;
  rig.dir.z.value = dir.z;
  const dist = Math.exp(rig.logD.step(s.logDist, st, dt));
  const pos = rig.tmpC.copy(pivot).addScaledVector(dir, dist);
  const view = rig.view.step(rig.tmpD.copy(dir).negate(), RIG.targetFreq, RIG.targetZeta, dt, rig.tmpD).normalize();
  const target = rig.tmpB.copy(pos).addScaledVector(view, dist);
  const up = rig.up.step(s.up, st, dt, out.up).normalize();
  look.fov = rig.fov.step(s.fov, st, dt);
  look.exposure = Math.max(0, rig.exposure.step(s.exposure, t < 1.5 ? 0.9 : 0.5, dt));
  look.dof = rig.dof.step(s.dof, 0.5, dt);
  look.cone = Math.max(0, rig.cone.step(s.cone, 0.6, dt));
  look.spot = Math.max(0, rig.spot.step(s.spot, 0.6, dt));
  look.key = rig.key.step(s.key, 0.6, dt);
  look.vignette = rig.vig.step(s.vignette, 0.6, dt);
  look.shade = rig.shade.step(s.shade, 0.6, dt);
  look.rim = Math.max(0, rig.rim.step(s.rim, 0.6, dt));
  look.haze = Math.max(0, rig.haze.step(s.haze, 0.6, dt));
  look.motes = Math.max(0, rig.motes.step(s.motes, 0.6, dt));
  look.focusX = rig.focusX.step(s.focusX, 0.6, dt);
  look.focusY = rig.focusY.step(s.focusY, 0.6, dt);
  look.scrim = Math.max(0, rig.scrim.step(s.scrim, 0.6, dt));
  look.scrimEdge = Math.max(0, rig.scrimEdge.step(s.scrimEdge, 0.6, dt));
  look.band = Math.max(0, rig.band.step(s.band, 0.6, dt));
  look.bloom = rig.bloom.step(s.bloom, 0.6, dt);
  look.warm = rig.warm.step(s.warm, 0.8, dt);
  look.turn = rig.turn.step(s.turn, 0.5, dt);
  out.rimAng = rig.rimAng.step(s.rimAng, 0.6, dt);
  rig.keyDir.step(s.keyDir, 0.8, dt, out.keyDir);
  out.keyCam = rig.keyCam.step(s.keyCam, 0.6, dt);
  out.env = Math.max(0, rig.env.step(s.env, 0.6, dt));
  out.envRot = rig.envRot.step(s.envRot, 0.8, dt);
  out.shiftX = rig.shiftX.step(s.shiftX, RIG.anchorFollow, dt);
  out.shiftY = rig.shiftY.step(s.shiftY, RIG.anchorFollow, dt);

  // Camera basis, idle drift (slow breathing), pointer parallax with weight, bank into lateral moves.
  out.fwd.copy(view);
  out.right.crossVectors(out.fwd, up).normalize();
  out.camUp.crossVectors(out.right, out.fwd).normalize();
  const vel = rig.prevPos.sub(pos).multiplyScalar(-1 / Math.max(dt, 1e-4));
  const lateral = vel.dot(out.right) / dist;
  rig.prevPos.copy(pos);
  const roll = rig.roll.step(Math.max(-RIG.rollMax, Math.min(RIG.rollMax, -lateral * RIG.rollGain)), 0.35, dt);
  const px = rig.px.step(input.pointerX, 1.1, dt);
  const py = rig.py.step(input.pointerY, 1.1, dt);
  const dx = Math.sin(t * 0.21) * 0.6 + Math.sin(t * 0.13 + 1.7) * 0.4;
  const dy = Math.sin(t * 0.17 + 0.6) * 0.6 + Math.sin(t * 0.07) * 0.4;
  const breathe = 1 + Math.sin(t * 0.31) * 0.004 * (s.drift > 0 ? 1 : 0);
  const ox = dx * s.drift + px * s.parallax;
  const oy = dy * s.drift * 0.6 + py * s.parallax * 0.6;
  out.position
    .copy(target)
    .addScaledVector(out.fwd, -dist * breathe)
    .addScaledVector(out.right, ox)
    .addScaledVector(out.camUp, oy);
  out.target.copy(target);
  // Roll the up vector about the view axis.
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  out.up.copy(out.camUp).multiplyScalar(cr).addScaledVector(out.right, sr);
  out.dist = dist;
  out.roll = roll;
  // Never let the near plane cut into a surface the camera grazes on a fast move. The lens shift
  // moves the frustum off centre: its far corner is further out on the shifted side.
  const corner = nearCorner(1, look.fov, out.shiftX, out.shiftY, input.aspect ?? 1.6);
  out.gap = clearance(out.position)[0];
  out.near = Math.max(0.0015, Math.min(nearFor(dist), (out.gap * 0.7) / corner));
  copyInto(out.s, s);
  return out;
}

function copyInto(dst: ResolvedShot, src: ResolvedShot) {
  dst.pos.copy(src.pos);
  dst.target.copy(src.target);
  dst.dir.copy(src.dir);
  dst.logDist = src.logDist;
  dst.up.copy(src.up);
  dst.keyDir.copy(src.keyDir);
  dst.at = src.at;
  dst.fov = src.fov;
  dst.exposure = src.exposure;
  dst.drift = src.drift;
  dst.parallax = src.parallax;
  dst.keyCam = src.keyCam;
  dst.cone = src.cone;
  dst.spot = src.spot;
  dst.shiftX = src.shiftX;
  dst.shiftY = src.shiftY;
}
