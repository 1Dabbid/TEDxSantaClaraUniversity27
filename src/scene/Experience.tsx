'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { FogExp2, Object3D, Vector3, type PerspectiveCamera, type SpotLight } from 'three';
import type { Quality } from '@/lib/quality';
import {
  AWAY_SHOT,
  AWAY_SHOT_PORTRAIT,
  DARK_FROM,
  DESKTOP_SHOTS,
  PORTRAIT_SHOTS,
  emptyShot,
  journey,
  resolveShot,
  resolveShots,
  sampleShots,
} from './choreography';
import { Damped, DampedVec3 } from './damp';
import { createStudioEnvironment } from './environment';
import { micPoint } from './choreography';
import { look } from './look';
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

function createRig() {
  return {
    sample: emptyShot(),
    pos: new DampedVec3(),
    target: new DampedVec3(),
    up: new DampedVec3(),
    fov: new Damped(30),
    exposure: new Damped(0),
    dof: new Damped(0),
    cone: new Damped(1),
    spot: new Damped(1),
    envRot: new Damped(0),
    key: new Damped(1),
    vig: new Damped(0.6),
    shade: new Damped(0),
    px: new Damped(0),
    py: new Damped(0),
    J: new Damped(0),
    started: false,
    tmpA: new Vector3(),
    tmpB: new Vector3(),
    tmpC: new Vector3(),
    right: new Vector3(),
    fwd: new Vector3(),
    keyA: new Vector3(),
    keyB: new Vector3(),
    keyCam: new Damped(0),
    camUp: new Vector3(),
    perfT: 0,
    perfFrames: 0,
    perfBad: 0,
    darkFrames: 0,
    lastMeasure: 0,
  };
}
type Rig = ReturnType<typeof createRig>;

const searchFlag = (k: string) => {
  try {
    return new URLSearchParams(window.location.search).get(k);
  } catch {
    return null;
  }
};

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

  const rigRef = useRef<Rig | null>(null);

  const keyLight = useRef<SpotLight>(null);
  const keyTarget = useMemo(() => {
    const o = new Object3D();
    o.position.copy(micPoint(0.1));
    return o;
  }, []);
  const adaptive = searchFlag('perf') !== 'off';
  const debug = searchFlag('scene-debug') !== null;
  const envOffset = debug ? Number(searchFlag('envrot') ?? 0) : 0;
  const keyMul = debug ? Number(searchFlag('keymul') ?? 1) : 1;

  useFrame((state, rawDt) => {
    const rig = (rigRef.current ??= createRig());
    const camera = state.camera as PerspectiveCamera;
    const scene = state.scene;
    const dt = Math.min(rawDt, 0.1);
    const t = state.clock.elapsedTime;

    if (t - rig.lastMeasure > 2) {
      rig.lastMeasure = t;
      if (Object.keys(metrics.heights).length === 0) measureSections();
    }

    const J = currentJourney();
    const s = J < 0 ? away : sampleShots(shots, rig.J.step(J, 0.12, dt), rig.sample);
    if (J < 0) rig.J.snap(0);

    // Critically damped follow.
    const st = 0.65;
    if (!rig.started) {
      rig.started = true;
      rig.pos.snap(s.pos);
      rig.target.snap(s.target);
      rig.up.snap(s.up);
      rig.fov.snap(s.fov);
      rig.dof.snap(s.dof);
      rig.cone.snap(s.cone);
      rig.spot.snap(s.spot);
      rig.key.snap(s.key);
      rig.vig.snap(s.vignette);
    }
    const pos = rig.pos.step(s.pos, st, dt, rig.tmpA);
    const target = rig.target.step(s.target, st * 0.9, dt, rig.tmpB);
    const up = rig.up.step(s.up, st, dt, rig.tmpC).normalize();
    look.fov = rig.fov.step(s.fov, st, dt);
    look.exposure = Math.max(0, rig.exposure.step(s.exposure, rig.started && t < 1.5 ? 0.9 : 0.5, dt));
    look.dof = rig.dof.step(s.dof, 0.5, dt);
    look.cone = rig.cone.step(s.cone, 0.6, dt);
    look.spot = rig.spot.step(s.spot, 0.6, dt);
    look.key = rig.key.step(s.key, 0.6, dt);
    look.vignette = rig.vig.step(s.vignette, 0.6, dt);
    look.shade = rig.shade.step(s.shade, 0.6, dt);

    // Idle drift + pointer parallax, in camera space.
    const dist = pos.distanceTo(target);
    rig.fwd.subVectors(target, pos).normalize();
    rig.right.crossVectors(rig.fwd, up).normalize();
    rig.camUp.crossVectors(rig.right, rig.fwd).normalize();
    const px = rig.px.step(scrollState.pointer.x, 0.9, dt);
    const py = rig.py.step(scrollState.pointer.y, 0.9, dt);
    const dx = Math.sin(t * 0.21) * 0.6 + Math.sin(t * 0.13 + 1.7) * 0.4;
    const dy = Math.sin(t * 0.17 + 0.6) * 0.6 + Math.sin(t * 0.07) * 0.4;
    const ox = dx * s.drift + px * s.parallax;
    const oy = dy * s.drift * 0.6 + py * s.parallax * 0.6;
    camera.position.copy(pos).addScaledVector(rig.right, ox).addScaledVector(rig.camUp, oy);
    camera.up.copy(up);
    camera.lookAt(target);
    const near = Math.min(0.2, Math.max(0.002, dist * 0.12));
    if (Math.abs(camera.near - near) > 1e-5 || Math.abs(camera.fov - look.fov) > 1e-3) {
      camera.near = near;
      camera.far = 90;
      camera.fov = look.fov;
      camera.updateProjectionMatrix();
    }

    // Key light sweeps slowly across the mic; environment strips drift.
    const k = keyLight.current;
    if (k) {
      // Orbiting sweep (hero) blended with a camera-riding position (macro glints).
      const a = 0.9 + Math.sin(t * 0.11) * 0.55;
      const kp = keyTarget.position;
      rig.keyA.set(kp.x + Math.sin(a) * 2.2, kp.y + 1.3 + Math.sin(t * 0.07) * 0.3, kp.z + Math.cos(a) * 2.2);
      const sweep = -0.18 + Math.sin(t * 0.23) * 0.22;
      rig.keyB
        .copy(camera.position)
        .addScaledVector(rig.camUp, dist * (0.9 + 0.3 * Math.sin(t * 0.17)))
        .addScaledVector(rig.right, dist * sweep);
      const kc = rig.keyCam.step(s.keyCam, 0.6, dt);
      k.position.lerpVectors(rig.keyA, rig.keyB, kc);
      k.angle = 0.1 + kc * 0.5;
      k.intensity = keyMul * 11 * look.key * k.position.distanceToSquared(kp);
    }
    scene.environmentRotation.set(0, Math.sin(t * 0.045) * 0.3 + rig.envRot.step(s.envRot + envOffset, 0.8, dt), 0);

    // Darkness: stop the loop once fully faded (the wake listener restarts it).
    if (look.exposure < 0.004 && s.exposure === 0) {
      rig.darkFrames++;
      if (rig.darkFrames > 3 && !sleeping.current) {
        look.dark = true;
        sleeping.current = true;
        setFrameloop('never');
      }
    } else rig.darkFrames = 0;

    if (debug) {
      const w = window as unknown as { __scene?: Record<string, unknown> };
      const prev = (w.__scene?.frame as number) ?? 0;
      w.__scene = { J, frame: prev + 1, exposure: look.exposure, step, tier, post, dt: rawDt };
    }

    // Adaptive quality: step down when sustained frame time is poor.
    if (adaptive && step < 4) {
      rig.perfT += rawDt;
      rig.perfFrames++;
      if (rig.perfT > 1.5) {
        const fps = rig.perfFrames / rig.perfT;
        rig.perfBad = fps < 46 ? rig.perfBad + 1 : 0;
        rig.perfT = 0;
        rig.perfFrames = 0;
        if (rig.perfBad >= 2 && t > 4) {
          rig.perfBad = 0;
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
        color="#f4f1ec"
      />
      {/* Cool rim from upstage: outlines seat backs and the stand */}
      {/* Backlight from high upstage: rims the stand and the tops of the seat backs seen from the rear */}
      <directionalLight position={[0, 7, -8]} intensity={0.8} color="#dfe5f2" />
      <Microphone quality={tier} />
      <Stage quality={tier} />
      <Seats quality={tier} />
    </>
  );
}
