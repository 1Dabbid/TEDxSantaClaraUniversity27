'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  FogExp2,
  Object3D,
  PlaneGeometry,
  Vector3,
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
  DESKTOP_SHOTS,
  PORTRAIT_SHOTS,
  journey,
  micPoint,
  resolveShot,
  resolveShots,
} from './choreography';
import { createStudioEnvironment } from './environment';
import { look } from './look';
import { createRig, createRigOut, stepRig } from './rig';
import { createHazeMaterial, createMotesMaterial, shared } from './materials';
import Microphone from './Microphone';
import Post from './Post';
import Seats from './Seats';
import Stage from './Stage';
import { SECTION_IDS, scrollState, type SectionId } from './scrollState';

type Tier = 'high' | 'low';

/** Section heights (px) for the journey coordinate. Re-measured on resize / route change. */
const metrics: { heights: Partial<Record<SectionId, number>>; vh: number } = { heights: {}, vh: 1 };
function measureSections() {
  metrics.vh = window.innerHeight || 1;
  metrics.heights = {};
  for (const id of SECTION_IDS) {
    const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (el) metrics.heights[id] = el.getBoundingClientRect().height;
  }
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
export default function Experience({ quality, pathname = '/' }: { quality: Exclude<Quality, 'static'>; pathname?: string }) {
  const get = useThree((s) => s.get);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const setDpr = useThree((s) => s.setDpr);
  const size = useThree((s) => s.size);

  // Adaptive tier: 0 = as requested; each step down trades resolution, then post.
  const [step, setStep] = useState(0);
  const tier: Tier = quality === 'high' && step < 3 ? 'high' : 'low';
  const post = quality === 'high' && step < 2 && searchFlag('post') !== '0';

  useEffect(() => {
    const base = quality === 'high' ? Math.min(2, window.devicePixelRatio || 1) : Math.min(1.5, window.devicePixelRatio || 1);
    const scale = [1, 0.8, 0.7, 0.66, 0.6][Math.min(step, 4)];
    setDpr(Math.max(1, base * scale));
  }, [quality, step, setDpr]);

  // Environment, fog, renderer setup.
  useEffect(() => {
    const { gl, scene } = get();
    const env = createStudioEnvironment(gl);
    scene.environment = env;
    scene.environmentIntensity = 1;
    scene.fog = new FogExp2('#000000', 0.03);
    return () => {
      scene.environment = null;
      scene.fog = null;
      env.dispose();
    };
  }, [get]);

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
    gl.compileAsync(scene, camera).catch(() => {});
    for (const o of hidden) o.visible = false;
  }, [get, tier]);

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
  const sleeping = useRef(false);
  useEffect(() => {
    const wake = () => {
      if (document.hidden) {
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
      if (sleeping.current && !document.hidden) wake();
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
  }, [setFrameloop, pathname]);

  const portrait = size.width / Math.max(1, size.height) < 0.9;
  const shots = useMemo(() => resolveShots(portrait ? PORTRAIT_SHOTS : DESKTOP_SHOTS), [portrait]);
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
      { J, dt, t, pointerX: scrollState.pointer.x, pointerY: scrollState.pointer.y, snap, camOverride },
      look,
      fs.out,
    );
    const s = o.s;
    const target = o.target;
    const dist = o.dist;
    camera.position.copy(o.position);
    camera.up.copy(o.up);
    camera.lookAt(target);
    if (Math.abs(camera.near - o.near) > 1e-5 || Math.abs(camera.fov - look.fov) > 1e-3) {
      camera.near = o.near;
      camera.far = 90;
      camera.fov = look.fov;
      camera.updateProjectionMatrix();
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
    scene.environmentRotation.set(0, Math.sin(t * 0.045) * 0.3 + o.envRot + envOffset, 0);

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
      <Post post={post} />
      <primitive object={keyTarget} />
      <spotLight
        ref={keyLight}
        target={keyTarget}
        angle={0.09}
        penumbra={0.9}
        decay={2}
        distance={0}
        intensity={9}
        color="#f6f2ec"
      />
      {/* Cool backlight from high upstage: rims the stand and the tops of the seat backs seen from the rear */}
      <directionalLight position={[0, 7, -8]} intensity={0.3} color="#dfe5f2" />
      <Microphone quality={tier} />
      <Stage quality={tier} />
      <Seats quality={tier} />
      <mesh ref={hazeRef} geometry={fx.hazeGeo} material={fx.haze} renderOrder={4} frustumCulled={false} />
      <group ref={motesRef}>
        <points geometry={fx.motesGeo} material={fx.motes} renderOrder={10} frustumCulled={false} />
      </group>
    </>
  );
}
