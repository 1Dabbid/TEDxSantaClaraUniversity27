import { Vector3 } from 'three';
import { SPINE, journey, micPoint, resolveShots, shotsFor, type ResolvedShot, type ShotOptions } from './choreography';
import { clearance } from './clearance';
import { createRig, createRigOut, nearCorner, stepRig, type LookOut } from './rig';
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
  /** Camera roll about the view axis relative to a level horizon (deg), as rendered. */
  rollDeg: number;
  /** Light: overhead spot, volumetric cone and dust motes multipliers. */
  spot: number;
  cone: number;
  motes: number;
};

const WORLD_UP = new Vector3(0, 1, 0);
/** Roll (deg) of an up vector about a view direction, relative to the level horizon. */
function rollOf(fwd: Vector3, up: Vector3): number {
  const u0 = WORLD_UP.clone().addScaledVector(fwd, -WORLD_UP.dot(fwd)).normalize();
  const left = new Vector3().crossVectors(fwd, u0);
  return (Math.atan2(up.dot(left), up.dot(u0)) * 180) / Math.PI;
}

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

/** The shot list Experience would use for this viewport, with some content options overridden. */
function contentShots(L: Layout, over: Partial<ShotOptions>): ResolvedShot[] {
  const portrait = window.innerWidth / Math.max(1, window.innerHeight) < 0.9;
  const sched = L.heights.schedule;
  const base: ShotOptions = {
    speakersTba: !!document.querySelector('.speakers-runway--tba'),
    scheduleScale: sched ? Math.min(1, Math.max(0.4, sched / (1.45 * L.vh))) : 1,
  };
  return resolveShots(shotsFor(portrait, { ...base, ...over }));
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
    run(opts: { ys?: number[]; js?: number[]; dt?: number; t0?: number; drift?: boolean; content?: Partial<ShotOptions> }): Frame[] {
      const L = measure();
      const live = getShots();
      const away = live.away;
      // `content` swaps the page-content variant (e.g. { speakersTba: false }) without changing the page.
      const shots = opts.content ? contentShots(L, opts.content) : live.shots;
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
        // The same near-plane corner as the rig (lens shift included).
        const corner = nearCorner(out.near, look.fov, out.shiftX, out.shiftY, aspect);
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
          rollDeg: +rollOf(new Vector3().subVectors(out.target, out.position).normalize(), out.up).toFixed(4),
          spot: +look.spot.toFixed(4),
          cone: +look.cone.toFixed(4),
          motes: +look.motes.toFixed(4),
        });
      });
      return frames;
    },
  };
  const metrics = (opts: { from?: number; to?: number; outFrom?: number; step?: number; content?: Partial<ShotOptions> } = {}) => {
    const from = opts.from ?? 2.0; // start of Speakers
    const to = opts.to ?? 6.0; // end of Tickets
    const outFrom = opts.outFrom ?? 1.72; // the macro's last shot: the pull back starts here
    const step = opts.step ?? 0.001;
    const js: number[] = [];
    for (let J = 0; J <= to + 1e-9; J += step) js.push(+J.toFixed(5));
    const F = api.run({ js, drift: false, content: opts.content });
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
    const drift = (P: Vector3, frames = sp) => {
      // Only frames where the point is in the picture (the foot is below the frame in the first close shots).
      const q = frames
        .map((f) => [...project(f, P, aspect), f.J] as const)
        .filter((v) => v[2] > 0 && v[0] >= 0 && v[0] <= 1 && v[1] >= 0 && v[1] <= 1);
      const xs = q.map((v) => v[0]);
      const ys = q.map((v) => v[1]);
      const at = (arr: number[], v: number) => q[arr.indexOf(v)]?.[3] ?? -1;
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      return {
        xMin: +Math.min(...xs).toFixed(4),
        xMax: +Math.max(...xs).toFixed(4),
        yMin: +yMin.toFixed(4),
        yMax: +yMax.toFixed(4),
        /** Where the extremes of height happen (journey position): check those frames for a clipped subject. */
        yMinAtJ: at(ys, yMin),
        yMaxAtJ: at(ys, yMax),
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
    // Framing jump between filmstrip frames (every 2.5% of the journey from Theme to the end of
    // Tickets, J step 0.125): the largest ratio of camera-to-head distance between neighbours.
    let zoomStep = 1;
    let zoomAt = 0;
    const byJ = new Map(F.map((f) => [f.J.toFixed(3), f]));
    for (let J = 1.0; J <= to - 0.125 + 1e-9; J += 0.005) {
      const f0 = byJ.get(J.toFixed(3));
      const f1 = byJ.get((J + 0.125).toFixed(3));
      if (!f0 || !f1) continue;
      const d0 = new Vector3(...f0.pos).distanceTo(head);
      const d1 = new Vector3(...f1.pos).distanceTo(head);
      const r = Math.max(d0, d1) / Math.max(1e-6, Math.min(d0, d1));
      if (r > zoomStep) [zoomStep, zoomAt] = [r, J];
    }
    // Roll about the view axis across the pull back (the macro stands the barrel upright; the
    // pull back must unwind that slowly, or the subject spins while it recedes).
    const pull = F.filter((f) => f.J >= outFrom && f.J <= from + 0.3);
    const rolls = pull.map((f) => f.rollDeg);
    let rollStep = 0;
    let rollStepAt = 0;
    for (let J = outFrom; J <= from + 0.3 - 0.125 + 1e-9; J += 0.005) {
      const f0 = byJ.get(J.toFixed(3));
      const f1 = byJ.get((J + 0.125).toFixed(3));
      if (!f0 || !f1) continue;
      const r = Math.abs(f1.rollDeg - f0.rollDeg);
      if (r > rollStep) [rollStep, rollStepAt] = [r, J];
    }
    // Light between filmstrip frames around the light-up (J 1.9..2.7): the largest change of the
    // overhead spot and of the volumetric cone over one filmstrip step (J 0.125).
    let spotStep = 0;
    let spotAt = 0;
    let coneStep = 0;
    let coneAt = 0;
    for (let J = 1.9; J <= 2.7 - 0.125 + 1e-9; J += 0.005) {
      const f0 = byJ.get(J.toFixed(3));
      const f1 = byJ.get((J + 0.125).toFixed(3));
      if (!f0 || !f1) continue;
      if (Math.abs(f1.spot - f0.spot) > spotStep) [spotStep, spotAt] = [Math.abs(f1.spot - f0.spot), J];
      if (Math.abs(f1.cone - f0.cone) > coneStep) [coneStep, coneAt] = [Math.abs(f1.cone - f0.cone), J];
    }
    let minClr = Infinity;
    let clrAt = '';
    for (const f of F) if (f.clr < minClr) [minClr, clrAt] = [f.clr, `${f.obj}@J${f.J}`];
    // Real scrolling at a steady speed (px/s) from the start of Theme to the end of Tickets, then a
    // hold: the fastest turn of the view direction (deg/s) and the tightest near-plane clearance.
    const L = measure();
    const yAt = (J: number) => {
      const k = Math.min(SECTION_IDS.length - 1, Math.floor(J));
      const id = SECTION_IDS[k];
      return (L.tops[id] ?? 0) + (J - k) * (L.heights[id] ?? 0) - L.vh / 2;
    };
    const scroll: Record<
      string,
      { maxAngVelDegS: number; atJ: number; maxRollRateDegS: number; rollAtJ: number; minClearance: number; clrObj: string }
    > = {};
    for (const speed of [1500, 4000]) {
      const y0 = yAt(1.0);
      const y1 = yAt(5.9999);
      const n = Math.max(2, Math.ceil(((y1 - y0) / speed) * 60));
      const ys: number[] = [];
      for (let i = 0; i <= n; i++) ys.push(y0 + ((y1 - y0) * i) / n);
      for (let i = 0; i < 120; i++) ys.push(y1);
      const R = api.run({ ys, drift: false, content: opts.content });
      let maxW = 0;
      let at = 0;
      let mc = Infinity;
      let mo = '';
      let maxR = 0;
      let rAt = 0;
      for (let i = 1; i < R.length; i++) {
        const rr = Math.abs(R[i].rollDeg - R[i - 1].rollDeg) * 60;
        if (rr > maxR) [maxR, rAt] = [rr, R[i].Js];
        const a = new Vector3(...R[i - 1].tgt).sub(new Vector3(...R[i - 1].pos)).normalize();
        const c = new Vector3(...R[i].tgt).sub(new Vector3(...R[i].pos)).normalize();
        const w = ((Math.acos(Math.min(1, a.dot(c))) * 180) / Math.PI) * 60;
        if (w > maxW) [maxW, at] = [w, R[i].J];
        if (R[i].clr < mc) [mc, mo] = [R[i].clr, R[i].obj];
      }
      scroll[speed] = {
        maxAngVelDegS: +maxW.toFixed(1),
        atJ: at,
        maxRollRateDegS: +maxR.toFixed(1),
        rollAtJ: rAt,
        minClearance: mc,
        clrObj: mo,
      };
    }
    return {
      headingChangeDeg: +(Math.max(...dy) - Math.min(...dy)).toFixed(3),
      maxLateralM: +Math.max(...lat).toFixed(4),
      travelM: +a.distanceTo(b).toFixed(3),
      anchorHead: drift(head),
      anchorFoot: drift(foot),
      /** The head across the pull back (the macro's last shot to the start of Speakers). */
      anchorHeadPullBack: drift(head, F.filter((f) => f.J >= outFrom && f.J <= from)),
      monotonic: { reversals, maxPushBackM: +maxBack.toFixed(5) },
      minClearance: minClr,
      minClearanceAt: clrAt,
      maxZoomPerFilmStep: { ratio: +zoomStep.toFixed(2), atJ: +zoomAt.toFixed(3) },
      /** Roll across the pull back: total range (deg) and the largest change over one filmstrip step. */
      rollPullBack: {
        totalDeg: +(Math.max(...rolls) - Math.min(...rolls)).toFixed(2),
        maxPerFilmStepDeg: +rollStep.toFixed(2),
        atJ: +rollStepAt.toFixed(3),
      },
      /** The light-up: largest change of spot / cone over one filmstrip step between J 1.9 and 2.7. */
      lightPerFilmStep: { spot: +spotStep.toFixed(3), spotAtJ: +spotAt.toFixed(3), cone: +coneStep.toFixed(3), coneAtJ: +coneAt.toFixed(3) },
      scroll,
    };
  };
  const full = { ...api, metrics };
  (window as unknown as { __sceneSim?: typeof full }).__sceneSim = full;
}
