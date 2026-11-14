/**
 * Device tilt as a pointer substitute on phones and tablets.
 *
 * Listens to `deviceorientation` and turns the tilt of the device, relative to
 * the way it is being held, into a -1..1 pair with the same convention as
 * scrollState.pointer (x: right, y: up). The resting angle adapts slowly, so
 * however the visitor holds the phone the scene settles back to centre and only
 * the small movements of the hand move the camera.
 *
 * Never asks for anything: where orientation needs a permission (iOS 13+, which
 * only grants it from a system prompt), no events arrive, `active` stays false
 * and the scene falls back to a slow automatic sway (rig.ts). Nothing on the
 * page prompts, blocks or nags for it.
 *
 * Only the scene uses it, and the scene only exists when motion is allowed (no
 * canvas under reduced motion, the Reduce motion switch or the static tier), so
 * unmounting the scene removes the listener.
 */

/** `weight` (0..1) is how far the tilt can be trusted: it fades out as the device nears upright. */
export type Tilt = { x: number; y: number; weight: number; active: boolean; lastAt: number };

export const createTilt = (): Tilt => ({ x: 0, y: 0, weight: 0, active: false, lastAt: 0 });

/** Degrees of tilt (away from the resting angle) for a full -1..1 swing. */
const RANGE_DEG = 18;
/** Time constant (s) of the resting angle following the way the device is held. */
const REST_TAU = 3.5;
/** No event for this long (ms): the tilt is no longer live. */
const STALE_MS = 1500;
/**
 * A jump larger than this (deg) between two events is not the hand: near upright (beta near 90)
 * gamma is unstable and can flip sign. The resting angle takes the jump, so the output carries on.
 */
const JUMP_DEG = 25;
/** The tilt fades out as |beta| goes from the first to the second angle (deg): Euler angles degenerate there. */
const UPRIGHT_FADE: [number, number] = [62, 82];

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** Starts listening; returns the cleanup. Writes into `tilt` on every event. */
export function watchTilt(tilt: Tilt): () => void {
  if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') return () => {};
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};
  let restA = NaN;
  let restB = NaN;
  let prevA = NaN;
  let prevB = NaN;
  let prevAt = 0;
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null || !Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    // Map to the screen's axes: a = left/right tilt as seen on screen, b = towards/away.
    const angle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) | 0;
    let a = e.gamma;
    let b = e.beta;
    if (angle === 90) [a, b] = [e.beta, -e.gamma];
    else if (angle === 270 || angle === -90) [a, b] = [-e.beta, e.gamma];
    else if (angle === 180) [a, b] = [-e.gamma, -e.beta];
    const now = performance.now();
    const dt = prevAt ? Math.min(0.5, (now - prevAt) / 1000) : 0;
    prevAt = now;
    if (!Number.isFinite(restA) || now - tilt.lastAt > STALE_MS) {
      restA = a;
      restB = b;
    } else {
      // A flip (gamma near upright, or a wrap past 180) moves the reference with it: no lurch.
      if (Math.abs(a - prevA) > JUMP_DEG) restA += a - prevA;
      if (Math.abs(b - prevB) > JUMP_DEG) restB += b - prevB;
      const k = 1 - Math.exp(-dt / REST_TAU);
      restA += (a - restA) * k;
      restB += (b - restB) * k;
    }
    prevA = a;
    prevB = b;
    // Near upright the angles stop meaning anything: the weight fades out and the scene hands over
    // to the automatic sway (Experience blends them).
    const ab = Math.abs(e.beta);
    const u = Math.min(1, Math.max(0, (ab - UPRIGHT_FADE[0]) / (UPRIGHT_FADE[1] - UPRIGHT_FADE[0])));
    tilt.weight = 1 - u * u * (3 - 2 * u);
    tilt.x = clamp1((a - restA) / RANGE_DEG);
    // Tipping the top of the phone away (beta down) looks up, like raising a window.
    tilt.y = clamp1((restB - b) / RANGE_DEG);
    tilt.lastAt = now;
    tilt.active = true;
  };
  window.addEventListener('deviceorientation', onOrient, { passive: true });
  return () => {
    window.removeEventListener('deviceorientation', onOrient);
    tilt.active = false;
    tilt.weight = 0;
    tilt.x = 0;
    tilt.y = 0;
  };
}

/** True while orientation events are arriving. */
export const tiltLive = (tilt: Tilt, now = performance.now()) => tilt.active && now - tilt.lastAt < STALE_MS;
