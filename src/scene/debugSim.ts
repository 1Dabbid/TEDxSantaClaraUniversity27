import { Vector3 } from 'three';
import { SPINE, journey, micPoint, type ResolvedShot } from './choreography';
import { clearance } from './clearance';
import { createRig, createRigOut, stepRig, type LookOut } from './rig';
import { SECTION_IDS, type SectionId } from './scrollState';

/**
 * Debug-only transition simulator (loaded on demand with `?scene-debug=1`).
 * Exposes `window.__sceneSim`: steps the real camera rig with a fixed clock
 * over a list of scroll positions (or journey values), off screen and without
 * touching the live camera, and reports the pose, look values and the
 * clearance between the near plane and the scene geometry for every step.
 * `metrics()` sweeps the whole journey and reports how well the camera keeps
 * to the one axis (choreography.ts): heading change, lateral deviation from
 * the track, how far the subject drifts from its screen anchor, and whether
 * the distance to the subject only ever grows from the macro to the end.
 */

type Layout = { tops: Partial<Record<SectionId, number>>; heights: Partial<Record<SectionId, number>>; vh: number; docH: number };

function measure(): Layout {
  const tops: Layout['tops'] = {};
  const heights: Layout['heights'] = {};
  for (const id of SECTION_IDS) {
    const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    tops[id] = r.top + window.scrollY;
    heights[id] = r.height;
  }
  return { tops, heights, vh: window.innerHeight, docH: document.documentElement.scrollHeight };
}

function journeyAt(L: Layout, y: number) {
  const sections = {} as Record<SectionId, number>;
  for (const id of SECTION_IDS) {
    const top = L.tops[id];
    const h = L.heights[id];
    sections[id] = top === undefined || !h ? 0 : Math.min(1, Math.max(0, (y + L.vh - top) / (h + L.vh)));
  }
  return journey(sections, L.heights, L.vh);
}

type Frame = {
  J: number;
  Js: number;
  pos: [number, number, number];
  tgt: [number, number, number];
  up: [number, number, number];
  roll: number;
  fov: number;
  exp: number;
  near: number;
  /** Surface distance divided by the near-plane corner distance (< 1 clips). */
  clr: number;
  obj: string;
  /** Surface distance, metres. */
  gap: number;
  /** Angle (deg) between the view and the authored view at the rail position the rig has reached. */
  dev: number;
  /** Lens shift: where the target sits on screen (fractions from the left / top). */
  shift: [number, number];
};

/** Screen position (fractions from the left / top) of world point P for a frame. */
function project(f: Frame, P: Vector3, aspect: number): [number, number, number] {
  const pos = new Vector3(...f.pos);
  const fwd = new Vector3(...f.tgt).sub(pos).normalize();
  const right = new Vector3().crossVectors(fwd, new Vector3(...f.up)).normalize();
  const up = new Vector3().crossVectors(right, fwd);
  const d = P.clone().sub(pos);
  const z = d.dot(fwd);
  const ty = Math.tan((f.fov * Math.PI) / 360);
  return [f.shift[0] + d.dot(right) / (z * ty * aspect) / 2, f.shift[1] - d.dot(up) / (z * ty) / 2, z];
}

const r3 = (v: Vector3): [number, number, number] => [+v.x.toFixed(8), +v.y.toFixed(8), +v.z.toFixed(8)];

export function installSim(getShots: () => { shots: ResolvedShot[]; away: ResolvedShot }) {
  const api = {
    layout: measure,
    journeyAt: (y: number) => journeyAt(measure(), y),
    /**
     * Steps the rig at a fixed dt over `ys` (scroll px per step) or `js`
     * (journey values per step). The first value is snapped to.
     */
    run(opts: { ys?: number[]; js?: number[]; dt?: number; t0?: number; drift?: boolean }): Frame[] {
      const L = measure();
      const { shots, away } = getShots();
      const dt = opts.dt ?? 1 / 60;
      const seq = opts.js ?? (opts.ys ?? []).map((y) => journeyAt(L, y));
      const rig = createRig();
      const out = createRigOut();
      const look = {} as LookOut;
      const aspect = window.innerWidth / Math.max(1, window.innerHeight);
      const frames: Frame[] = [];
      let t = opts.t0 ?? 10;
      seq.forEach((J, i) => {
        stepRig(rig, shots, away, { J, dt, t: opts.drift === false ? 10 : t, pointerX: 0, pointerY: 0, snap: i === 0, aspect }, look, out);
        t += dt;
        const ty = Math.tan((look.fov * Math.PI) / 360);
        const corner = out.near * Math.sqrt(1 + ty * ty * (1 + aspect * aspect));
        const [gap, obj] = clearance(out.position);
        frames.push({
          J: +J.toFixed(5),
          Js: +out.Js.toFixed(5),
          pos: r3(out.position),
          tgt: r3(out.target),
          up: r3(out.up),
          roll: +out.roll.toFixed(6),
          fov: +look.fov.toFixed(4),
          exp: +look.exposure.toFixed(4),
          near: +out.near.toFixed(5),
          clr: +(gap / corner).toFixed(3),
          obj,
          gap: +gap.toFixed(4),
          dev: +((Math.acos(Math.min(1, -out.fwd.dot(out.s.dir))) * 180) / Math.PI).toFixed(3),
          shift: [+out.shiftX.toFixed(5), +out.shiftY.toFixed(5)],
        });
      });
      return frames;
    },
  };
  const metrics = (opts: { from?: number; to?: number; outFrom?: number; step?: number } = {}) => {
    const from = opts.from ?? 2.0; // start of Speakers
    const to = opts.to ?? 6.0; // end of Tickets
    const outFrom = opts.outFrom ?? 1.8; // the macro's last shot: the pull back starts here
    const step = opts.step ?? 0.001;
    const js: number[] = [];
    for (let J = 0; J <= to + 1e-9; J += step) js.push(+J.toFixed(5));
    const F = api.run({ js, drift: false });
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const yaw = (f: Frame) => Math.atan2(f.tgt[0] - f.pos[0], f.tgt[2] - f.pos[2]);
    const sp = F.filter((f) => f.J >= from && f.J <= to);
    const y0 = yaw(sp[0]);
    const dy = sp.map((f) => {
      let d = yaw(f) - y0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return (d * 180) / Math.PI;
    });
    // Lateral deviation: horizontal distance of the camera from the vertical plane of the track
    // (through the camera at the start of the pull back, along the mean heading to the end).
    const out = F.filter((f) => f.J >= outFrom && f.J <= to);
    const a = new Vector3(...out[0].pos);
    const b = new Vector3(...out[out.length - 1].pos);
    const ax = new Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    const perp = new Vector3(-ax.z, 0, ax.x);
    const lat = out.map((f) => Math.abs(new Vector3(...f.pos).sub(a).dot(perp)));
    // Subject anchor: the mic head (grille), the barrel middle and the stand's foot on screen.
    const head = micPoint(0.1302);
    const foot = new Vector3(SPINE.x, 0, SPINE.z);
    const drift = (P: Vector3) => {
      const q = sp.map((f) => project(f, P, aspect)).filter((v) => v[2] > 0);
      const xs = q.map((v) => v[0]);
      const ys = q.map((v) => v[1]);
      return {
        xMin: +Math.min(...xs).toFixed(4),
        xMax: +Math.max(...xs).toFixed(4),
        yMin: +Math.min(...ys).toFixed(4),
        yMax: +Math.max(...ys).toFixed(4),
        driftXPct: +((Math.max(...xs) - Math.min(...xs)) * 100).toFixed(2),
      };
    };
    // Distance from the camera to the mic head: must only grow from the macro to the end.
    let reversals = 0;
    let maxBack = 0;
    let runMax = 0;
    let dir = 0;
    let prev = -1;
    for (const f of out) {
      const d = new Vector3(...f.pos).distanceTo(head);
      if (prev >= 0) {
        const s = d - prev > 1e-6 ? 1 : d - prev < -1e-6 ? -1 : 0;
        if (s && dir && s !== dir) reversals++;
        if (s) dir = s;
        maxBack = Math.max(maxBack, runMax - d);
      }
      runMax = Math.max(runMax, d);
      prev = d;
    }
    let minClr = Infinity;
    let clrAt = '';
    for (const f of F) if (f.clr < minClr) [minClr, clrAt] = [f.clr, `${f.obj}@J${f.J}`];
    return {
      headingChangeDeg: +(Math.max(...dy) - Math.min(...dy)).toFixed(3),
      maxLateralM: +Math.max(...lat).toFixed(4),
      travelM: +a.distanceTo(b).toFixed(3),
      anchorHead: drift(head),
      anchorFoot: drift(foot),
      monotonic: { reversals, maxPushBackM: +maxBack.toFixed(5) },
      minClearance: minClr,
      minClearanceAt: clrAt,
    };
  };
  const full = { ...api, metrics };
  (window as unknown as { __sceneSim?: typeof full }).__sceneSim = full;
}
