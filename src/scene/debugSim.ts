import { Vector3 } from 'three';
import { MOTION_LIMITS, SPINE, journey, micPoint, resolveShots, shotsFor, type ResolvedShot, type ShotOptions } from './choreography';
import { STAND_BASE } from './layout';
import { clearance } from './clearance';
import { createRig, createRigOut, nearCorner, stepRig, type LookOut } from './rig';
import { SECTION_IDS, type SectionId } from './scrollState';

/**
 * Debug-only transition simulator (loaded on demand with `?scene-debug=1`).
 * Exposes `window.__sceneSim`: steps the real camera rig with a fixed clock
 * over a list of scroll positions (or journey values), off screen and without
 * touching the live camera, and reports the pose, look values and the
 * clearance between the near plane and the scene geometry for every step.
 * `motion()` sweeps the whole journey and checks the rules of the one
 * continuous move (choreography.ts): per filmstrip step (J 0.125) the turn of
 * the view direction and the move of the subject on screen against
 * MOTION_LIMITS, spikes against the median of each beat, runs of steps
 * without camera change, a monotonic orbit / distance / rise, and the subject
 * in frame and clear of the copy column. It returns the numbers and a list of
 * failures. `metrics()` reports the older path figures (heading range,
 * anchor drift, roll across the pull back, light steps, fast-scroll rates).
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
  const motion = (opts: { content?: Partial<ShotOptions>; step?: number } = {}) => {
    const step = opts.step ?? 0.125;
    const js: number[] = [];
    for (let J = 0; J <= 6.0 + 1e-9; J += 0.001) js.push(+J.toFixed(3));
    const F = api.run({ js, drift: false, content: opts.content });
    const byJ = new Map(F.map((f) => [f.J.toFixed(3), f]));
    const at = (J: number) => byJ.get(J.toFixed(3)) as Frame;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const portrait = aspect < 0.9;
    const head = micPoint(0.1302);
    const tail = micPoint(-0.044);
    const barrel = SPINE;
    const foot = STAND_BASE.clone();
    const fwdOf = (f: Frame) => new Vector3(...f.tgt).sub(new Vector3(...f.pos)).normalize();
    // Orbit angle: the camera's azimuth round the vertical through its aim point.
    const az = (f: Frame) => Math.atan2(f.pos[0] - f.tgt[0], f.pos[2] - f.tgt[2]);
    const scr = (f: Frame, P: Vector3) => {
      const q = project(f, P, aspect);
      // x and y in units of the long side.
      return { x: q[0], y: q[1], z: q[2], lx: q[0] * Math.min(1, aspect), ly: q[1] / Math.max(1, aspect) };
    };
    const inFrame = (q: { x: number; y: number; z: number }) => q.z > 0 && q.x >= 0 && q.x <= 1 && q.y >= 0 && q.y <= 1;
    // Beats: 1 hero + macro, 2 spiral pull out, 3 Speakers..Venue, 4 Tickets.
    const beats = [
      { id: 'b1 hero+macro', from: 0.5, to: 1.625 },
      { id: 'b2 pull out', from: 1.625, to: 2.625 },
      { id: 'b3 speakers-venue', from: 2.625, to: 5.0 },
      { id: 'b4 tickets', from: 5.0, to: 6.0 },
    ];
    type Step = { J: number; view: number; screen: number; move: number; beat: string };
    const steps: Step[] = [];
    for (let J = 0.5; J <= 6.0 - step + 1e-9; J += step) {
      const f0 = at(J);
      const f1 = at(J + step);
      if (!f0 || !f1) continue;
      const view = (Math.acos(Math.min(1, fwdOf(f0).dot(fwdOf(f1)))) * 180) / Math.PI;
      const p0 = new Vector3(...f0.pos);
      const p1 = new Vector3(...f1.pos);
      const d0 = p0.distanceTo(new Vector3(...f0.tgt));
      // Camera change as an angle: travel relative to the distance to the aim, or the turn.
      const move = Math.max(view, (Math.atan(p0.distanceTo(p1) / Math.max(1e-6, d0)) * 180) / Math.PI);
      // Subject on screen, in units of the frame's long side (the width on landscape, the height on
      // portrait). While the barrel still fills the frame (to J 2.1) its
      // anchored aim point (the lens shift); then the middle of the barrel (where the microphone is);
      // once the pull out has landed (J 2.75), also the stand's foot: before that it is rising into
      // the frame from below, which is the reveal itself. Points off screen in either frame do not count.
      let screen = 0;
      if (J >= 1.625 && J < 2.1) screen = Math.hypot((f0.shift[0] - f1.shift[0]) * Math.min(1, aspect), (f0.shift[1] - f1.shift[1]) / Math.max(1, aspect));
      else if (J >= 2.1) {
        for (const P of J >= 2.75 ? [barrel, foot] : [barrel]) {
          const a = scr(f0, P);
          const b = scr(f1, P);
          if (inFrame(a) && inFrame(b)) screen = Math.max(screen, Math.hypot(a.lx - b.lx, a.ly - b.ly));
        }
      }
      const beat = beats.find((b) => J >= b.from - 1e-9 && J < b.to - 1e-9)?.id ?? '?';
      steps.push({ J: +J.toFixed(3), view: +view.toFixed(3), screen: +screen.toFixed(4), move: +move.toFixed(3), beat });
    }
    const median = (a: number[]) => {
      const b = [...a].sort((x, y) => x - y);
      return b.length ? b[Math.floor(b.length / 2)] : 0;
    };
    const fails: string[] = [];
    // Local peaks over the whole sweep (a step above both its neighbours, across beat boundaries too).
    const isPeak = (i: number, key: 'view' | 'screen') =>
      steps[i][key] > (steps[i - 1]?.[key] ?? -1) && steps[i][key] > (steps[i + 1]?.[key] ?? -1);
    const perBeat = beats.map((b) => {
      const idx = steps.map((s, i) => (s.beat === b.id ? i : -1)).filter((i) => i >= 0);
      const st = idx.map((i) => steps[i]);
      const v = st.map((s) => s.view);
      const sc = st.map((s) => s.screen);
      const mv = median(v);
      const ms = median(sc);
      const maxV = Math.max(...v);
      const maxS = Math.max(...sc);
      const vAt = st[v.indexOf(maxV)]?.J;
      const sAt = st[sc.indexOf(maxS)]?.J;
      // A spike is a single step that stands out: a local peak (above both neighbours) against the
      // median of its beat; a move that eases out from a faster beat is not one. It only counts when
      // it is big enough to see (the hero and the macro creep at fractions of a degree).
      const peak = (key: 'view' | 'screen', min: number) => {
        let p = 0;
        for (const i of idx) if (steps[i][key] >= min && isPeak(i, key)) p = Math.max(p, steps[i][key]);
        return p;
      };
      const spikeV = mv > 0 ? Math.max(1, peak('view', 0.6) / mv) : 1;
      const spikeS = ms > 0 ? Math.max(1, peak('screen', 0.006) / ms) : 1;
      // Velocity continuity of the orbit and rise: the largest change of the turn between neighbouring
      // steps, relative to the larger of them (a stop-start at a section boundary shows up here).
      let accel = 0;
      let accelAt = 0;
      for (let i = 1; i < st.length; i++) {
        const big = Math.max(st[i].view, st[i - 1].view);
        if (big < 0.6) continue;
        const r = Math.abs(st[i].view - st[i - 1].view) / big;
        if (r > accel) [accel, accelAt] = [r, st[i].J];
      }
      if (maxV > MOTION_LIMITS.viewDeg) fails.push(`${b.id}: view ${maxV.toFixed(2)} deg/step at J${vAt} > ${MOTION_LIMITS.viewDeg}`);
      if (maxS > MOTION_LIMITS.screen) fails.push(`${b.id}: subject ${(maxS * 100).toFixed(2)}%/step at J${sAt} > ${MOTION_LIMITS.screen * 100}%`);
      if (b.id !== 'b1 hero+macro' && spikeV > MOTION_LIMITS.spike) fails.push(`${b.id}: view spike ${spikeV.toFixed(2)}x median at J${vAt}`);
      if (b.id !== 'b1 hero+macro' && spikeS > MOTION_LIMITS.spike) fails.push(`${b.id}: subject spike ${spikeS.toFixed(2)}x median at J${sAt}`);
      return {
        beat: b.id,
        viewMedianDeg: +mv.toFixed(2),
        viewMaxDeg: +maxV.toFixed(2),
        viewMaxAtJ: vAt,
        viewSpike: +spikeV.toFixed(2),
        screenMedianPct: +(ms * 100).toFixed(2),
        screenMaxPct: +(maxS * 100).toFixed(2),
        screenMaxAtJ: sAt,
        screenSpike: +spikeS.toFixed(2),
        maxStepChange: +accel.toFixed(2),
        maxStepChangeAtJ: accelAt,
      };
    });
    // Liveness: runs of steps with essentially no camera change while a 3D section is on screen.
    let run = 0;
    let longest = 0;
    let longestAt = 0;
    for (const s of steps) {
      if (s.move < 0.05) {
        run++;
        if (run > longest) [longest, longestAt] = [run, s.J];
      } else run = 0;
    }
    if (longest > MOTION_LIMITS.stillRun) fails.push(`liveness: ${longest} still steps ending J${longestAt}`);
    // Monotonic channels (fine sweep): the distance to the head from the macro's end, the orbit from
    // the point where the camera has left the barrel (J 1.9; closer in, the aim sliding along the
    // tilted barrel moves the azimuth by a few tenths of a degree), the height from the landing on
    // the stage (J 2.625) to the end of Tickets. A reversal is a change of direction by more than
    // the tolerance from the last extreme.
    const reversals = (from: number, to: number, val: (f: Frame) => number, tol: number) => {
      let dir = 0;
      let n = 0;
      let firstAt = -1;
      let extreme = NaN;
      for (const f of F) {
        if (f.J < from || f.J > to) continue;
        const v = val(f);
        if (Number.isNaN(extreme)) {
          extreme = v;
          continue;
        }
        const d = v - extreme;
        if (dir === 0) {
          if (Math.abs(d) > tol) [dir, extreme] = [Math.sign(d), v];
        } else if (Math.sign(d) === dir) extreme = v;
        else if (Math.abs(d) > tol) {
          n++;
          if (firstAt < 0) firstAt = f.J;
          dir = Math.sign(d);
          extreme = v;
        }
      }
      return { reversals: n, firstAtJ: firstAt };
    };
    const orbitAt = (J: number) => {
      let d = az(at(J)) - az(at(1.66));
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return +((d * 180) / Math.PI).toFixed(1);
    };
    const mono = {
      orbit: reversals(1.9, 6.0, az, 1e-3),
      distance: reversals(1.7, 6.0, (f) => new Vector3(...f.pos).distanceTo(head), 1e-3),
      height: reversals(2.625, 6.0, (f) => f.pos[1], 1e-3),
    };
    for (const [k, v] of Object.entries(mono)) if (v.reversals) fails.push(`monotonic ${k}: ${v.reversals} reversals (first at J${v.firstAtJ})`);
    // Frame and copy column: the head and the tail of the mic from J 2.1 (the whole microphone has
    // arrived), the stand's foot from 2.45 (the pull out has landed on the stage).
    const frame = { xMin: 1, xMax: 0, yMin: 1, yMax: 0, xMinAtJ: 0 };
    let frameFails = 0;
    for (const f of F) {
      if (f.J < 2.1 || f.J > 5.98) continue;
      for (const P of f.J >= 2.45 ? [head, tail, foot] : [head, tail]) {
        const q = scr(f, P);
        if (q.x < frame.xMin) [frame.xMin, frame.xMinAtJ] = [q.x, f.J];
        frame.xMax = Math.max(frame.xMax, q.x);
        frame.yMin = Math.min(frame.yMin, q.y);
        frame.yMax = Math.max(frame.yMax, q.y);
        const out = q.z <= 0 || q.x < 0.02 || q.x > 0.98 || q.y < 0.02 || q.y > 0.98;
        const copy = !portrait && q.x < MOTION_LIMITS.copyX;
        if (out || copy) frameFails++;
      }
    }
    if (frameFails) fails.push(`frame/copy: ${frameFails} samples out of frame or over the copy column (xMin ${frame.xMin.toFixed(3)} at J${frame.xMinAtJ})`);
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      limits: MOTION_LIMITS,
      perBeat,
      liveness: { longestStillRun: longest, endsAtJ: longestAt },
      monotonic: mono,
      orbitDeg: { at2_5: orbitAt(2.5), at3: orbitAt(3), at4: orbitAt(4), at5: orbitAt(5), at6: orbitAt(6) },
      heightM: { at2_5: +at(2.5).pos[1].toFixed(2), at4: +at(4).pos[1].toFixed(2), at5: +at(5).pos[1].toFixed(2), at6: +at(6).pos[1].toFixed(2) },
      frame: { ...frame, xMin: +frame.xMin.toFixed(3), xMax: +frame.xMax.toFixed(3), yMin: +frame.yMin.toFixed(3), yMax: +frame.yMax.toFixed(3) },
      steps,
      /** Where the subject sits on screen (fractions from the left / top) at a few positions. */
      subjectAt: [2.1, 2.25, 2.375, 2.5, 2.75, 3, 3.5, 4, 4.5, 5, 5.25, 5.5, 5.75, 5.95].map((J) => {
        const f = at(J);
        const r = (P: Vector3) => {
          const q = scr(f, P);
          return [+q.x.toFixed(3), +q.y.toFixed(3)];
        };
        return { J, head: r(head), tail: r(tail), foot: r(foot) };
      }),
      fails,
      pass: fails.length === 0,
    };
  };
  const full = { ...api, metrics, motion };
  (window as unknown as { __sceneSim?: typeof full }).__sceneSim = full;
}
