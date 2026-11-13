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
  type Group,
  type Mesh,
  type PerspectiveCamera,
  type ShaderMaterial,
  type SpotLight,
} from 'three';
import type { Quality } from '@/lib/quality';
import {
  AWAY_SHOT,
  AWAY_SHOT_PORTRAIT,
  DARK_FROM,
  journey,
  micPoint,
  resolveShot,
  resolveShots,
  shotsFor,
  type ShotOptions,
} from './choreography';
import { createStudioEnvironment } from './environment';
import type { EngravingFacts } from './engraving';
import { look } from './look';
import { createRig, createRigOut, stepRig } from './rig';
import { createHazeMaterial, createMotesMaterial, shared } from './materials';
import Microphone from './Microphone';
import Post from './Post';
import Seats from './Seats';
import Stage, { reflected } from './Stage';
import Venue from './Venue';
import { SECTION_IDS, scrollState, type SectionId } from './scrollState';
import { MIC_AXIS } from './layout';

const Y_AXIS = new Vector3(0, 1, 0);

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
  const key = `${opts.speakersTba ? 1 : 0}:${opts.scheduleScale.toFixed(2)}`;
  if (key !== contentKey) {
    contentKey = key;
    contentListeners.forEach((f) => f());
  }
}
function contentOptions(): ShotOptions {
  const sched = metrics.heights.schedule;
  // The orbit was authored for a schedule about 1.45 viewports tall.
  const scheduleScale = sched ? Math.min(1, Math.max(0.4, sched / (1.45 * metrics.vh))) : 1;
  return { speakersTba: !!document.querySelector('.speakers-runway--tba'), scheduleScale };
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
    perfT: 0,
    perfFrames: 0,
    perfBad: 0,
    darkFrames: 0,
    lastMeasure: 0,
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
 * spot, 100 seats, one camera driven by scroll. Rendering is owned by <Post>.
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

  const portrait = size.width / Math.max(1, size.height) < 0.9;
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
  const motesRef = useRef<Group>(null);

  const adaptive = searchFlag('perf') !== 'off';
  const debug = searchFlag('scene-debug') !== null;
  const snap = debug && searchFlag('snap') !== null;
  const envOffset = debug ? Number(searchFlag('envrot') ?? 0) : 0;
  const keyMul = debug ? Number(searchFlag('keymul') ?? 1) : 1;
  // Debug: ?scene-debug=1&cam=px,py,pz,tx,ty,tz overrides the camera (world metres).
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
    const o = stepRig(
      fs.rig,
      shots,
      away,
      { J, dt, t, pointerX: scrollState.pointer.x, pointerY: scrollState.pointer.y, snap, camOverride, aspect: state.size.width / Math.max(1, state.size.height) },
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
    const s = o.s;
    const target = o.target;
    const dist = o.dist;
    camera.position.copy(o.position);
    camera.up.copy(o.up);
    camera.lookAt(target);
    // The subject's fixed place on screen is a lens shift (an off-centre frustum), never a turn.
    const ox = 0.5 - o.shiftX;
    const oy = 0.5 - o.shiftY;
    const v = camera.view;
    const shiftChanged = !v || !v.enabled || Math.abs(v.offsetX - ox) > 1e-6 || Math.abs(v.offsetY - oy) > 1e-6;
    if (shiftChanged || Math.abs(camera.near - o.near) > 1e-5 || Math.abs(camera.fov - look.fov) > 1e-3) {
      camera.near = o.near;
      camera.far = 90;
      camera.fov = look.fov;
      camera.setViewOffset(1, 1, ox, oy, 1, 1);
    }

    // Key light: in wide shots it sweeps slowly on the camera side of the mic
    // (the barrel streak travels); in macro it rides the camera as a raking light.
    const k = keyLight.current;
    if (k) {
      const kp = KEY_AIM;
      const a = 0.45 + Math.sin(t * 0.11) * 0.6;
      fs.keyA
        .copy(kp)
        .addScaledVector(o.fwd, -2.2 * Math.cos(a))
        .addScaledVector(o.right, 2.2 * Math.sin(a))
        .addScaledVector(o.camUp, 1.25 + Math.sin(t * 0.07) * 0.25);
      const sweep = Math.sin(t * 0.19) * 0.12;
      fs.keyB
        .copy(camera.position)
        .addScaledVector(o.right, dist * o.keyDir.x)
        .addScaledVector(o.camUp, dist * (o.keyDir.y + sweep))
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
    // Rim light: behind the subject, offset around the view axis.
    shared.uRimDir.value
      .copy(o.fwd)
      .multiplyScalar(-0.6)
      .addScaledVector(o.camUp, Math.cos(o.rimAng) * 0.8)
      .addScaledVector(o.right, Math.sin(o.rimAng) * 0.8)
      .normalize();
    shared.uRimColor.value.copy(RIM_COLOR).multiplyScalar(look.rim * 1.5);
    shared.uSpot.value = look.spot;
    shared.uCone.value = look.cone;
    shared.uTime.value = t;
    scene.environmentIntensity = o.env;
    // The studio strips turn slowly about the vertical (idle life) and, per shot, about the barrel:
    // the camera never circles the mic, so the streak is walked round the barrel instead.
    fs.qa.setFromAxisAngle(Y_AXIS, Math.sin(t * 0.045) * 0.3);
    fs.qb.setFromAxisAngle(MIC_AXIS, o.envRot + envOffset);
    scene.environmentRotation.setFromQuaternion(fs.qa.multiply(fs.qb));

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
      m.visible = look.motes > 0.01;
      m.position.copy(camera.position);
      m.quaternion.copy(camera.quaternion);
      m.scale.setScalar(dist);
      const u = ((m.children[0] as Mesh).material as ShaderMaterial).uniforms;
      const ty = Math.tan((look.fov * Math.PI) / 360);
      u.uTime.value = t;
      u.uIntensity.value = look.motes;
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
      w.__scene = { J, frame: prev + 1, exposure: look.exposure, step, tier, post, dt: rawDt, scene };
    }

    // Adaptive quality: step down when sustained frame time is poor.
    if (adaptive && step < 4) {
      fs.perfT += rawDt;
      fs.perfFrames++;
      if (fs.perfT > 1.5) {
        const fps = fs.perfFrames / fs.perfT;
        fs.perfBad = fps < 46 ? fs.perfBad + 1 : 0;
        fs.perfT = 0;
        fs.perfFrames = 0;
        if (fs.perfBad >= 2 && t > 4) {
          fs.perfBad = 0;
          setStep((v) => v + 1);
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
      <directionalLight position={[0, 7, -8]} intensity={0.3} color="#dfe5f2" onUpdate={reflected} />
      <Microphone quality={tier} engraving={engraving} />
      <Stage quality={tier} />
      <Seats quality={tier} />
      <Venue />
      <mesh ref={hazeRef} geometry={fx.hazeGeo} material={fx.haze} renderOrder={4} frustumCulled={false} />
      <group ref={motesRef}>
        <points geometry={fx.motesGeo} material={fx.motes} renderOrder={10} frustumCulled={false} />
      </group>
    </>
  );
}
