'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  FogExp2,
  HalfFloatType,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
  WebGLRenderTarget,
  UnsignedByteType,
  type DirectionalLight,
  type Group,
  type Mesh,
  type PerspectiveCamera,
  type ShaderMaterial,
  type SpotLight,
} from 'three';
import type { Quality } from '@/lib/quality';
import { SCENE_SLOW_EVENT } from '@/lib/motion-pref';
import {
  AWAY_SHOT,
  AWAY_SHOT_PORTRAIT,
  DARK_FROM,
  journey,
  micPoint,
  portraitFraming,
  sidewaysPhone,
  resolveShot,
  resolveShots,
  shotsFor,
  type ShotOptions,
} from './choreography';
import { createStudioEnvironment } from './environment';
import type { EngravingFacts } from './engraving';
import { look } from './look';
import { measureHeroX, measureHeroY, measureSpeakersX, measureWideCopy, measureTicketsRoom, measureTicketsX, measureVenueX } from './contentLayout';
import { createRig, createRigOut, REACT, scrollKickFor, stepRig } from './rig';
import { createHazeMaterial, createMotesMaterial, shared } from './materials';
import { houseLights, houseSeatsLit } from './houseLights';
import { STRIKE, createStrike, stepStrike } from './lampStrike';
import { Damped } from './damp';
import Microphone from './Microphone';
import Post from './Post';
import Seats from './Seats';
import Stage, { reflected } from './Stage';
import Venue from './Venue';
import { SECTION_IDS, scrollState, type SectionId } from './scrollState';
import { HOUSE_AZ, HOUSE_SEATS, MIC_AXIS } from './layout';
import { createTilt, tiltLive, watchTilt } from './tilt';

const Y_AXIS = new Vector3(0, 1, 0);
/** The house axis (world, horizontal): from the stage out towards the seats (layout.ts, HOUSE_AZ). */
const HOUSE_DIR_X = Math.sin(HOUSE_AZ);
const HOUSE_DIR_Z = Math.cos(HOUSE_AZ);
/** Cool backlight from high upstage (rims the stand and the tops of the seat backs seen from the rear). */
const BACKLIGHT = 0.3;
const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

type Tier = 'high' | 'low';

/** Section heights (px) for the journey coordinate. Re-measured on resize / route change. */
const metrics: { heights: Partial<Record<SectionId, number>>; vh: number } = { heights: {}, vh: 1 };
/** Page content that changes the choreography (speakers announced or not, a short schedule). */
let contentKey = '';
const contentListeners = new Set<() => void>();
function measureSections() {
  metrics.vh = window.innerHeight || 1;
  metrics.heights = {};
  for (const id of SECTION_IDS) {
    const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (el) metrics.heights[id] = el.getBoundingClientRect().height;
  }
  const opts = contentOptions();
  const key = `${opts.speakersTba ? 1 : 0}:${opts.scheduleScale.toFixed(2)}:${opts.speakersX ?? ''}:${opts.venueX ?? ''}:${opts.ticketsX ?? ''}:${opts.heroX ?? ''}:${opts.heroY ?? ''}:${opts.wideCopy ? 1 : 0}${opts.sideways ? 1 : 0}:${opts.aspect?.toFixed(2) ?? ''}:${opts.ticketsRoom ? Object.values(opts.ticketsRoom).join(',') : ''}`;
  if (key !== contentKey) {
    contentKey = key;
    contentListeners.forEach((f) => f());
  }
}
function contentOptions(): ShotOptions {
  const sched = metrics.heights.schedule;
  // The orbit was authored for a schedule about 1.45 viewports tall.
  const scheduleScale = sched ? Math.min(1, Math.max(0.4, sched / (1.45 * metrics.vh))) : 1;
  // The frame's shape is part of the content key: the held stand over Tickets (Move.hold) depends on
  // it, and a change of height alone (devtools, the browser bar) changes no measured x.
  const aspect = +(window.innerWidth / Math.max(1, window.innerHeight)).toFixed(2);
  return { speakersTba: !!document.querySelector('.speakers-runway--tba'), scheduleScale, speakersX: measureSpeakersX(), venueX: measureVenueX(), ticketsX: measureTicketsX(), heroX: measureHeroX(), heroY: measureHeroY(), wideCopy: measureWideCopy(), sideways: sidewaysPhone(window.innerWidth, window.innerHeight), aspect, ticketsRoom: measureTicketsRoom() };
}
const currentJourney = () => journey(scrollState.sections, metrics.heights, metrics.vh);

const KEY_COLOR = new Color('#f6f2ec');
const RIM_COLOR = new Color('#e4ecf8');
const MOTE_COUNT = 64;
/** Where the wide-shot key light aims (middle of the engraved band). */
const KEY_AIM = micPoint(0.1);

/** Per-frame scratch owned by Experience (key light placement, perf, darkness). */
function createState() {
  return {
    rig: createRig(),
    out: createRigOut(),
    keyA: new Vector3(),
    keyB: new Vector3(),
    qa: new Quaternion(),
    qb: new Quaternion(),
    qc: new Quaternion(),
    perfT: 0,
    perfFrames: 0,
    perfBad: 0,
    /** Windows in a row that stayed slow at the last step; 'done' once the stills were asked for. */
    perfSlow: 0 as number | 'done',
    darkFrames: 0,
    lastMeasure: 0,
    strike: createStrike(),
    /** House seats lit (damped: each seat warms up like a filament). */
    seatsLit: new Damped(0),
    /** look.houseView, damped (a camera turning to face the house thins the beam over a moment). */
    houseView: new Damped(0),
    /** Touch screens: last scroll position (px; NaN until the first frame) and the smoothed kick. */
    scrollY: NaN,
    kick: 0,
  };
}
type FrameState = ReturnType<typeof createState>;

const searchFlag = (k: string) => {
  try {
    return new URLSearchParams(window.location.search).get(k);
  } catch {
    return null;
  }
};

function motesGeometry() {
  const pos = new Float32Array(MOTE_COUNT * 3);
  const seed = new Float32Array(MOTE_COUNT * 4);
  let s = 4242;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < MOTE_COUNT; i++) {
    pos.set([rnd() * 2 - 1, rnd() * 2 - 1, 0], i * 3);
    seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('seed', new BufferAttribute(seed, 4));
  return g;
}

/**
 * The whole scene: microphone on its stand, the red rug under an overhead
 * spot, 100 seats (lit one by one with the Tickets counter), one camera
 * driven by scroll. Rendering is owned by <Post>.
 */
export default function Experience({
  quality,
  pathname = '/',
  engraving,
}: {
  quality: Exclude<Quality, 'static'>;
  pathname?: string;
  /** Optional facts engraved on the barrel (date, venue, seats, ...); defaults to engraving.ts. */
  engraving?: Partial<EngravingFacts>;
}) {
  const get = useThree((s) => s.get);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const setDpr = useThree((s) => s.setDpr);
  const size = useThree((s) => s.size);

  // Adaptive tier: 0 = as requested; each step down trades resolution, then post.
  const [step, setStep] = useState(0);
  const tier: Tier = quality === 'high' && step < 3 ? 'high' : 'low';
  const post = quality === 'high' && step < 2 && searchFlag('post') !== '0';

  // Device pixel ratio, re-read when the window moves to a screen with another density.
  const [deviceDpr, setDeviceDpr] = useState(() => window.devicePixelRatio || 1);
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    const onChange = () => {
      setDeviceDpr(window.devicePixelRatio || 1);
      arm();
    };
    const arm = () => {
      mq?.removeEventListener('change', onChange);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener('change', onChange);
    };
    arm();
    return () => mq?.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const base = quality === 'high' ? Math.min(2, deviceDpr) : Math.min(1.5, deviceDpr);
    const scale = [1, 0.8, 0.7, 0.66, 0.6][Math.min(step, 4)];
    setDpr(Math.max(1, base * scale));
  }, [quality, step, setDpr, deviceDpr]);

  // WebGL context loss: stop and hide; on restore rebuild what lives only on the
  // GPU (the PMREM environment; render targets are redrawn every frame and
  // textures re-upload from their sources), then resume if the canvas is shown.
  const [contextGen, setContextGen] = useState(0);
  const lost = useRef(false);
  const sleeping = useRef(false);
  useEffect(() => {
    const canvas = get().gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      lost.current = true;
      sleeping.current = true;
      setFrameloop('never');
      canvas.style.visibility = 'hidden';
    };
    const onRestored = () => {
      lost.current = false;
      canvas.style.visibility = '';
      setContextGen((g) => g + 1);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [get, setFrameloop]);

  // Environment, fog, renderer setup.
  useEffect(() => {
    const { gl, scene } = get();
    let env: ReturnType<typeof createStudioEnvironment> | null = null;
    try {
      env = createStudioEnvironment(gl);
    } catch {
      env = null; // no reflections rather than no scene
    }
    scene.environment = env;
    scene.environmentIntensity = 1;
    scene.fog = new FogExp2('#000000', 0.03);
    return () => {
      scene.environment = null;
      scene.fog = null;
      env?.dispose();
    };
  }, [get, contextGen]);

  // Compile every program up front, including objects that are hidden until
  // later in the journey (beam, dust, haze, motes), so no shader compiles
  // mid-scroll. Shader error checks (a sync driver round trip) stay dev-only.
  useEffect(() => {
    const { gl, scene, camera } = get();
    gl.debug.checkShaderErrors = process.env.NODE_ENV !== 'production';
    const hidden: Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    // With post (and the floor reflection) every scene program draws into an
    // HDR target, which selects the variant without tone mapping: compile that one.
    const prev = gl.getRenderTarget();
    const half = gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float');
    const probe = post ? new WebGLRenderTarget(1, 1, { type: half ? HalfFloatType : UnsignedByteType }) : null;
    if (probe) gl.setRenderTarget(probe);
    gl.compileAsync(scene, camera).catch(() => {});
    gl.setRenderTarget(prev);
    probe?.dispose();
    for (const o of hidden) o.visible = false;
  }, [get, tier, post, contextGen]);

  // Section metrics.
  useEffect(() => {
    measureSections();
    const t1 = setTimeout(measureSections, 120);
    const t2 = setTimeout(measureSections, 800);
    const ro = new ResizeObserver(() => measureSections());
    ro.observe(document.body);
    window.addEventListener('resize', measureSections);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener('resize', measureSections);
    };
  }, [pathname]);

  // Stop rendering when dark or hidden; wake on scroll / route / visibility.
  // Never wake a canvas that is not on screen: off the home page SceneGate keeps
  // it mounted but hidden (data-hidden) and paused, and a lost context stays paused.
  useEffect(() => {
    const canvas = get().gl.domElement;
    const shown = () =>
      !lost.current && !canvas.closest('[data-hidden]') && getComputedStyle(canvas).visibility !== 'hidden';
    const wake = () => {
      if (document.hidden || !shown()) {
        sleeping.current = true;
        setFrameloop('never');
        return;
      }
      const J = currentJourney();
      if (J < DARK_FROM - 0.02 || J < 0) {
        look.dark = false;
        if (sleeping.current) {
          sleeping.current = false;
          setFrameloop('always');
        }
      }
    };
    const onVis = () => {
      if (!document.hidden) {
        // Re-evaluate from scratch on return.
        sleeping.current = true;
        look.dark = false;
      }
      wake();
    };
    // scrollState is written on the smooth-scroll ticker, which can lag the
    // native scroll event; a cheap poll while asleep catches every case.
    const poll = window.setInterval(() => {
      if (sleeping.current && !document.hidden && shown()) wake();
    }, 200);
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake);
    document.addEventListener('visibilitychange', onVis);
    wake();
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [get, setFrameloop, pathname, contextGen]);

  const portrait = portraitFraming(size.width, size.height);
  const [content, setContent] = useState(() => contentKey);
  useEffect(() => {
    const on = () => setContent(contentKey);
    contentListeners.add(on);
    on();
    return () => {
      contentListeners.delete(on);
    };
  }, []);
  const shots = useMemo(() => {
    void content;
    return resolveShots(shotsFor(portrait, contentOptions()));
  }, [portrait, content]);
  const away = useMemo(() => resolveShot(portrait ? AWAY_SHOT_PORTRAIT : AWAY_SHOT), [portrait]);

  const stateRef = useRef<FrameState | null>(null);

  // The scene reacts to the visitor: the pointer, or on phones the tilt of the device (never asked
  // for: where it needs a permission no events arrive), or else a slow automatic sway (rig.ts, REACT).
  const tilt = useMemo(() => createTilt(), []);
  const coarse = useMemo(() => {
    try {
      return window.matchMedia('(hover: none), (pointer: coarse)').matches;
    } catch {
      return false;
    }
  }, []);
  // Only touch screens listen for tilt: with a mouse the pointer leads.
  useEffect(() => (coarse ? watchTilt(tilt) : undefined), [tilt, coarse]);

  // Debug: transition simulator over the same rig and shots (?scene-debug=1).
  const shotsRef = useRef({ shots, away });
  useEffect(() => {
    shotsRef.current = { shots, away };
  }, [shots, away]);
  useEffect(() => {
    if (searchFlag('scene-debug') === null) return;
    let live = true;
    import('./debugSim').then((m) => live && m.installSim(() => shotsRef.current));
    return () => {
      live = false;
    };
  }, []);

  const keyLight = useRef<SpotLight>(null);
  const keyTarget = useMemo(() => {
    const o = new Object3D();
    o.position.copy(micPoint(0.1));
    return o;
  }, []);

  // Atmosphere behind the subject, dust motes in front of the lens.
  const fx = useMemo(
    () => ({
      hazeGeo: new PlaneGeometry(1, 1),
      haze: createHazeMaterial(),
      motesGeo: motesGeometry(),
      motes: createMotesMaterial(),
    }),
    [],
  );
  useEffect(
    () => () => {
      fx.hazeGeo.dispose();
      fx.haze.dispose();
      fx.motesGeo.dispose();
      fx.motes.dispose();
    },
    [fx],
  );
  const hazeRef = useRef<Mesh>(null);
  const backRef = useRef<DirectionalLight>(null);
  const motesRef = useRef<Group>(null);

  const adaptive = searchFlag('perf') !== 'off';
  const forceSlow = searchFlag('perf') === 'slow';
  const handOver = forceSlow || searchFlag('quality') === null;
  const debug = searchFlag('scene-debug') !== null;
  const snap = debug && searchFlag('snap') !== null;
  const envOffset = debug ? Number(searchFlag('envrot') ?? 0) : 0;
  const keyMul = debug ? Number(searchFlag('keymul') ?? 1) : 1;
  // Debug: ?scene-debug=1&cam=px,py,pz,tx,ty,tz[,fov] puts the camera at that point looking at that
  // target (world metres; rig.ts), whatever the scroll; the look still follows the journey.
  const camOverride = debug ? (searchFlag('cam')?.split(',').map(Number) ?? null) : null;

  useFrame((state, rawDt) => {
    const fs = (stateRef.current ??= createState());
    const camera = state.camera as PerspectiveCamera;
    const scene = state.scene;
    const dt = Math.min(rawDt, 0.1);
    const t = state.clock.elapsedTime;

    if (t - fs.lastMeasure > 2) {
      fs.lastMeasure = t;
      if (Object.keys(metrics.heights).length === 0) measureSections();
    }

    const J = currentJourney();
    const tl = tiltLive(tilt);
    // Touch screens: the scroll speed swings the room a little (a hand on the page moves the view
    // even without tilt). Reads the scroll position only; no allocation.
    if (coarse) {
      const y = window.scrollY;
      const v = Number.isFinite(fs.scrollY) && dt > 1e-4 ? (y - fs.scrollY) / dt : 0;
      fs.scrollY = y;
      fs.kick += (scrollKickFor(v) - fs.kick) * (1 - Math.exp(-dt / REACT.scrollKickSmooth));
      if (!Number.isFinite(fs.kick)) fs.kick = 0;
    }
    const o = stepRig(
      fs.rig,
      shots,
      away,
      {
        J,
        dt,
        t,
        pointerX: tl ? tilt.x : scrollState.pointer.x,
        pointerY: tl ? tilt.y : scrollState.pointer.y,
        snap,
        camOverride,
        aspect: state.size.width / Math.max(1, state.size.height),
        react: camOverride ? 0 : 1,
        // Tilt where it is trusted, handing over to the sway as the phone nears upright.
        sway: coarse ? (tl ? 1 - tilt.weight : 1) : 0,
        kick: coarse ? fs.kick : 0,
        portrait,
      },
      look,
      fs.out,
    );
    // Debug: window.__sceneTune = { key: 0.9, envRot: 0.3, keyDir: [1, 2, 0.3], ... } overrides the
    // sampled look values live (only with ?scene-debug=1), for tuning a shot without a rebuild.
    if (debug) {
      const tune = (window as unknown as { __sceneTune?: Record<string, number | number[]> }).__sceneTune;
      if (tune) {
        const lk = look as unknown as Record<string, number>;
        const ok = o as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(tune)) {
          if (Array.isArray(v)) {
            if (k === 'keyDir') o.keyDir.set(v[0], v[1], v[2]);
          } else if (k in lk) lk[k] = v;
          else if (typeof ok[k] === 'number') ok[k] = v;
        }
      }
    }
    // The overhead spot strikes as the camera draws back off the microphone (lampStrike.ts): dimmer before,
    // one soft overshoot of the spot, its shaft, the haze it catches and the bloom, then a settle on
    // the clock. Rides on the authored look, never written back into the rig.
    // Debug: window.__strikeAge = seconds holds the strike at that age (filmstrips of the strike).
    const hold = debug ? (window as unknown as { __strikeAge?: number }).__strikeAge : undefined;
    const st = stepStrike(fs.strike, o.Js, t, dt, typeof hold === 'number' ? hold : undefined);
    const pre = 1 - (1 - st.on) * smoothstep(1.7, 1.95, o.Js);
    if (pre < 1 || st.env > 0) {
      look.spot *= pre * (1 + STRIKE.spot * st.env);
      look.cone *= pre * (1 + STRIKE.cone * st.env);
      look.bloom *= 1 + STRIKE.bloom * st.env;
      look.haze += STRIKE.haze * st.env;
    }
    // Looking out at the house from the stage (look.houseView): the beam, its dust and the haze card
    // thin out so they do not veil the seats. From the camera's heading and focus distance (a wide view,
    // never a close-up of the microphone), so it needs no shot keys.
    const hx = o.fwd.x * HOUSE_DIR_X + o.fwd.z * HOUSE_DIR_Z;
    const hxz = Math.hypot(o.fwd.x, o.fwd.z);
    const facing = hxz > 1e-4 ? smoothstep(0.3, 0.8, hx / hxz) * smoothstep(1.0, 2.5, o.dist) : 0;
    look.houseView = fs.houseView.step(facing, 0.4, dt);
    if (look.houseView > 0.001) {
      look.cone *= 1 - 0.92 * look.houseView;
      look.haze *= 1 - 0.92 * look.houseView;
    }
    // The cool backlight rims the seat backs for a camera behind the house; seen from the stage it
    // would light their fronts a flat blue-grey over the warm seat lamps.
    if (backRef.current) backRef.current.intensity = BACKLIGHT * (1 - 0.75 * look.houseView);
    // The house lights follow the Tickets seat counter (houseLights.ts). Without a running counter the
    // house fills on its own over the end of Tickets. Never before Tickets (a phone's counter plays
    // once and stays full), and held up while the stage light goes down after it, then out with it.
    const cap = houseLights.capacity;
    const count = houseLights.count ?? smoothstep(5.55, 5.9, o.Js) * cap;
    const litTarget = houseSeatsLit(count, cap, HOUSE_SEATS) * smoothstep(4.7, 5.0, o.Js);
    const lit = fs.seatsLit.step(litTarget, 0.12, dt);
    shared.uSeatLit.value = lit < 0.01 ? 0 : lit;
    shared.uHouseFill.value = lit / HOUSE_SEATS;
    shared.uSeatGain.value = 1 / Math.max(look.exposure, 0.75);
    const s = o.s;
    const target = o.target;
    const dist = o.dist;
    camera.position.copy(o.position);
    camera.up.copy(o.up);
    camera.lookAt(target);
    // The subject's fixed place on screen is a lens shift (an off-centre frustum), never a turn.
    // setViewOffset sets camera.aspect = fullWidth / fullHeight, so the "full view" must be the
    // canvas in pixels (a unit square would draw every frame through a square frustum).
    const vw = Math.max(1, state.size.width);
    const vh = Math.max(1, state.size.height);
    const ox = 0.5 - o.shiftX;
    const oy = 0.5 - o.shiftY;
    const v = camera.view;
    const shiftChanged =
      !v ||
      !v.enabled ||
      v.fullWidth !== vw ||
      v.fullHeight !== vh ||
      Math.abs(v.offsetX / v.fullWidth - ox) > 1e-6 ||
      Math.abs(v.offsetY / v.fullHeight - oy) > 1e-6 ||
      Math.abs(camera.aspect - vw / vh) > 1e-6;
    if (shiftChanged || Math.abs(camera.near - o.near) > 1e-5 || Math.abs(camera.fov - look.fov) > 1e-3) {
      camera.near = o.near;
      camera.far = 90;
      camera.fov = look.fov;
      camera.setViewOffset(vw, vh, ox * vw, oy * vh, vw, vh);
    }

    // Key light: in wide shots it sweeps slowly on the camera side of the mic
    // (the barrel streak travels); in macro it rides the camera as a raking light.
    const k = keyLight.current;
    if (k) {
      const kp = KEY_AIM;
      // The pointer walks the key a little round the subject: the chrome glints travel with the hand.
      const a = 0.45 + Math.sin(t * 0.11) * 0.6 + o.px * 0.35;
      fs.keyA
        .copy(kp)
        .addScaledVector(o.fwd, -2.2 * Math.cos(a))
        .addScaledVector(o.right, 2.2 * Math.sin(a))
        .addScaledVector(o.camUp, 1.25 + Math.sin(t * 0.07) * 0.25 + o.py * 0.3);
      const sweep = Math.sin(t * 0.19) * 0.12;
      fs.keyB
        .copy(camera.position)
        .addScaledVector(o.right, dist * (o.keyDir.x + o.px * 0.22))
        .addScaledVector(o.camUp, dist * (o.keyDir.y + sweep + o.py * 0.16))
        .addScaledVector(o.fwd, dist * o.keyDir.z);
      const kc = o.keyCam;
      k.position.lerpVectors(fs.keyA, fs.keyB, kc);
      k.target.position.lerpVectors(kp, target, kc);
      k.angle = 0.1 + kc * 0.5;
      const illum = keyMul * 11 * look.key;
      k.intensity = illum * k.position.distanceToSquared(k.target.position);
      shared.uKeyPos.value.copy(k.position);
      shared.uKeyColor.value.copy(KEY_COLOR).multiplyScalar(illum);
    }
    // Rim light: behind the subject, offset around the view axis (and nudged round it by the pointer).
    const rimAng = o.rimAng + o.px * 0.4;
    shared.uRimDir.value
      .copy(o.fwd)
      .multiplyScalar(-0.6 + o.py * 0.12)
      .addScaledVector(o.camUp, Math.cos(rimAng) * 0.8)
      .addScaledVector(o.right, Math.sin(rimAng) * 0.8)
      .normalize();
    shared.uRimColor.value.copy(RIM_COLOR).multiplyScalar(look.rim * 1.5);
    shared.uSpot.value = look.spot;
    shared.uCone.value = look.cone;
    shared.uTime.value = t;
    scene.environmentIntensity = o.env;
    // The studio strips turn slowly about the vertical (idle life) and, per shot, about the barrel:
    // the camera never circles the mic, so the streak is walked round the barrel instead.
    // The pointer turns them a little too, so the reflections slide over the chrome with the hand.
    fs.qa.setFromAxisAngle(Y_AXIS, Math.sin(t * 0.045) * 0.3 + o.px * 0.16);
    fs.qb.setFromAxisAngle(MIC_AXIS, o.envRot + envOffset);
    fs.qc.setFromAxisAngle(o.right, -o.py * 0.08);
    scene.environmentRotation.setFromQuaternion(fs.qc.multiply(fs.qa).multiply(fs.qb));

    // Haze card behind the subject, facing the camera.
    const h = hazeRef.current;
    if (h) {
      h.visible = look.haze > 0.005;
      h.position.copy(target).addScaledVector(o.fwd, dist * 1.6);
      h.quaternion.copy(camera.quaternion);
      const sc = dist * 3.4 * Math.tan((look.fov * Math.PI) / 360) * 2;
      h.scale.set(sc * 1.4, sc, 1);
      const u = (h.material as ShaderMaterial).uniforms;
      u.uIntensity.value = look.haze * 0.11;
      u.uTime.value = t;
    }
    // Motes ride the camera, scaled to the focus distance.
    const m = motesRef.current;
    if (m) {
      // Where the shot has no beam to carry dust (the hero), a few motes float in the haze instead:
      // high tier only, so the low tier keeps the draw call off where the shot asks for no motes.
      const heroMotes = tier === 'high' ? look.haze * 0.55 * Math.max(0, 1 - look.cone * 4) : 0;
      const motes = Math.max(look.motes, heroMotes);
      m.visible = motes > 0.01;
      m.position.copy(camera.position);
      m.quaternion.copy(camera.quaternion);
      m.scale.setScalar(dist);
      const u = ((m.children[0] as Mesh).material as ShaderMaterial).uniforms;
      const ty = Math.tan((look.fov * Math.PI) / 360);
      u.uTime.value = t;
      u.uIntensity.value = motes;
      u.uTanY.value = ty;
      u.uTanX.value = ty * (state.size.width / Math.max(1, state.size.height));
      u.uScale.value = (state.size.height * state.viewport.dpr * 0.5) / ty;
    }

    // Darkness: stop the loop once fully faded (the wake listener restarts it).
    if (look.exposure < 0.004 && s.exposure === 0) {
      fs.darkFrames++;
      if (fs.darkFrames > 3 && !sleeping.current) {
        look.dark = true;
        sleeping.current = true;
        setFrameloop('never');
      }
    } else fs.darkFrames = 0;

    if (debug) {
      const w = window as unknown as { __scene?: Record<string, unknown> };
      const prev = (w.__scene?.frame as number) ?? 0;
      w.__scene = {
        J,
        frame: prev + 1,
        exposure: look.exposure,
        step,
        tier,
        post,
        dt: rawDt,
        scene,
        strike: st.env,
        lampOn: st.on,
        seatsLit: lit,
        houseView: look.houseView,
        react: { px: o.px, py: o.py, lagX: o.lagX, lagY: o.lagY, roll: o.roll, tilt: tl, sway: coarse && !tl, kick: fs.kick },
        cam: [camera.position.x, camera.position.y, camera.position.z, target.x, target.y, target.z],
      };
    }

    // Adaptive quality: step down when sustained frame time is poor. At the last step, if the
    // scene is still clearly slow for several windows in a row, ask for the still frames instead
    // (SceneGate hides and pauses the canvas). It takes four slow windows in a row, so a hiccup
    // or a tab coming back (the loop sleeps while hidden, and the clock restarts on waking) never
    // adds up to that. Not under a forced `?quality=`; `?perf=slow` reads every window as slow (tests).
    if (adaptive && (step < 4 || (handOver && fs.perfSlow !== 'done'))) {
      fs.perfT += rawDt;
      fs.perfFrames++;
      if (fs.perfT > (forceSlow ? 0.3 : 1.5)) {
        const fps = forceSlow ? 0 : fs.perfFrames / fs.perfT;
        fs.perfT = 0;
        fs.perfFrames = 0;
        if (step < 4) {
          fs.perfBad = fps < 46 ? fs.perfBad + 1 : 0;
          if (fs.perfBad >= 2 && t > 4) {
            fs.perfBad = 0;
            setStep((v) => v + 1);
          }
        } else if (fs.perfSlow !== 'done') {
          fs.perfSlow = fps < 24 && t > 4 ? fs.perfSlow + 1 : 0;
          if (fs.perfSlow >= 4) {
            fs.perfSlow = 'done';
            window.dispatchEvent(new Event(SCENE_SLOW_EVENT));
          }
        }
      }
    }
  });

  return (
    <>
      <Post post={post} reflect={tier === 'high'} />
      <primitive object={keyTarget} />
      <spotLight
        ref={keyLight}
        onUpdate={reflected}
        target={keyTarget}
        angle={0.09}
        penumbra={0.9}
        decay={2}
        distance={0}
        intensity={9}
        color="#f6f2ec"
      />
      {/* Cool backlight from high upstage: rims the stand and the tops of the seat backs seen from the rear */}
      <directionalLight ref={backRef} position={[0, 7, -8]} intensity={BACKLIGHT} color="#dfe5f2" onUpdate={reflected} />
      <Microphone quality={tier} engraving={engraving} />
      <Stage quality={tier} />
      {/* The house lies downstage of the microphone, facing the speaker's view at the end of the orbit (layout.ts, HOUSE_AZ). */}
      <group rotation={[0, HOUSE_AZ, 0]}>
        <Seats quality={tier} />
        <Venue quality={tier} />
      </group>
      <mesh ref={hazeRef} geometry={fx.hazeGeo} material={fx.haze} renderOrder={4} frustumCulled={false} />
      <group ref={motesRef}>
        <points geometry={fx.motesGeo} material={fx.motes} renderOrder={10} frustumCulled={false} />
      </group>
    </>
  );
}
