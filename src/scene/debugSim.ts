import { Vector3 } from 'three';
import { journey, type ResolvedShot } from './choreography';
import { AUDIENCE_FLOOR_Y, MIC, PIVOT_WORLD, SEATING, STAGE_EDGE_Z, STAND_BASE, STAND_TOP_Y, barrelRadius, micToWorld, rowHeight } from './layout';
import { createRig, createRigOut, stepRig, type LookOut } from './rig';
import { SECTION_IDS, type SectionId } from './scrollState';

/**
 * Debug-only transition simulator (loaded on demand with `?scene-debug=1`).
 * Exposes `window.__sceneSim`: steps the real camera rig with a fixed clock
 * over a list of scroll positions (or journey values), off screen and without
 * touching the live camera, and reports the pose, look values and the
 * clearance between the near plane and the scene geometry for every step.
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

/* Geometry proxies (metres). -------------------------------------------- */

const MIC_A = micToWorld(new Vector3(0, -0.044, 0));
const MIC_B = micToWorld(new Vector3(0, MIC.grilleC + MIC.grilleR * MIC.grilleSquash, 0));
const MIC_LEN = MIC_A.distanceTo(MIC_B);
const CLIP_C = micToWorld(new Vector3(-0.022, MIC.clipY, 0));
const tmp = new Vector3();
const tmp2 = new Vector3();

function micRadius(y: number) {
  if (y < 0) return 0.0092;
  if (y < MIC.taperY[0]) return 0.0126;
  if (y < 0.1056) return barrelRadius(y);
  if (y < 0.113) return 0.0206;
  const dy = (y - MIC.grilleC) / MIC.grilleSquash;
  return Math.sqrt(Math.max(0, MIC.grilleR * MIC.grilleR - dy * dy));
}

function distSegment(p: Vector3, a: Vector3, b: Vector3, out: { t: number }) {
  tmp.subVectors(b, a);
  const l2 = tmp.lengthSq();
  const t = Math.min(1, Math.max(0, tmp2.subVectors(p, a).dot(tmp) / l2));
  out.t = t;
  return tmp2.copy(a).addScaledVector(tmp, t).distanceTo(p);
}

const SEATS: Vector3[] = [];
SEATING.rows.forEach((n, row) => {
  const R = SEATING.firstRadius + row * SEATING.rowGap;
  for (let side = -1; side <= 1; side += 2)
    for (let k = 0; k < n / 2; k++) {
      const a = (side * (SEATING.aisle / 2 + SEATING.pitch * (k + 0.5))) / R;
      SEATS.push(new Vector3(SEATING.centre.x + Math.sin(a) * R, rowHeight(row) + 0.45, SEATING.centre.z + Math.cos(a) * R));
    }
});

const tt = { t: 0 };
/** Distance (m) from p to the nearest surface, and the object's name. */
export function clearance(p: Vector3): [number, string] {
  let best = 1e9;
  let name = '';
  const take = (d: number, n: string) => {
    if (d < best) {
      best = d;
      name = n;
    }
  };
  // Microphone body + grille (capsule with a varying radius).
  const dm = distSegment(p, MIC_A, MIC_B, tt);
  take(dm - micRadius(-0.044 + tt.t * MIC_LEN), 'mic');
  take(p.distanceTo(CLIP_C) - 0.012, 'clip');
  take(p.distanceTo(PIVOT_WORLD) - 0.019, 'yoke');
  // Stand tube, clutch and base.
  const stand = Math.hypot(p.x - STAND_BASE.x, p.z - STAND_BASE.z);
  const yIn = Math.min(STAND_TOP_Y, Math.max(0.05, p.y));
  take(Math.hypot(stand - 0.0095 > 0 ? stand - 0.0095 : 0, p.y - yIn), 'stand');
  take(Math.hypot(Math.max(0, stand - 0.15), Math.max(0, p.y - 0.055)), 'base');
  // Floors: stage (with the rug) and the audience floor beyond the lip.
  const onStage = p.z < STAGE_EDGE_Z;
  if (onStage) take(p.y - (Math.hypot(p.x, p.z) < 1.52 ? 0.0185 : 0), 'floor');
  else take(Math.hypot(p.y - AUDIENCE_FLOOR_Y, 0), 'audience floor');
  take(Math.hypot(Math.max(0, p.z - STAGE_EDGE_Z), Math.max(0, p.y)), 'stage lip');
  take(p.z + 4.6 - 0.1, 'curtain');
  for (const s of SEATS) {
    const dx = Math.max(0, Math.abs(p.x - s.x) - 0.3);
    const dy = Math.max(0, Math.abs(p.y - s.y) - 0.45);
    const dz = Math.max(0, Math.abs(p.z - s.z) - 0.3);
    take(Math.hypot(dx, dy, dz), 'seat');
  }
  return [best, name];
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
};

const r3 = (v: Vector3): [number, number, number] => [+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5)];

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
        stepRig(rig, shots, away, { J, dt, t: opts.drift === false ? 10 : t, pointerX: 0, pointerY: 0, snap: i === 0 }, look, out);
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
        });
      });
      return frames;
    },
  };
  (window as unknown as { __sceneSim?: typeof api }).__sceneSim = api;
}
