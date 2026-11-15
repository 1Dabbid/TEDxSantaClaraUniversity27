import { Vector3 } from 'three';
import { DESCENT_HOLD_TO, DESCENT_J, MOTION_LIMITS, RIG, SPINE, journey, micPoint, portraitFraming, resolveShots, shotsFor, sidewaysPhone, type ResolvedShot, type ShotOptions } from './choreography';
import { MIC, MIC_MATRIX_INV, PIVOT_WORLD, SEATING, STAND_BASE, STAND_TOP_Y, rowHeight, fromHouse, toHouse } from './layout';
import { clearance } from './clearance';
import { measureHeroX, measureHeroY, measureSpeakersX, measureWideCopy, measureTicketsRoom, measureTicketsX, measureVenueX } from './contentLayout';
import { createRig, createRigOut, nearCorner, REACT, stepRig, type LookOut } from './rig';
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
 * without camera change, a monotonic orbit (one way round), the distance and
 * height stretches (out through the pull out, up to the crane, down and in to
 * the speaker's view), the macro's descent down the engraved band through the
 * Theme pin, the subject in frame and clear of the copy column, and the
 * speaker's view at the end of Tickets (behind the microphone at eye height,
 * the seats filling the frame, the grille in the foreground band). The scale
 * of the subject is the camera's distance to its axis (stand and microphone),
 * whatever the camera aims at. It returns the numbers and a list of
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
  /** Upper-middle band veil (0..1). */
  band: number;
  /** The subject's own light: key plus rim (the look's multipliers). */
  lit: number;
  /** Weight: lag of the view behind its turn (deg, along camera right / up). */
  lag: [number, number];
};

const WORLD_UP = new Vector3(0, 1, 0);
/** The back curtain's plane (world z, the face of its folds; clearance.ts keeps the near plane off it). */
const CURTAIN_Z = -4.6;
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
  const portrait = portraitFraming(window.innerWidth, window.innerHeight);
  const sched = L.heights.schedule;
  const base: ShotOptions = {
    speakersTba: !!document.querySelector('.speakers-runway--tba'),
    scheduleScale: sched ? Math.min(1, Math.max(0.4, sched / (1.45 * L.vh))) : 1,
    speakersX: measureSpeakersX(),
    venueX: measureVenueX(),
    ticketsX: measureTicketsX(),
    heroX: measureHeroX(),
    heroY: measureHeroY(),
    wideCopy: measureWideCopy(),
    sideways: sidewaysPhone(window.innerWidth, window.innerHeight),
    aspect: +(window.innerWidth / Math.max(1, window.innerHeight)).toFixed(2),
    ticketsRoom: measureTicketsRoom(),
  };
  return resolveShots(shotsFor(portrait, { ...base, ...over }));
}

/**
 * A box of copy on screen: fractions of the viewport [left, top, right, bottom], its kind (body text
 * line, heading line of 20px type or more, or panel / button) and, for a panel, the opacity of its backing.
 */
export type CopyBox = [number, number, number, number, 't' | 'h' | 'p', number?];

/**
 * The copy on screen right now: every visible line of text (tight line boxes from the text nodes)
 * and every panel with its own backing (a background at least 30% opaque, or a backdrop blur, that
 * covers less than half the viewport, so section backgrounds do not count). The scene canvas and
 * the stills are skipped.
 */
function copyBoxesNow(): CopyBox[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out: CopyBox[] = [];
  const push = (r: DOMRect, k: CopyBox[4], alpha?: number) => {
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return;
    const c = (v: number) => +Math.min(1, Math.max(0, v)).toFixed(4);
    out.push(alpha === undefined ? [c(r.left / vw), c(r.top / vh), c(r.right / vw), c(r.bottom / vh), k] : [c(r.left / vw), c(r.top / vh), c(r.right / vw), c(r.bottom / vh), k, +alpha.toFixed(2)]);
  };
  const visible = (el: Element) =>
    !el.closest('.scene-canvas, [data-scene-stills]') &&
    (el as HTMLElement & { checkVisibility?: (o: object) => boolean }).checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false;
  // The box an element's content is clipped to by its ancestors (overflow hidden / clip, or an inset
  // clip-path): the seat counter's digits roll inside one, and the digits outside it are not on screen.
  const clips = new Map<Element, DOMRect | null>();
  const insetOf = (clipPath: string, r: DOMRect): DOMRect | null => {
    const m = /^inset\(([^)]*)\)/.exec(clipPath);
    if (!m) return null;
    const v = m[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
    const len = (s: string | undefined, size: number) => (!s ? NaN : s.endsWith('%') ? (parseFloat(s) / 100) * size : s.endsWith('px') || /^-?[\d.]+$/.test(s) ? parseFloat(s) : NaN);
    const t = len(v[0], r.height);
    const ri = len(v[1] ?? v[0], r.width);
    const b = len(v[2] ?? v[0], r.height);
    const l = len(v[3] ?? v[1] ?? v[0], r.width);
    if (![t, ri, b, l].every(Number.isFinite)) return null;
    return new DOMRect(r.left + l, r.top + t, Math.max(0, r.width - l - ri), Math.max(0, r.height - t - b));
  };
  const clipOf = (el: Element): DOMRect | null => {
    const hit = clips.get(el);
    if (hit !== undefined) return hit;
    let box: DOMRect | null = null;
    for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const inset = cs.clipPath && cs.clipPath !== 'none' ? insetOf(cs.clipPath, a.getBoundingClientRect()) : null;
      if (!inset && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const r = inset ?? a.getBoundingClientRect();
      if (!box) box = r;

      else {
        const l = Math.max(box.left, r.left);
        const t = Math.max(box.top, r.top);
        box = new DOMRect(l, t, Math.max(0, Math.min(box.right, r.right) - l), Math.max(0, Math.min(box.bottom, r.bottom) - t));
      }
    }
    clips.set(el, box);
    return box;
  };
  const range = document.createRange();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.textContent?.trim() || el.closest('script, style, noscript, .sr-only') || !visible(el)) continue;
    const cs = getComputedStyle(el);
    if (+cs.opacity < 0.05) continue;
    range.selectNodeContents(n);
    const clip = clipOf(el);
    for (const r of range.getClientRects()) {
      if (!clip) push(r, parseFloat(cs.fontSize) >= 20 ? 'h' : 't');
      else {
        const l = Math.max(clip.left, r.left);
        const t = Math.max(clip.top, r.top);
        push(new DOMRect(l, t, Math.max(0, Math.min(clip.right, r.right) - l), Math.max(0, Math.min(clip.bottom, r.bottom) - t)), parseFloat(cs.fontSize) >= 20 ? 'h' : 't');
      }
    }
  }
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const alpha = alphaOf(cs.backgroundColor);
    const blur = cs.backdropFilter && cs.backdropFilter !== 'none';
    if (alpha < 0.3 && !blur) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height > 0.5 * vw * vh || !visible(el)) continue;
    push(r, 'p', alpha);
  }
  return out;
}

/** Opacity of a CSS colour in any syntax (the 2D canvas normalises it). */
let alphaCtx: CanvasRenderingContext2D | null = null;
const alphaCache = new Map<string, number>();
function alphaOf(color: string): number {
  let a = alphaCache.get(color);
  if (a !== undefined) return a;
  alphaCtx ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  if (!alphaCtx) return 0;
  alphaCtx.clearRect(0, 0, 1, 1);
  alphaCtx.fillStyle = '#000';
  alphaCtx.fillStyle = color;
  alphaCtx.fillRect(0, 0, 1, 1);
  a = alphaCtx.getImageData(0, 0, 1, 1).data[3] / 255;
  alphaCache.set(color, a);
  return a;
}

const r3 = (v: Vector3): [number, number, number] => [+v.x.toFixed(8), +v.y.toFixed(8), +v.z.toFixed(8)];

/**
 * The subject's axis as a polyline: the stand from its foot to the clip, then the microphone from its
 * tail to the top of the grille. The distance from the camera to it is the scale of the subject in
 * the frame, whatever the camera aims at (the aim leaves the subject for the house at the end).
 */
const SUBJECT_AXIS = [STAND_BASE.clone(), new Vector3(STAND_BASE.x, STAND_TOP_Y, STAND_BASE.z), PIVOT_WORLD.clone(), micPoint(-0.044), micPoint(0.156)];
function subjectDist(p: Vector3): number {
  let best = Infinity;
  const ab = new Vector3();
  const ap = new Vector3();
  for (let i = 0; i < SUBJECT_AXIS.length - 1; i++) {
    const a = SUBJECT_AXIS[i];
    ab.subVectors(SUBJECT_AXIS[i + 1], a);
    const t = Math.min(1, Math.max(0, ap.subVectors(p, a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
    best = Math.min(best, ap.copy(a).addScaledVector(ab, t).distanceTo(p));
  }
  return best;
}

/** The 100 seats (centre of each seat, world space). */
const SEAT_POINTS: Vector3[] = [];
SEATING.rows.forEach((n, row) => {
  const R = SEATING.firstRadius + row * SEATING.rowGap;
  for (let side = -1; side <= 1; side += 2)
    for (let k = 0; k < n / 2; k++) {
      const a = (side * (SEATING.aisle / 2 + SEATING.pitch * (k + 0.5))) / R;
      SEAT_POINTS.push(fromHouse(new Vector3(SEATING.centre.x + Math.sin(a) * R, rowHeight(row) + 0.55, SEATING.centre.z + Math.cos(a) * R)));
    }
});

export function installSim(getShots: () => { shots: ResolvedShot[]; away: ResolvedShot }) {
  const api = {
    /** The live reaction constants (rig.ts REACT), for tuning from the console; the page uses the same object. */
    reactTune: REACT as Record<string, number>,
    layout: measure,
    /** The Tickets room figure as measured (contentLayout.ts): what the end of the move is framed by. */
    room: measureTicketsRoom,
    copyBoxes: copyBoxesNow,
    /**
     * Where the page below Tickets starts on screen (fraction of the height from the top): the next
     * band's background fades in from there and covers the frame below it. The audit script collects
     * it at the speaker's view steps; the grille has to stay above it.
     */
    ticketsEnd: () => {
      const el = document.querySelector<HTMLElement>('[data-section="tickets"]');
      return el ? +(el.getBoundingClientRect().bottom / window.innerHeight).toFixed(4) : 1;
    },
    journeyAt: (y: number) => journeyAt(measure(), y),
    /**
     * Steps the rig at a fixed dt over `ys` (scroll px per step) or `js`
     * (journey values per step). The first value is snapped to.
     */
    run(opts: {
      ys?: number[];
      js?: number[];
      dt?: number;
      t0?: number;
      drift?: boolean;
      content?: Partial<ShotOptions>;
      /** Pointer (NDC, -1..1) held for the whole run, and how much the scene reacts to it (default 0). */
      pointer?: [number, number];
      react?: number;
      portrait?: boolean;
      /** Touch screens: blend to the automatic sway (0..1) and a scroll kick (pointer units), held. */
      sway?: number;
      kick?: number;
    }): Frame[] {
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
        stepRig(
          rig,
          shots,
          away,
          {
            J,
            dt,
            t: opts.drift === false ? 10 : t,
            pointerX: opts.pointer?.[0] ?? 0,
            pointerY: opts.pointer?.[1] ?? 0,
            react: opts.react ?? 0,
            portrait: opts.portrait,
            sway: opts.sway,
            kick: opts.kick,
            snap: i === 0,
            aspect,
          },
          look,
          out,
        );
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
          band: +look.band.toFixed(4),
          lit: +(Math.max(0, look.key) + look.rim).toFixed(4),
          lag: [+((out.lagX * 180) / Math.PI).toFixed(4), +((out.lagY * 180) / Math.PI).toFixed(4)],
        });
      });
      return frames;
    },
    /**
     * How the camera answers the pointer at a journey position: holds the page at J, settles the
     * rig, then holds the pointer at each corner (left, right, top, bottom) for `hold` seconds and
     * reports the camera's orbit round the target and the turn of the view (deg) against the
     * pointer at rest, plus the near-plane clearance. `react` 0 must give zeros.
     */
    react(opts: { J: number; react?: number; hold?: number; portrait?: boolean }) {
      const hold = opts.hold ?? 3;
      const n = Math.round(hold * 60);
      const settle = Array(240).fill(opts.J);
      const base = api.run({ js: settle, drift: false, react: opts.react ?? 1, portrait: opts.portrait }).at(-1)!;
      const deg = (a: Vector3, b: Vector3) => (Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180) / Math.PI;
      const tgt0 = new Vector3(...base.tgt);
      const pos0 = new Vector3(...base.pos);
      const off0 = pos0.clone().sub(tgt0).normalize();
      const fwd0 = tgt0.clone().sub(pos0).normalize();
      const corners: Record<string, [number, number]> = { left: [-1, 0], right: [1, 0], top: [0, 1], bottom: [0, -1] };
      const res: Record<string, { orbitDeg: number; viewDeg: number; clr: number; finite: boolean }> = {};
      for (const [k, p] of Object.entries(corners)) {
        const F = api.run({ js: [...settle, ...Array(n).fill(opts.J)], drift: false, react: opts.react ?? 1, pointer: p, portrait: opts.portrait });
        const f = F.at(-1)!;
        const pos = new Vector3(...f.pos);
        const tgt = new Vector3(...f.tgt);
        const finite = F.every((x) => x.pos.every(Number.isFinite) && x.tgt.every(Number.isFinite));
        res[k] = {
          orbitDeg: +deg(pos.clone().sub(tgt0).normalize(), off0).toFixed(3),
          viewDeg: +deg(tgt.clone().sub(pos).normalize(), fwd0).toFixed(3),
          clr: Math.min(...F.slice(settle.length).map((x) => x.clr)),
          finite,
        };
      }
      return { J: opts.J, dist: +pos0.distanceTo(tgt0).toFixed(4), corners: res };
    },
    /**
     * Touch screens without tilt: holds the page at J for `seconds` with the automatic sway (and an
     * optional held scroll kick) and reports the side-to-side swing of the camera round the target
     * (deg, peak to peak along the shot's horizontal), the least clearance and finiteness.
     */
    phone(opts: { J: number; seconds?: number; portrait?: boolean; kick?: number }) {
      const n = Math.round((opts.seconds ?? 30) * 60);
      const settle = Array(240).fill(opts.J);
      const base = api.run({ js: settle, drift: false }).at(-1)!;
      const tgt0 = new Vector3(...base.tgt);
      const pos0 = new Vector3(...base.pos);
      const off0 = pos0.clone().sub(tgt0).normalize();
      const right = new Vector3().crossVectors(off0.clone().negate(), new Vector3(...base.up)).normalize();
      const F = api.run({ js: [...settle, ...Array(n).fill(opts.J)], react: 1, sway: 1, kick: opts.kick, portrait: opts.portrait }).slice(settle.length);
      const tmp = new Vector3();
      const ang = F.map((f) => {
        tmp.set(...f.pos).sub(tgt0).normalize();
        return (Math.asin(Math.max(-1, Math.min(1, tmp.dot(right)))) * 180) / Math.PI;
      });
      return {
        J: opts.J,
        swingDeg: +(Math.max(...ang) - Math.min(...ang)).toFixed(3),
        meanDeg: +(ang.reduce((a, b) => a + b, 0) / ang.length).toFixed(3),
        minClr: Math.min(...F.map((f) => f.clr)),
        finite: F.every((f) => [...f.pos, ...f.tgt, ...f.up].every(Number.isFinite)),
      };
    },
    /**
     * How far the reaction carries the subject on screen at a journey position: the page held at J,
     * the rig settled, then the pointer held at each side and corner (or, with `sway`, the automatic
     * sway of a touch screen for `seconds`, with an optional held scroll kick). Reports the largest
     * displacement (px) of the grille and of any part of the subject in frame at rest (grille, barrel,
     * stand foot) against the frame at rest, where the grille went (fractions of the frame), and how
     * far the house's middle slid behind it (px).
     */
    subjectShift(opts: { J: number; sway?: boolean; seconds?: number; kick?: number }) {
      const aspect = window.innerWidth / Math.max(1, window.innerHeight);
      const portrait = portraitFraming(window.innerWidth, window.innerHeight);
      const settle = Array(240).fill(opts.J);
      const base = api.run({ js: settle, drift: false, portrait }).at(-1)!;
      const head = micPoint(0.1302);
      const parts = [head, SPINE, STAND_BASE.clone()];
      const house = fromHouse(new Vector3(0, 1.35, 9.0));
      const at = (f: Frame, P: Vector3) => project(f, P, aspect);
      const inside = (q: number[]) => q[2] > 0 && q[0] >= 0 && q[0] <= 1 && q[1] >= 0 && q[1] <= 1;
      const rest = parts.map((P) => at(base, P));
      const house0 = at(base, house);
      const px = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * window.innerWidth, (a[1] - b[1]) * window.innerHeight);
      const runs: Frame[][] = [];
      if (opts.sway) {
        const n = Math.round((opts.seconds ?? 30) * 60);
        runs.push(api.run({ js: [...settle, ...Array(n).fill(opts.J)], react: 1, sway: 1, kick: opts.kick, portrait }).slice(settle.length));
      } else {
        for (const p of [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, -1], [-1, 1], [1, -1], [1, 1]] as [number, number][])
          runs.push(api.run({ js: [...settle, ...Array(180).fill(opts.J)], drift: false, react: 1, pointer: p, portrait }).slice(settle.length));
      }
      let headPx = 0;
      let maxPx = 0;
      let housePx = 0;
      let headIn = inside(rest[0]);
      const box = [1, 1, 0, 0];
      for (const F of runs)
        for (const f of F) {
          parts.forEach((P, i) => {
            if (!inside(rest[i])) return;
            const q = at(f, P);
            const d = px(q, rest[i]);
            maxPx = Math.max(maxPx, d);
            if (i === 0) {
              headPx = Math.max(headPx, d);
              headIn &&= inside(q);
              box[0] = Math.min(box[0], q[0]);
              box[1] = Math.min(box[1], q[1]);
              box[2] = Math.max(box[2], q[0]);
              box[3] = Math.max(box[3], q[1]);
            }
          });
          housePx = Math.max(housePx, px(at(f, house), house0));
        }
      return {
        J: opts.J,
        headPx: +headPx.toFixed(1),
        maxPx: +maxPx.toFixed(1),
        housePx: +housePx.toFixed(1),
        headIn,
        headRest: [+rest[0][0].toFixed(3), +rest[0][1].toFixed(3)],
        headBox: box.map((v) => +v.toFixed(3)),
      };
    },
    /**
     * Where things sit on screen with the page held at each J (the rig settled, no reaction): the
     * grille, the barrel's middle and the house's look point (fractions from the left / top), the
     * camera's height, its distance to the grille (m) and the angle from the view to the house (deg).
     */
    place(js: number[]) {
      const aspect = window.innerWidth / Math.max(1, window.innerHeight);
      const house = fromHouse(new Vector3(0, 1.35, 9.0));
      return js.map((J) => {
        const f = api.run({ js: Array(240).fill(J), drift: false, portrait: portraitFraming(window.innerWidth, window.innerHeight) }).at(-1)!;
        const r = (P: Vector3) => project(f, P, aspect).slice(0, 2).map((v) => +v.toFixed(3));
        const cam = new Vector3(...f.pos);
        const view = new Vector3(...f.tgt).sub(cam).normalize();
        const off = (Math.acos(Math.min(1, view.dot(house.clone().sub(cam).normalize()))) * 180) / Math.PI;
        return { J, head: r(micPoint(0.1302)), barrel: r(SPINE), house: r(house), camY: +f.pos[1].toFixed(3), headM: +cam.distanceTo(micPoint(0.1302)).toFixed(3), fov: f.fov, exp: f.exp, houseDeg: +off.toFixed(2) };
      });
    },
    /**
     * A fling: the journey jumps from `from` to `to` in one frame and back, at 60 fps. Reports the
     * largest weight lag and the largest bank into the move (deg; the rig's own roll, not the
     * authored horizon roll of the shot), the bank limit (deg), whether every value stayed finite,
     * and the least clearance.
     */
    fling(opts: { from: number; to: number; frames?: number }) {
      const n = opts.frames ?? 120;
      const js = [...Array(30).fill(opts.from), ...Array(n).fill(opts.to), ...Array(n).fill(opts.from)];
      const F = api.run({ js, drift: false });
      return {
        maxLagDeg: Math.max(...F.map((f) => Math.hypot(f.lag[0], f.lag[1]))),
        maxBankDeg: Math.max(...F.map((f) => (Math.abs(f.roll) * 180) / Math.PI)),
        bankLimitDeg: (RIG.rollMax * 180) / Math.PI,
        minClr: Math.min(...F.map((f) => f.clr)),
        finite: F.every((f) => [...f.pos, ...f.tgt, ...f.up, f.roll, ...f.lag].every(Number.isFinite)),
      };
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
    /**
   * `copy`: the copy on screen at each filmstrip step (key J.toFixed(3), from `copyBoxes()` with the
   * page scrolled there; the audit script collects them), so the keep-out test uses the real layout
   * at this viewport instead of fixed fractions. `copyMarginPx` is the air kept round every box.
   * `pointer` holds the pointer there for the whole sweep with the scene reacting, to check that the
   * reaction keeps the subject in frame and clear of the copy too (`placeFails`).
   */
  const motion = (
    opts: {
      content?: Partial<ShotOptions>;
      step?: number;
      copy?: Record<string, CopyBox[]>;
      copyMarginPx?: number;
      pointer?: [number, number];
      edge?: Record<string, number>;
    } = {},
  ) => {
    const step = opts.step ?? 0.125;
    const js: number[] = [];
    for (let J = 0; J <= 6.0 + 1e-9; J += 0.001) js.push(+J.toFixed(3));
    const F = api.run({
      js,
      drift: false,
      content: opts.content,
      pointer: opts.pointer,
      react: opts.pointer ? 1 : 0,
      portrait: portraitFraming(window.innerWidth, window.innerHeight),
    });
    const byJ = new Map(F.map((f) => [f.J.toFixed(3), f]));
    const at = (J: number) => byJ.get(J.toFixed(3)) as Frame;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const portrait = portraitFraming(window.innerWidth, window.innerHeight);
    const head = micPoint(0.1302);
    const tail = micPoint(-0.044);
    const barrel = SPINE;
    const foot = STAND_BASE.clone();
    const fwdOf = (f: Frame) => new Vector3(...f.tgt).sub(new Vector3(...f.pos)).normalize();
    // Orbit angle: the camera's azimuth round the vertical through the subject (the stand line).
    const az = (f: Frame) => Math.atan2(f.pos[0] - SPINE.x, f.pos[2] - SPINE.z);
    const scr = (f: Frame, P: Vector3) => {
      const q = project(f, P, aspect);
      // x and y in units of the long side.
      return { x: q[0], y: q[1], z: q[2], lx: q[0] * Math.min(1, aspect), ly: q[1] / Math.max(1, aspect) };
    };
    const inFrame = (q: { x: number; y: number; z: number }) => q.z > 0 && q.x >= 0 && q.x <= 1 && q.y >= 0 && q.y <= 1;
    // Beats: 1 hero + macro, 2 spiral pull out to the low pass, 3 the low pass and the orbit over
    // Schedule, 4 the crane over Venue, 5 down and in behind the microphone, 6 the speaker's view (held).
    const beats = [
      { id: 'b1 hero+macro', from: 0.5, to: 1.625 },
      { id: 'b2 pull out', from: 1.625, to: 2.875 },
      { id: 'b3 low pass+orbit', from: 2.875, to: 4.0 },
      { id: 'b4 crane', from: 4.0, to: 5.0 },
      // The come down arrives at the speaker's view about J 5.7 and holds it to the fade at the end.
      { id: 'b5 come down', from: 5.0, to: 5.75 },
      { id: "b6 speaker's view", from: 5.75, to: 6.0 },
    ];
    // The Tickets section's height in viewport heights: how far the page scrolls per J over the end of Tickets.
    const pageL = measure();
    const pageHv = (pageL.heights.tickets ?? 0) / Math.max(1, pageL.vh);
    type Step = { J: number; view: number; screen: number; move: number; zoom: number; beat: string };

    const steps: Step[] = [];
    for (let J = 0.5; J <= 6.0 - step + 1e-9; J += step) {
      const f0 = at(J);
      const f1 = at(J + step);
      if (!f0 || !f1) continue;
      const view = (Math.acos(Math.min(1, fwdOf(f0).dot(fwdOf(f1)))) * 180) / Math.PI;
      const p0 = new Vector3(...f0.pos);
      const p1 = new Vector3(...f1.pos);
      const d0 = subjectDist(p0);
      // Camera change as an angle: travel relative to the distance to the subject, or the turn.
      const move = Math.max(view, (Math.atan(p0.distanceTo(p1) / Math.max(1e-6, d0)) * 180) / Math.PI);
      // Change of scale: the log of the camera's distance to the subject (a zoom in or out is a move too).
      const d1 = subjectDist(p1);
      const zoom = Math.abs(Math.log(Math.max(1e-6, d1) / Math.max(1e-6, d0)));
      // Subject on screen, in units of the frame's long side (the width on landscape, the height on
      // portrait). While the barrel still fills the frame (the hero, the push in, the macro, to
      // MOTION_LIMITS.frameMicFrom) its anchored aim point (the lens shift); then the middle of the
      // barrel (where the microphone is); from frameFootFrom to frameFootTo (the low pass is over, the
      // camera has not yet come down behind the microphone) also the stand's foot: outside that it is
      // rising into or leaving the frame, which is the reveal or the come down itself. Points off
      // screen in either frame do not count.
      let screen = 0;
      if (J < MOTION_LIMITS.frameMicFrom) screen = Math.hypot((f0.shift[0] - f1.shift[0]) * Math.min(1, aspect), (f0.shift[1] - f1.shift[1]) / Math.max(1, aspect));
      else {
        // From rideFrom the grille rides up with the page under the seat counter: the smaller of its
        // move on screen and its move against the page (which scrolls up by the section's height per J).
        const page = J >= MOTION_LIMITS.rideFrom - 1e-9 ? (pageHv * step) / Math.max(1, aspect) : 0;
        for (const P of J >= MOTION_LIMITS.frameFootFrom && J <= MOTION_LIMITS.frameFootTo ? [barrel, foot] : [barrel]) {
          const a = scr(f0, P);
          const b = scr(f1, P);
          if (!inFrame(a) || !inFrame(b)) continue;
          const onScreen = Math.hypot(a.lx - b.lx, a.ly - b.ly);
          screen = Math.max(screen, page ? Math.min(onScreen, Math.hypot(a.lx - b.lx, b.ly - a.ly + page)) : onScreen);
        }
      }
      const beat = beats.find((b) => J >= b.from - 1e-9 && J < b.to - 1e-9)?.id ?? '?';
      steps.push({ J: +J.toFixed(3), view: +view.toFixed(3), screen: +screen.toFixed(4), move: +move.toFixed(3), zoom: +zoom.toFixed(4), beat });
    }
    const median = (a: number[]) => {
      const b = [...a].sort((x, y) => x - y);
      return b.length ? b[Math.floor(b.length / 2)] : 0;
    };
    const fails: string[] = [];
    // Local peaks over the whole sweep (a step above both its neighbours, across beat boundaries too).
    const isPeak = (i: number, key: 'view' | 'screen' | 'zoom') =>
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
      const peak = (key: 'view' | 'screen' | 'zoom', min: number) => {
        let p = 0;
        for (const i of idx) if (steps[i][key] >= min && isPeak(i, key)) p = Math.max(p, steps[i][key]);
        return p;
      };
      const spikeV = mv > 0 ? Math.max(1, peak('view', 0.6) / mv) : 1;
      const spikeS = ms > 0 ? Math.max(1, peak('screen', 0.006) / ms) : 1;
      const z = st.map((s) => s.zoom);
      const mz = median(z);
      const maxZ = Math.max(...z);
      const zAt = st[z.indexOf(maxZ)]?.J;
      const spikeZ = mz > 0 ? Math.max(1, peak('zoom', 0.08) / mz) : 1;
      // The same continuity for the change of scale (a hard start or stop of a zoom).
      let zAccel = 0;
      let zAccelAt = 0;
      for (let i = 1; i < st.length; i++) {
        const big = Math.max(st[i].zoom, st[i - 1].zoom);
        if (big < MOTION_LIMITS.zoomAccelFrom) continue;
        const r = Math.abs(st[i].zoom - st[i - 1].zoom) / big;
        if (r > zAccel) [zAccel, zAccelAt] = [r, st[i].J];
      }
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
      const viewMax = Math.min(MOTION_LIMITS.viewDeg, MOTION_LIMITS.viewDegBeat[b.id as keyof typeof MOTION_LIMITS.viewDegBeat] ?? Infinity);
      if (maxV > viewMax) fails.push(`${b.id}: view ${maxV.toFixed(2)} deg/step at J${vAt} > ${viewMax}`);
      const screenMax = b.from >= MOTION_LIMITS.screenNear.from - 1e-9 ? MOTION_LIMITS.screenNear.limit : MOTION_LIMITS.screen;
      if (maxS > screenMax) fails.push(`${b.id}: subject ${(maxS * 100).toFixed(2)}%/step at J${sAt} > ${(screenMax * 100).toFixed(0)}%`);
      if (maxZ > MOTION_LIMITS.zoom) fails.push(`${b.id}: scale ${maxZ.toFixed(3)} ln/step at J${zAt} > ${MOTION_LIMITS.zoom}`);
      if (b.id !== 'b1 hero+macro' && spikeZ > MOTION_LIMITS.spike) fails.push(`${b.id}: scale spike ${spikeZ.toFixed(2)}x median at J${zAt}`);
      if (zAccel > MOTION_LIMITS.zoomAccel) fails.push(`${b.id}: scale velocity change ${zAccel.toFixed(2)} at J${zAccelAt} > ${MOTION_LIMITS.zoomAccel}`);
      if (accel > MOTION_LIMITS.accel) fails.push(`${b.id}: view velocity change ${accel.toFixed(2)} at J${accelAt} > ${MOTION_LIMITS.accel}`);
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
        zoomMedian: +mz.toFixed(3),
        zoomMax: +maxZ.toFixed(3),
        zoomMaxAtJ: zAt,
        zoomSpike: +spikeZ.toFixed(2),
        zoomStepChange: +zAccel.toFixed(2),
        zoomStepChangeAtJ: zAccelAt,
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
    // Monotonic channels (fine sweep): the orbit from the point where the camera has left the barrel
    // (J 1.9; closer in, the aim sliding along the tilted barrel moves the azimuth by a few tenths of
    // a degree) to the end, in one direction; the distance to the subject grows through the pull out
    // and falls as the camera comes down behind the microphone; the height rises from the low pass
    // to the top of the crane and falls from there to the speaker's view (MOTION_LIMITS: pullJ,
    // riseJ, comeDownJ). A reversal is a change of direction by more than the tolerance from the
    // last extreme.
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
      // Unwrapped (azU, below): the orbit may pass the half turn.
      const d = (azU.get(at(J)) ?? 0) - (azU.get(at(1.66)) ?? 0);
      return +((d * 180) / Math.PI).toFixed(1);
    };
    const sd = (f: Frame) => subjectDist(new Vector3(...f.pos));
    const L = MOTION_LIMITS;
    // The azimuth unwrapped along the sweep (the orbit may pass the half turn).
    const azU = new Map<Frame, number>();
    let azPrev = NaN;
    let azAcc = 0;
    for (const f of F) {
      const a = az(f);
      if (!Number.isNaN(azPrev)) {
        let d = a - azPrev;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        azAcc += d;
      } else azAcc = a;
      azPrev = a;
      azU.set(f, azAcc);
    }
    const mono = {
      orbit: reversals(1.9, 6.0, (f) => azU.get(f) ?? az(f), 1e-3),
      pullOut: reversals(L.pullJ[0], L.pullJ[1], sd, 1e-3),
      comeDownDistance: reversals(L.comeDownJ[0], L.comeDownJ[1], sd, 1e-3),
      rise: reversals(L.riseJ[0], L.riseJ[1], (f) => f.pos[1], 1e-3),
      comeDownHeight: reversals(L.comeDownJ[0], L.comeDownJ[1], (f) => f.pos[1], 1e-3),
    };
    // The direction of each monotonic stretch: the orbit one way round (towards the grille side,
    // negative), out in the pull out, up over the rise, down and in over the come down.
    const sgn = (from: number, to: number, val: (f: Frame) => number) => Math.sign(val(at(to)) - val(at(from)));
    const orbitRad = (f: Frame) => {
      let d = az(f) - az(at(1.9));
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return d;
    };
    if (sgn(2.5, 2.6, orbitRad) > 0) fails.push('orbit: turns the wrong way (towards the hero side)');
    if (sgn(L.pullJ[0], L.pullJ[1], sd) < 0) fails.push('pull out: the distance falls');
    if (sgn(L.riseJ[0], L.riseJ[1], (f) => f.pos[1]) < 0) fails.push('rise: the camera falls');
    if (sgn(L.comeDownJ[0], L.comeDownJ[1], (f) => f.pos[1]) > 0) fails.push('come down: the camera rises');
    if (sgn(L.comeDownJ[0], L.comeDownJ[1], sd) > 0) fails.push('come down: the distance grows');
    for (const [k, v] of Object.entries(mono)) if (v.reversals) fails.push(`monotonic ${k}: ${v.reversals} reversals (first at J${v.firstAtJ})`);
    // The descent down the engraved band through the Theme pin (DESCENT_J): the aim's height along the
    // barrel axis (mic space) falls at every filmstrip step, never rises on the fine sweep (on to the end of the hold at the foot, DESCENT_HOLD_TO), never
    // passes more than descentMax of the frame's height in one step, and covers descentMin of the band.
    const along = (f: Frame) => new Vector3(...f.tgt).applyMatrix4(MIC_MATRIX_INV).y;
    const frameH = (f: Frame) => 2 * new Vector3(...f.pos).distanceTo(new Vector3(...f.tgt)) * Math.tan((f.fov * Math.PI) / 360);
    const bandH = MIC.bandY[1] - MIC.bandY[0];
    const dSteps: { J: number; downMm: number; frameShare: number }[] = [];
    for (let J = DESCENT_J[0]; J <= DESCENT_J[1] - step + 1e-9; J += step) {
      const f0 = at(J);
      const f1 = at(J + step);
      if (!f0 || !f1) continue;
      const down = along(f0) - along(f1);
      dSteps.push({ J: +J.toFixed(3), downMm: +(down * 1000).toFixed(2), frameShare: +(down / frameH(f0)).toFixed(3) });
    }
    let dBack = 0;
    let dBackAt = -1;
    let dLow = Infinity;
    for (const f of F) {
      // Through the hold at the foot as well: no drift back up while the pull out begins.
      if (f.J < DESCENT_J[0] || f.J > DESCENT_HOLD_TO) continue;
      const a = along(f);
      if (a > dLow + MOTION_LIMITS.descentBackTol && a - dLow > dBack) [dBack, dBackAt] = [a - dLow, f.J];
      dLow = Math.min(dLow, a);
    }
    const dTotal = along(at(DESCENT_J[0])) - along(at(DESCENT_J[1]));
    const descent = {
      fromMm: +(along(at(DESCENT_J[0])) * 1000).toFixed(1),
      toMm: +(along(at(DESCENT_J[1])) * 1000).toFixed(1),
      bandShare: +(dTotal / bandH).toFixed(2),
      minStepMm: dSteps.length ? Math.min(...dSteps.map((d) => d.downMm)) : 0,
      maxFrameShare: dSteps.length ? Math.max(...dSteps.map((d) => d.frameShare)) : 0,
      backMm: +(dBack * 1000).toFixed(2),
      steps: dSteps,
    };
    if (dBackAt >= 0) fails.push(`descent: the aim goes back up the barrel by ${descent.backMm} mm at J${dBackAt}`);
    for (const d of dSteps) {
      if (d.downMm < MOTION_LIMITS.descentStepMin * 1000) fails.push(`descent: ${d.downMm} mm down the barrel at J${d.J} (still or reversing; at least ${MOTION_LIMITS.descentStepMin * 1000} mm)`);
      if (d.frameShare > MOTION_LIMITS.descentMax) fails.push(`descent: ${(d.frameShare * 100).toFixed(0)}% of the frame's height at J${d.J} > ${MOTION_LIMITS.descentMax * 100}%`);
    }
    if (dTotal < MOTION_LIMITS.descentMin * bandH) fails.push(`descent: covers ${(descent.bandShare * 100).toFixed(0)}% of the engraved band < ${MOTION_LIMITS.descentMin * 100}%`);
    // Frame: the head of the mic from frameMicFrom (the whole microphone has arrived) to the end, its
    // tail to frameTailTo (in the speaker's view it runs out below the grille), the stand's foot from
    // frameFootFrom to frameFootTo.
    const frame = { xMin: 1, xMax: 0, yMin: 1, yMax: 0, xMinAtJ: 0 };
    let frameFails = 0;
    const frameOut: string[] = [];
    for (const f of F) {
      if (f.J < MOTION_LIMITS.frameMicFrom || f.J > 5.98) continue;
      const parts = f.J <= MOTION_LIMITS.frameTailTo ? [head, tail] : [head];
      for (const P of f.J >= MOTION_LIMITS.frameFootFrom && f.J <= MOTION_LIMITS.frameFootTo ? [...parts, foot] : parts) {
        const q = scr(f, P);
        if (q.x < frame.xMin) [frame.xMin, frame.xMinAtJ] = [q.x, f.J];
        frame.xMax = Math.max(frame.xMax, q.x);
        frame.yMin = Math.min(frame.yMin, q.y);
        frame.yMax = Math.max(frame.yMax, q.y);
        const out = q.z <= 0 || q.x < 0.02 || q.x > 0.98 || q.y < 0.02 || q.y > 0.98;
        if (out) {
          frameFails++;
          if (frameOut.length < 6) frameOut.push(`${P === head ? 'head' : P === tail ? 'tail' : 'foot'}@J${f.J} [${q.x.toFixed(2)}, ${q.y.toFixed(2)}]`);
        }
      }
    }
    if (frameFails) fails.push(`frame: ${frameFails} samples out of frame (first: ${frameOut.join(', ')})`);
    // Copy keep-out (real layout): the head, the barrel, the tail, points down the stand and its foot
    // must stay out of every line of text and every panel on screen, with `copyMarginPx` of air,
    // from the landing of the pull out on the stage (J 2.25: the whole subject is in frame) to the end
    // of Tickets.
    const standPts = [0.9, 0.75, 0.6, 0.45, 0.3, 0.15].map((k) => new Vector3(SPINE.x, STAND_TOP_Y * k, SPINE.z));
    const subjectPts: [string, Vector3][] = [['head', head], ['barrel', barrel], ['tail', tail], ...standPts.map((P, i) => [`stand${i}`, P] as [string, Vector3]), ['foot', foot]];
    const copyHits: { J: number; part: string; kind: string; box: number[] }[] = [];
    let copyMin = Infinity;
    let copyMinAt = 0;
    let copySteps = 0;
    const copyPts: Record<string, number[][]> = {};
    let copyRun = 0;
    let copyRunAt = 0;
    if (opts.copy) {
      const airPx = opts.copyMarginPx ?? (portrait ? 8 : MOTION_LIMITS.copyAirPx);
      const mx = airPx / window.innerWidth;
      const my = airPx / window.innerHeight;
      // Landscape: every kind of copy; portrait: headings, buttons and panels (body text is checked
      // for legibility on the rendered frames).
      const counts = (k: CopyBox[4]) => !portrait || k !== 't';
      let run = 0;
      for (const key of Object.keys(opts.copy).sort((a, b) => +a - +b)) {
        const boxes = opts.copy[key];
        const J = +key;
        if (J < MOTION_LIMITS.copyJ[0] - 1e-9 || J > MOTION_LIMITS.copyJ[1] + 1e-9) continue;
        const f = at(J);
        if (!f) continue;
        copySteps++;
        copyPts[key] = subjectPts.map(([, P]) => {
          const q = scr(f, P);
          return [+q.x.toFixed(4), +q.y.toFixed(4)];
        });
        // The stand drawn as a line: the sampled points plus points between them.
        const pts: [string, { x: number; y: number; z: number }][] = [];
        subjectPts.forEach(([part, P], i) => {
          const q = scr(f, P);
          pts.push([part, q]);
          if (i >= 3) {
            const q0 = scr(f, subjectPts[i - 1][1]);
            for (const t of [0.25, 0.5, 0.75]) pts.push([part, { x: q0.x + (q.x - q0.x) * t, y: q0.y + (q.y - q0.y) * t, z: q.z }]);
          }
        });
        let hitHere = false;
        // Portrait: a step where the band veil has taken the subject down does not count.
        const veiled = portrait && f.band >= MOTION_LIMITS.portraitVeil;
        for (const [part, q] of pts) {
          if (q.z <= 0 || q.x < 0 || q.x > 1 || q.y < 0 || q.y > 1) continue;
          for (const b of boxes) {
            if (!counts(b[4])) continue;
            // Air (px) between the point and the box, negative inside.
            const ax = Math.max(b[0] - q.x, q.x - b[2]) * window.innerWidth;
            const ay = Math.max(b[1] - q.y, q.y - b[3]) * window.innerHeight;
            const air = ax < 0 && ay < 0 ? Math.max(ax, ay) : Math.hypot(Math.max(0, ax), Math.max(0, ay));
            if (air < copyMin) [copyMin, copyMinAt] = [air, J];
            // A panel's edge is not copy: a little air (`copyPanelAirPx`) is enough there.
            const k = b[4] === 'p' ? Math.min(1, MOTION_LIMITS.copyPanelAirPx / airPx) : 1;
            if (!hitHere && !veiled && q.x > b[0] - mx * k && q.x < b[2] + mx * k && q.y > b[1] - my * k && q.y < b[3] + my * k) {
              copyHits.push({ J, part, kind: b[4], box: b.slice(0, 4) as number[] });
              hitHere = true;
            }
          }
        }
        run = hitHere ? run + 1 : 0;
        if (run > copyRun) [copyRun, copyRunAt] = [run, J];
      }
      if (!portrait && copyHits.length)
        fails.push(`copy: subject within ${airPx}px of copy at ${copyHits.length} of ${copySteps} steps (first J${copyHits[0].J} ${copyHits[0].part} ${copyHits[0].kind})`);
      if (portrait && (copyRun > MOTION_LIMITS.portraitRun || copyHits.length > MOTION_LIMITS.portraitShare * copySteps))
        fails.push(`copy: subject behind headings / buttons / panels at ${copyHits.length} of ${copySteps} steps, longest run ${copyRun} ending J${copyRunAt}`);
    }
    // The speaker's view (MOTION_LIMITS.speakerJ): the camera stands behind the microphone (upstage
    // of the stand, at a speaker's eye height), the seats fill the frame (most of the 100 seats in
    // frame, spread across most of its width) and the grille sits in the foreground band: at one
    // side of the frame, much closer than the nearest seat.
    // With the page's edges (`edge`: where the page below Tickets starts on screen at each step, from
    // `ticketsEnd()`), the grille must also sit at least `speakerEdgeAir` above it: below that the
    // next band's background covers the frame and the speaker's view would lose its foreground.
    const speaker: { J: number; seatsIn: number; seatSpan: number; head: number[]; headM: number; seatM: number; camY: number; upstageM: number; edge?: number }[] = [];
    const speakerJ = portrait ? L.speakerJPortrait : L.speakerJ;
    for (let J = speakerJ[0]; J <= speakerJ[1] + 1e-9; J += 0.05) {

      const f = at(J);
      if (!f) continue;
      let n = 0;
      let x0 = 1;
      let x1 = 0;
      let seatM = Infinity;
      const cam = new Vector3(...f.pos);
      for (const P of SEAT_POINTS) {
        const q = scr(f, P);
        seatM = Math.min(seatM, cam.distanceTo(P));
        if (!inFrame(q)) continue;
        n++;
        x0 = Math.min(x0, q.x);
        x1 = Math.max(x1, q.x);
      }
      const h = scr(f, head);
      // Upstage: the camera on the far side of the stand from the house (house space z < 0).
      const upstage = -toHouse(cam.clone().sub(new Vector3(SPINE.x, 0, SPINE.z))).z;
      const row = { J: +J.toFixed(3), seatsIn: n, seatSpan: +Math.max(0, x1 - x0).toFixed(3), head: [+h.x.toFixed(3), +h.y.toFixed(3)], headM: +cam.distanceTo(head).toFixed(3), seatM: +seatM.toFixed(2), camY: +f.pos[1].toFixed(3), upstageM: +upstage.toFixed(3) };
      speaker.push(row);
      const why: string[] = [];
      const minSeats = portrait ? L.speakerSeatsPortrait : L.speakerSeats;
      if (n < minSeats) why.push(`${n} seats in frame < ${minSeats}`);
      if (row.seatSpan < L.speakerSeatSpan) why.push(`seats span ${row.seatSpan} of the width < ${L.speakerSeatSpan}`);
      const side = Math.min(h.x, 1 - h.x) <= L.speakerHeadSide || h.y >= 1 - L.speakerHeadSide;
      if (!inFrame(h) || !side) why.push(`grille at [${row.head}], not within ${L.speakerHeadSide} of a side or the foot of the frame`);
      if (row.headM > L.speakerHeadNear * seatM) why.push(`grille ${row.headM} m away, not in the foreground (nearest seat ${row.seatM} m)`);
      if (upstage < 0.2) why.push(`camera ${row.upstageM} m upstage of the stand, not behind the microphone`);
      if (row.camY < L.speakerEye[0] || row.camY > L.speakerEye[1]) why.push(`camera ${row.camY} m high, not at a speaker's eye height`);
      // Against the page's edge the grille is judged with the page at rest (the rig settled at J): it
      // rides up with the page, and behind a page that is still scrolling it trails a little, as the
      // whole camera does.
      const edge = opts.edge?.[J.toFixed(3)];
      if (edge !== undefined) {
        const rest = scr(api.run({ js: Array(240).fill(J), drift: false, content: opts.content, portrait }).at(-1)!, head);
        Object.assign(row, { edge, restY: +rest.y.toFixed(3) });
        if (rest.y > edge - L.speakerEdgeAir) why.push(`grille at y ${rest.y.toFixed(3)} (page at rest), under the page below Tickets (starts at ${edge})`);
      }

      if (why.length) fails.push(`speaker's view J${row.J}: ${why.join('; ')}`);
    }
    // With the copy boxes: once the speaker's view has arrived (`speakerClear`), the grille's disc on
    // screen, with the page at rest at each step, keeps `speakerCopyAirPx` from every line of text on
    // the page: the seat counter's numerals, the ruler's numbers and the caption. (The sweep above
    // trails the page by a few hundredths of J, as the camera does behind a scrolling page; here the
    // rig is settled, as it is for a visitor who has stopped to look.)
    // Phones: the counter runs the full width and scrolls up through the whole frame, so the grille
    // has to cross its ruler and caption once on the way down (`speakerClearPortrait` to about 5.8).
    // There it must either keep that air or be taken down: the microphone's own light (key plus rim)
    // at most `speakerDimPortrait`, a dark shape behind the text.
    const speakerCopy: { J: number; airPx: number; grille: number[]; lit: number; dim: boolean }[] = [];
    if (opts.copy) {
      const sideways = sidewaysPhone(window.innerWidth, window.innerHeight);
      const from = portrait ? L.speakerClearPortrait : sideways ? L.speakerClearSideways : L.speakerClear;
      for (const key of Object.keys(opts.copy).sort((a, b) => +a - +b)) {
        const J = +key;
        if (J < from - 1e-9 || J > 5.96) continue;
        const f = api.run({ js: Array(240).fill(J), drift: false, content: opts.content, portrait }).at(-1)!;
        const q = scr(f, head);
        const rPx = (MIC.grilleR / (q.z * 2 * Math.tan((f.fov * Math.PI) / 360))) * window.innerHeight;
        let air = Infinity;
        for (const b of opts.copy[key]) {
          if (b[4] === 'p') continue;
          const dx = Math.max(b[0] - q.x, 0, q.x - b[2]) * window.innerWidth;
          const dy = Math.max(b[1] - q.y, 0, q.y - b[3]) * window.innerHeight;
          air = Math.min(air, Math.hypot(dx, dy) - rPx);
        }
        // The same on a phone on its side (the landscape move, sidewaysPhone), whose counter is laid out like a phone's.
        const dim = (portrait || sideways) && f.lit <= L.speakerDimPortrait;
        speakerCopy.push({ J, airPx: +air.toFixed(1), grille: [+q.x.toFixed(3), +q.y.toFixed(3), +rPx.toFixed(1)], lit: f.lit, dim });
        if (air < L.speakerCopyAirPx && !dim)
          fails.push(`speaker's view J${J}: the grille is ${air.toFixed(0)} px from the copy (at least ${L.speakerCopyAirPx}), at [${q.x.toFixed(3)}, ${q.y.toFixed(3)}]${portrait || sideways ? `, and lit (${f.lit}, at most ${L.speakerDimPortrait} to pass behind text)` : ''}`);
      }
    }
    // Near plane against the scene's surfaces (< 1 would clip).
    let minClr = Infinity;
    let clrAt = '';
    for (const f of F) if (f.clr < minClr) [minClr, clrAt] = [f.clr, `${f.obj}@J${f.J}`];
    if (minClr < 1) fails.push(`clearance ${minClr} at ${clrAt}`);
    // Air between the camera and the back curtain's folds (world z = CURTAIN_Z) over the stage: the
    // near plane can shrink to pass close to it, but a crane that grazes the curtain is one edit away
    // from passing through it.
    let curtainM = Infinity;
    let curtainAt = 0;
    for (const f of F) if (f.J >= 3 && f.J <= 6 && f.pos[2] - CURTAIN_Z < curtainM) [curtainM, curtainAt] = [f.pos[2] - CURTAIN_Z, f.J];
    if (curtainM < MOTION_LIMITS.curtainAir) fails.push(`curtain: camera ${curtainM.toFixed(3)} m from the back curtain at J${curtainAt} < ${MOTION_LIMITS.curtainAir}`);
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      limits: MOTION_LIMITS,
      perBeat,
      liveness: { longestStillRun: longest, endsAtJ: longestAt },
      monotonic: mono,
      descent,
      orbitDeg: { at2_5: orbitAt(2.5), at3: orbitAt(3), at4: orbitAt(4), at5: orbitAt(5), at5_5: orbitAt(5.5), at6: orbitAt(6) },
      heightM: { at2_5: +at(2.5).pos[1].toFixed(2), at3: +at(3).pos[1].toFixed(2), at4: +at(4).pos[1].toFixed(2), at4_9: +at(4.9).pos[1].toFixed(2), at5_5: +at(5.5).pos[1].toFixed(2), at6: +at(6).pos[1].toFixed(2) },
      subjectM: { at2_5: +sd(at(2.5)).toFixed(2), at3: +sd(at(3)).toFixed(2), at4: +sd(at(4)).toFixed(2), at4_9: +sd(at(4.9)).toFixed(2), at5_5: +sd(at(5.5)).toFixed(2), at6: +sd(at(6)).toFixed(2) },
      frame: { ...frame, xMin: +frame.xMin.toFixed(3), xMax: +frame.xMax.toFixed(3), yMin: +frame.yMin.toFixed(3), yMax: +frame.yMax.toFixed(3) },
      clearance: { min: minClr, at: clrAt },
      curtain: { minM: +curtainM.toFixed(3), atJ: curtainAt },
      speaker,
      speakerCopy,
      copy: opts.copy
 ? { steps: copySteps, hits: copyHits, longestRun: copyRun, longestRunAtJ: copyRunAt, minAirPx: +copyMin.toFixed(1), minAirAtJ: copyMinAt, points: copyPts } : null,
      steps,
      /** Where the subject sits on screen (fractions from the left / top) at a few positions. */
      subjectAt: Array.from({ length: 31 }, (_, i) => 2.25 + i * 0.125).map((J) => {
        const f = at(J);
        const r = (P: Vector3) => {
          const q = scr(f, P);
          return [+q.x.toFixed(3), +q.y.toFixed(3)];
        };
        return { J, head: r(head), barrel: r(barrel), tail: r(tail), foot: r(foot), dist: +new Vector3(...f.pos).distanceTo(new Vector3(...f.tgt)).toFixed(3) };
      }),
      fails,
      /**
       * The failures that are about where the subject is (in frame, clear of the copy, the speaker's
       * view, the near plane), without the pace rules: what a sweep with a held pointer is judged by
       * (the pace rules describe the authored move, measured with the reaction off).
       */
      placeFails: fails.filter((f) => /^(frame|copy|speaker's view|clearance)/.test(f)),
      pass: fails.length === 0,
    };
  };
  const full = { ...api, metrics, motion };
  (window as unknown as { __sceneSim?: typeof full }).__sceneSim = full;
}
