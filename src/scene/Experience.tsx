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
  RIG,
  emptyShot,
  journey,
  micPoint,
  resolveShot,
  resolveShots,
  sampleShots,
} from './choreography';
import { Damped, DampedVec3, SpringVec3 } from './damp';
import { createStudioEnvironment } from './environment';
import { look } from './look';
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

function createRig() {
  return {
    sample: emptyShot(),
    pos: new DampedVec3(),
    target: new SpringVec3(),
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
    rim: new Damped(1),
    rimAng: new Damped(0.5),
    haze: new Damped(0),
    motes: new Damped(0),
    focusX: new Damped(0.5),
    focusY: new Damped(0.5),
    scrim: new Damped(0),
    bloom: new Damped(1),
    env: new Damped(1),
    roll: new Damped(0),
    keyDir: new DampedVec3(),
    px: new Damped(0),
    py: new Damped(0),
    J: new Damped(0),
    started: false,
    tmpA: new Vector3(),
    tmpB: new Vector3(),
    tmpC: new Vector3(),
    tmpD: new Vector3(),
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
    if (snap) rig.J.snap(Math.max(0, J));
    const s = J < 0 ? away : sampleShots(shots, rig.J.step(J, RIG.journeySmooth, dt), rig.sample);
    if (J < 0) rig.J.snap(0);
    if (camOverride && camOverride.length === 6) {
      s.pos.set(camOverride[0], camOverride[1], camOverride[2]);
      s.target.set(camOverride[3], camOverride[4], camOverride[5]);
      s.up.set(0, 1, 0);
    }

    // Position: critically damped. Look-at: under-damped (overshoot + settle).
    const st = RIG.follow;
    if (!rig.started || snap) {
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
      rig.rim.snap(s.rim);
      rig.rimAng.snap(s.rimAng);
      rig.haze.snap(s.haze);
      rig.motes.snap(s.motes);
      rig.focusX.snap(s.focusX);
      rig.focusY.snap(s.focusY);
      rig.scrim.snap(s.scrim);
      rig.bloom.snap(s.bloom);
      rig.env.snap(s.env);
      rig.keyDir.snap(s.keyDir);
      rig.keyCam.snap(s.keyCam);
      rig.shade.snap(s.shade);
      if (snap) rig.exposure.snap(s.exposure);
    }
    const pos = rig.pos.step(s.pos, st, dt, rig.tmpA);
    const target = rig.target.step(s.target, RIG.targetFreq, RIG.targetZeta, dt, rig.tmpB);
    const up = rig.up.step(s.up, st, dt, rig.tmpC).normalize();
    look.fov = rig.fov.step(s.fov, st, dt);
    look.exposure = Math.max(0, rig.exposure.step(s.exposure, rig.started && t < 1.5 ? 0.9 : 0.5, dt));
    look.dof = rig.dof.step(s.dof, 0.5, dt);
    look.cone = Math.max(0, rig.cone.step(s.cone, 0.6, dt));
    look.spot = Math.max(0, rig.spot.step(s.spot, 0.6, dt));
    look.key = rig.key.step(s.key, 0.6, dt);
    look.vignette = rig.vig.step(s.vignette, 0.6, dt);
    look.shade = rig.shade.step(s.shade, 0.6, dt);
    look.rim = Math.max(0, rig.rim.step(s.rim, 0.6, dt));
    look.haze = Math.max(0, rig.haze.step(s.haze, 0.6, dt));
    look.motes = Math.max(0, rig.motes.step(s.motes, 0.6, dt));
    look.focusX = rig.focusX.step(s.focusX, 0.6, dt);
    look.focusY = rig.focusY.step(s.focusY, 0.6, dt);
    look.scrim = Math.max(0, rig.scrim.step(s.scrim, 0.6, dt));
    look.bloom = rig.bloom.step(s.bloom, 0.6, dt);
    const rimAng = rig.rimAng.step(s.rimAng, 0.6, dt);
    const keyDir = rig.keyDir.step(s.keyDir, 0.8, dt, rig.tmpD);

    // Camera basis, idle drift (slow breathing), pointer parallax with weight, bank into lateral moves.
    const dist = Math.max(1e-3, pos.distanceTo(target));
    rig.fwd.subVectors(target, pos).normalize();
    rig.right.crossVectors(rig.fwd, up).normalize();
    rig.camUp.crossVectors(rig.right, rig.fwd).normalize();
    const lateral =
      (rig.pos.x.velocity * rig.right.x + rig.pos.y.velocity * rig.right.y + rig.pos.z.velocity * rig.right.z) / dist;
    const roll = rig.roll.step(Math.max(-RIG.rollMax, Math.min(RIG.rollMax, -lateral * RIG.rollGain)), 0.35, dt);
    const px = rig.px.step(scrollState.pointer.x, 1.1, dt);
    const py = rig.py.step(scrollState.pointer.y, 1.1, dt);
    const dx = Math.sin(t * 0.21) * 0.6 + Math.sin(t * 0.13 + 1.7) * 0.4;
    const dy = Math.sin(t * 0.17 + 0.6) * 0.6 + Math.sin(t * 0.07) * 0.4;
    const breathe = 1 + Math.sin(t * 0.31) * 0.004 * (s.drift > 0 ? 1 : 0);
    const ox = dx * s.drift + px * s.parallax;
    const oy = dy * s.drift * 0.6 + py * s.parallax * 0.6;
    camera.position
      .copy(target)
      .addScaledVector(rig.fwd, -dist * breathe)
      .addScaledVector(rig.right, ox)
      .addScaledVector(rig.camUp, oy);
    // Roll the up vector about the view axis.
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    camera.up.copy(rig.camUp).multiplyScalar(cr).addScaledVector(rig.right, sr);
    camera.lookAt(target);
    const near = Math.min(0.2, Math.max(0.002, dist * 0.12));
    if (Math.abs(camera.near - near) > 1e-5 || Math.abs(camera.fov - look.fov) > 1e-3) {
      camera.near = near;
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
      rig.keyA
        .copy(kp)
        .addScaledVector(rig.fwd, -2.2 * Math.cos(a))
        .addScaledVector(rig.right, 2.2 * Math.sin(a))
        .addScaledVector(rig.camUp, 1.25 + Math.sin(t * 0.07) * 0.25);
      const sweep = Math.sin(t * 0.19) * 0.12;
      rig.keyB
        .copy(camera.position)
        .addScaledVector(rig.right, dist * keyDir.x)
        .addScaledVector(rig.camUp, dist * (keyDir.y + sweep))
        .addScaledVector(rig.fwd, dist * keyDir.z);
      const kc = rig.keyCam.step(s.keyCam, 0.6, dt);
      k.position.lerpVectors(rig.keyA, rig.keyB, kc);
      k.target.position.lerpVectors(kp, target, kc);
      k.angle = 0.1 + kc * 0.5;
      const illum = keyMul * 11 * look.key;
      k.intensity = illum * k.position.distanceToSquared(k.target.position);
      shared.uKeyPos.value.copy(k.position);
      shared.uKeyColor.value.copy(KEY_COLOR).multiplyScalar(illum);
    }
    // Rim light: behind the subject, offset around the view axis.
    shared.uRimDir.value
      .copy(rig.fwd)
      .multiplyScalar(-0.6)
      .addScaledVector(rig.camUp, Math.cos(rimAng) * 0.8)
      .addScaledVector(rig.right, Math.sin(rimAng) * 0.8)
      .normalize();
    shared.uRimColor.value.copy(RIM_COLOR).multiplyScalar(look.rim * 1.5);
    shared.uSpot.value = look.spot;
    shared.uCone.value = look.cone;
    shared.uTime.value = t;
    scene.environmentIntensity = Math.max(0, rig.env.step(s.env, 0.6, dt));
    scene.environmentRotation.set(0, Math.sin(t * 0.045) * 0.3 + rig.envRot.step(s.envRot + envOffset, 0.8, dt), 0);

    // Haze card behind the subject, facing the camera.
    const h = hazeRef.current;
    if (h) {
      h.visible = look.haze > 0.005;
      h.position.copy(target).addScaledVector(rig.fwd, dist * 1.6);
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
      w.__scene = { J, frame: prev + 1, exposure: look.exposure, step, tier, post, dt: rawDt, scene };
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
