/**
 * The overhead spot strikes like a theatre lamp.
 *
 * Over the pull out the spot's level is authored by scroll (choreography.ts,
 * the pull looks). Until the stage arrives the lamp burns at STRIKE.pre of
 * that level (a glow in the haze while the microphone is on its own, so the
 * stage is never dark). When the camera has drawn back far enough for the
 * stage to appear (STRIKE.at on the smoothed journey), the lamp "strikes": it
 * comes up to full with one soft overshoot of the spot, the shaft, the haze it
 * catches and the bloom, then settles onto the authored level, on the clock
 * (about a second), so it feels like hardware rather than a scroll curve.
 *
 * Photosensitivity: a single rise and settle, never repeated faster than
 * STRIKE.refractory (a strike at most every few seconds, far under three
 * flashes a second); no flicker; the overshoot is a fraction of the authored
 * level (the beam is a small, soft part of the frame).
 *
 * Re-arms only once the camera is back before STRIKE.rearm (scrolling back up
 * past the reveal), so it plays again on the next way down. A page that opens
 * past the reveal starts struck (no strike on load).
 */
export const STRIKE = {
  /** Smoothed journey position where the lamp strikes (the stage arrives in the pull out). */
  at: 2.3,
  /** Back before this to re-arm. */
  rearm: 2.1,
  /** The lamp's level before the strike, as a fraction of the authored level. */
  pre: 0.6,
  /** Rise time constant and settle time constant (seconds); the dim back to `pre` once re-armed. */
  rise: 0.07,
  dim: 0.6,
  settle: 0.45,
  /** Shortest time between two strikes (seconds). */
  refractory: 3,
  /** Overshoot at the peak, as a fraction of the authored level, per channel. */
  spot: 0.7,
  cone: 0.9,
  bloom: 0.45,
  /** Haze caught by the beam at the peak (added). */
  haze: 0.22,
};

/** Peak of the unit envelope (1 - e^(-t/rise)) e^(-t/settle), for normalising. */
const PEAK = (() => {
  const tp = STRIKE.rise * Math.log(1 + STRIKE.settle / STRIKE.rise);
  return (1 - Math.exp(-tp / STRIKE.rise)) * Math.exp(-tp / STRIKE.settle);
})();

export function createStrike() {
  return { armed: false, started: false, t0: -1e9, last: -1e9, on: 1, env: 0 };
}
export type Strike = ReturnType<typeof createStrike>;

/**
 * Advance the strike for the smoothed journey position `J` at clock `t` and step `dt` (s). Leaves the
 * lamp's level (fraction of the authored one) in `st.on` and the overshoot envelope (0..1) in `st.env`.
 */
export function stepStrike(st: Strike, J: number, t: number, dt: number, holdAge?: number): Strike {
  if (holdAge !== undefined) {
    // Debug (filmstrips): the strike held at a given age in seconds (< 0: not struck yet).
    st.on = holdAge < 0 ? STRIKE.pre : Math.min(1, STRIKE.pre + (1 - STRIKE.pre) * (1 - Math.exp(-holdAge / STRIKE.rise)));
    st.env = holdAge < 0 ? 0 : ((1 - Math.exp(-holdAge / STRIKE.rise)) * Math.exp(-holdAge / STRIKE.settle)) / PEAK;
    return st;
  }
  if (!st.started) {
    // Opened past the reveal: already lit.
    st.started = true;
    st.armed = J < STRIKE.at;
    st.on = st.armed ? STRIKE.pre : 1;
  }
  if (J < STRIKE.rearm) st.armed = true;
  if (st.armed && J >= STRIKE.at) {
    st.armed = false;
    if (t - st.last >= STRIKE.refractory) {
      st.t0 = t;
      st.last = t;
    }
  }
  const target = st.armed ? STRIKE.pre : 1;
  st.on += (target - st.on) * (1 - Math.exp(-dt / (target > st.on ? STRIKE.rise : STRIKE.dim)));
  const a = t - st.t0;
  if (a < 0 || a > STRIKE.settle * 8) st.env = 0;
  else {
    // Only round the reveal: a jump down the page (a nav link) sweeps past it without a flash further on.
    const where = 1 - smoothstep(STRIKE.at + 0.35, STRIKE.at + 0.8, J);
    st.env = (((1 - Math.exp(-a / STRIKE.rise)) * Math.exp(-a / STRIKE.settle)) / PEAK) * where;
  }
  return st;
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
