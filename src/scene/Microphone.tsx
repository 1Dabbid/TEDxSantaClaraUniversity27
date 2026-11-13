'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CatmullRomCurve3,
  CylinderGeometry,
  Matrix4,
  Quaternion,
  Shape,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Group,
  type Texture,
} from 'three';
import { bevelledExtrude, machinedLathe, mergeParts, roundedBox, threadProfile, type ProfilePoint } from './geometry';
import {
  MIC,
  MIC_POSITION,
  MIC_QUATERNION,
  PIVOT_WORLD,
  RUG_RADIUS,
  STAND_BASE,
  STAND_TOP_Y,
  VIEW_AZ,
  barrelRadius,
  micToWorld,
} from './layout';
import {
  createBodyMaterial,
  createCableMaterial,
  createGrilleMaterial,
  createHardwareMaterial,
  createNickelMaterial,
  createPolishedMaterial,
} from './materials';
import { REFLECT_LAYER } from './reflection';
import { engravingRows, type EngravingFacts } from './engraving';
import { EMPTY_MASK, createEngravingMask } from './textures';

/** Body profile: tail, knurled grip, tapered barrel with two seam lines, neck under the band ring. */
function bodyProfile(taperSteps: number): ProfilePoint[] {
  const p: ProfilePoint[] = [
    // Tail: recessed connector face, inner and outer chamfers
    [0, 0.0045, true],
    [0.0082, 0.0045, true],
    [0.0082, 0.0013, true],
    [0.0094, 0.0, true],
    [0.0112, 0.0, true],
    [0.0122, 0.001, true],
    [0.0124, 0.0095, true],
    // Groove, knurled grip, groove
    [0.0118, 0.0101, true],
    [0.0118, 0.0111, true],
    [MIC.knurlR, 0.0117, true],
    [MIC.knurlR, 0.03, true],
    [0.0118, 0.0306, true],
    [0.0118, 0.0316, true],
    [0.0129, 0.0326, true],
  ];
  // Tapered barrel with fine V seams (one under the clip, one under the band ring).
  const seams = [0.0492, 0.1024];
  const sw = 0.00045;
  for (let i = 0; i <= taperSteps; i++) {
    const y = MIC.taperY[0] + ((MIC.taperY[1] - MIC.taperY[0]) * i) / taperSteps;
    const next = MIC.taperY[0] + ((MIC.taperY[1] - MIC.taperY[0]) * (i + 1)) / taperSteps;
    p.push([barrelRadius(y), y, i === 0 || i === taperSteps]);
    for (const s of seams) {
      if (s > y && s <= next && i < taperSteps) {
        p.push(
          [barrelRadius(s - sw), s - sw, true],
          [barrelRadius(s) - 0.00028, s, true],
          [barrelRadius(s + sw), s + sw, true],
        );
      }
    }
  }
  p.push([0.0189, 0.1043, true], [0.0189, 0.1056, true], [0, 0.1056]);
  return p;
}

const RING_PROFILE: ProfilePoint[] = [
  [0.0186, 0.105, true],
  [0.0199, 0.1054],
  [0.0204, 0.1061],
  [0.0206, 0.1072, true],
  [0.0206, 0.1086, true],
  [0.02, 0.1089, true],
  [0.02, 0.1093, true],
  [0.0206, 0.1096, true],
  [0.0206, 0.1106],
  [0.0204, 0.1117],
  [0.0199, 0.1124],
  [0.0191, 0.1128, true],
  [0.0, 0.1128],
];

function grilleProfile(steps: number): ProfilePoint[] {
  const R = MIC.grilleR;
  const c = MIC.grilleC;
  const thetaMax = Math.PI - Math.asin(0.02 / R);
  const p: ProfilePoint[] = [[0.0195, 0.1118]];
  for (let i = 0; i <= steps; i++) {
    const th = thetaMax * (1 - i / steps);
    p.push([R * Math.sin(th), c + R * MIC.grilleSquash * Math.cos(th)]);
  }
  return p;
}

function standBaseProfile(): ProfilePoint[] {
  return [
    [0, 0.0006, true],
    [0.142, 0.0006, true],
    [0.149, 0.004],
    [0.1505, 0.009],
    [0.148, 0.0135, true],
    [0.118, 0.0175],
    [0.06, 0.021],
    [0.03, 0.0245, true],
    [0.017, 0.028, true],
    [0.017, 0.052, true],
    [0.0132, 0.055, true],
    [0, 0.055],
  ];
}

function clutchProfile(): ProfilePoint[] {
  return [
    [0.0098, 0.0, true],
    [0.0148, 0.003, true],
    [0.0158, 0.008, true],
    [0.0158, 0.044, true],
    [0.0145, 0.05, true],
    [0.0082, 0.054, true],
    [0, 0.054],
  ];
}

/** Closed rectangular section with chamfers, as a lathe loop (r0/r1: inner radius at bottom/top). */
function ringSection(ri0: number, ri1: number, t: number, y0: number, y1: number, ch: number): ProfilePoint[] {
  return [
    [ri0, y0 + ch, true],
    [ri0 + ch, y0, true],
    [ri0 + t - ch, y0, true],
    [ri0 + t, y0 + ch, true],
    [ri1 + t, y1 - ch, true],
    [ri1 + t - ch, y1, true],
    [ri1 + ch, y1, true],
    [ri1, y1 - ch, true],
    [ri0, y0 + ch, true],
  ];
}

/** Basis of the clip yoke: upright (world Y), hinge axis = mic Z (horizontal). */
const MIC_Z = new Vector3(0, 0, 1).applyQuaternion(MIC_QUATERNION);
const YOKE_Q = (() => {
  const y = new Vector3(0, 1, 0);
  const z = MIC_Z.clone();
  const x = new Vector3().crossVectors(y, z).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
})();

/**
 * Mic clip, mic space: tapered C-cradle open on top (+X), rounded ends, arm to
 * the hinge knuckle under the barrel (-X).
 */
function clipGeometry(high: boolean) {
  const seg = high ? 96 : 40;
  const y0 = MIC.clipY - 0.0075;
  const y1 = MIC.clipY + 0.0075;
  const ri0 = barrelRadius(y0) + 0.0003;
  const ri1 = barrelRadius(y1) + 0.0003;
  const t = 0.0021;
  const gap = 0.62;
  const start = Math.PI / 2 + gap;
  const len = Math.PI * 2 - gap * 2;
  const parts: BufferGeometry[] = [
    machinedLathe(ringSection(ri0, ri1, t, y0, y1, 0.0006), seg, { phiStart: start, phiLength: len }),
  ];
  // Rounded lips at both open ends.
  for (const a of [start, start + len]) {
    const rm = (ri0 + ri1) / 2 + t / 2;
    const lip = new CylinderGeometry(t * 0.62, t * 0.62, y1 - y0 - 0.0008, high ? 16 : 8);
    lip.translate(Math.sin(a) * rm, MIC.clipY, Math.cos(a) * rm);
    parts.push(lip);
  }
  // Arm from the cradle to the knuckle, with a stiffening rib.
  const arm = roundedBox(0.0135, 0.0118, 0.0088, 0.0018, high ? 3 : 2);
  arm.translate(-0.0222, MIC.clipY, 0);
  parts.push(arm);
  const rib = roundedBox(0.008, 0.004, 0.0035, 0.0012, 2);
  rib.translate(-0.0175, MIC.clipY - 0.0072, 0);
  parts.push(rib);
  // Hinge knuckle (centre leaf), axis along mic Z.
  const knuckle = machinedLathe(
    [
      [0, -0.0042, true],
      [0.0058, -0.0042, true],
      [0.0064, -0.0036, true],
      [0.0064, 0.0036, true],
      [0.0058, 0.0042, true],
      [0, 0.0042],
    ],
    high ? 40 : 20,
  );
  knuckle.rotateX(Math.PI / 2);
  knuckle.translate(MIC.pivot.x, MIC.pivot.y, 0);
  parts.push(knuckle);
  return mergeParts(parts);
}

/**
 * Yoke, in the upright yoke frame centred on the hinge: two leaves either side
 * of the knuckle, bridge, knurled socket, wing thumb screw (+Z), hex nut (-Z).
 * Returns [black hardware, satin nickel].
 */
function yokeGeometry(high: boolean): [BufferGeometry, BufferGeometry] {
  const hw: BufferGeometry[] = [];
  const ni: BufferGeometry[] = [];
  const leafShape = new Shape();
  const lw = 0.0064;
  leafShape.moveTo(-lw, -0.019);
  leafShape.lineTo(lw, -0.019);
  leafShape.lineTo(lw, 0);
  leafShape.absarc(0, 0, lw, 0, Math.PI, false);
  leafShape.lineTo(-lw, -0.019);
  for (const z of [-0.0062, 0.0062]) {
    const leaf = bevelledExtrude(leafShape, 0.0032, 0.0006, high ? 16 : 8);
    leaf.translate(0, 0, z);
    hw.push(leaf);
  }
  const bridge = roundedBox(0.0128, 0.0062, 0.0156, 0.0014, 2);
  bridge.translate(0, -0.0205, 0);
  hw.push(bridge);
  // Knurled socket that screws onto the stand thread.
  const socket = machinedLathe(
    [
      [0, -0.0292, true],
      [0.0078, -0.0292, true],
      [0.0084, -0.0285, true],
      [0.0084, -0.0245, true],
      [0.0072, -0.0235, true],
      [0, -0.0235],
    ],
    high ? 192 : 72,
    { ridges: { count: 36, depth: 0.00045, from: 2, to: 3 } },
  );
  hw.push(socket);
  // Exposed 5/8" thread between the stand cap and the socket.
  const thread = machinedLathe([[0, -0.034, true], ...threadProfile(0.0078, 0.00055, -0.034, -0.0292, 0.0011), [0, -0.0292]], high ? 48 : 24);
  ni.push(thread);
  // Washer + wing thumb screw on +Z.
  const washer = machinedLathe(
    [
      [0.0024, 0, true],
      [0.0062, 0, true],
      [0.0062, 0.0008, true],
      [0.0024, 0.0008, true],
    ],
    high ? 48 : 24,
  );
  washer.rotateX(Math.PI / 2);
  washer.translate(0, 0, 0.0078);
  ni.push(washer);
  const knob = machinedLathe(
    [
      [0, 0, true],
      [0.0034, 0, true],
      [0.0034, 0.0012, true],
      [0.0082, 0.0014, true],
      [0.0086, 0.0019, true],
      [0.0086, 0.0046, true],
      [0.0079, 0.0055, true],
      [0.004, 0.0062],
      [0, 0.0064],
    ],
    high ? 240 : 96,
    { ridges: { count: 24, depth: 0.0007, from: 4, to: 5 } },
  );
  knob.rotateX(Math.PI / 2);
  knob.translate(0, 0, 0.0086);
  hw.push(knob);
  // Hex nut on -Z.
  const nut = new CylinderGeometry(0.0046, 0.0046, 0.0032, 6);
  nut.rotateX(Math.PI / 2);
  nut.translate(0, 0, -0.0096);
  ni.push(nut);
  const tip = new CylinderGeometry(0.0021, 0.0021, 0.0016, 16);
  tip.rotateX(Math.PI / 2);
  tip.translate(0, 0, -0.0118);
  ni.push(tip);
  return [mergeParts(hw), mergeParts(ni)];
}

/** XLR connector boot plugged into the tail, with strain relief (mic space, below y = 0). */
function connectorGeometry(high: boolean) {
  return machinedLathe(
    [
      [0.0032, -0.044, true],
      [0.0042, -0.04],
      [0.0062, -0.032],
      [0.0088, -0.026, true],
      [0.0091, -0.0245, true],
      [0.0091, -0.0035, true],
      [0.0086, -0.0005, true],
      [0.0078, -0.0005, true],
      [0.0078, 0.0012, true],
    ],
    high ? 64 : 28,
    { ridges: { count: 20, depth: 0.00028, from: 4, to: 5 } },
  );
}

/**
 * Cable from the connector down the back of the stand, over the base, across
 * the pile to the rug's edge, down its lip and off upstage right on the deck.
 */
function cableGeometry(high: boolean) {
  const sx = STAND_BASE.x;
  const sz = STAND_BASE.z;
  const fy = STAND_BASE.y;
  const tail = micToWorld(new Vector3(0, -0.044, 0));
  const tail2 = micToWorld(new Vector3(0, -0.085, 0));
  const off = 0.014;
  // Upstage right, away from the camera axis: the cable never crosses the lens' view of the stand.
  const ax = Math.sin(VIEW_AZ + Math.PI * 0.78);
  const az = Math.cos(VIEW_AZ + Math.PI * 0.78);
  const along = (r: number, y: number, wob = 0) => new Vector3(sx + ax * r - az * wob, y, sz + az * r + ax * wob);
  const rugEdge = RUG_RADIUS + 0.012;
  const pts = [
    tail,
    tail2,
    new Vector3(sx + 0.02, tail2.y - 0.12, sz - off * 1.5),
    new Vector3(sx + 0.004, fy + 1.1, sz - off),
    new Vector3(sx, fy + 0.96, sz - 0.02),
    new Vector3(sx - 0.003, fy + 0.82, sz - off),
    new Vector3(sx, fy + 0.45, sz - off),
    new Vector3(sx, fy + 0.12, sz - off),
    new Vector3(sx + 0.002, fy + 0.066, sz - 0.026),
    along(0.08, fy + 0.034, 0.01),
    along(0.142, fy + 0.019),
    along(0.2, fy + 0.0045),
    along(0.42, fy + 0.0035, 0.05),
    along(0.78, fy + 0.0035, -0.04),
    along(1.15, fy + 0.0035, 0.06),
    along(rugEdge - 0.02, fy + 0.0035, 0.03),
    along(rugEdge + 0.01, 0.009, 0.03),
    along(rugEdge + 0.06, 0.0035, 0.035),
    along(2.2, 0.0035, -0.05),
    along(3.2, 0.0035, 0.1),
    along(5.5, 0.0035, 0.3),
  ];
  const curve = new CatmullRomCurve3(pts, false, 'centripetal');
  return new TubeGeometry(curve, high ? 520 : 220, 0.0034, high ? 8 : 5, false);
}

export default function Microphone({ quality, engraving }: { quality: 'high' | 'low'; engraving?: Partial<EngravingFacts> }) {
  const high = quality === 'high';
  const gl = useThree((s) => s.gl);
  const fade = useRef(0);
  const root = useRef<Group>(null);
  // Rebuild the mask only when the engraved facts actually change.
  const engravingKey = JSON.stringify(engraving ?? {});
  const rows = useMemo(() => engravingRows(JSON.parse(engravingKey) as Partial<EngravingFacts>), [engravingKey]);
  const maskOn = useRef<{ value: number } | null>(null);

  const geo = useMemo(() => {
    const seg = high ? 160 : 72;
    const [yokeHw, yokeNi] = yokeGeometry(high);
    const out: Record<string, BufferGeometry> = {
      body: machinedLathe(bodyProfile(high ? 40 : 16), seg),
      ring: machinedLathe(RING_PROFILE, seg),
      grille: machinedLathe(grilleProfile(high ? 64 : 28), seg),
      clip: clipGeometry(high),
      connector: connectorGeometry(high),
      yokeHw,
      yokeNi,
      base: machinedLathe(standBaseProfile(), high ? 128 : 64),
      lower: new CylinderGeometry(0.0095, 0.0095, 0.92 - 0.05, high ? 40 : 20, 1, true),
      clutch: machinedLathe(clutchProfile(), high ? 160 : 64, { ridges: { count: 32, depth: 0.0006, from: 2, to: 3 } }),
      upper: new CylinderGeometry(0.0074, 0.0074, STAND_TOP_Y - STAND_BASE.y - 0.97, high ? 32 : 16, 1, true),
      cap: machinedLathe(
        [
          [0.0074, 0, true],
          [0.0086, 0.002, true],
          [0.0086, 0.011, true],
          [0.0062, 0.0135, true],
          [0, 0.0135],
        ],
        32,
      ),
      cable: cableGeometry(high),
    };
    return out;
  }, [high]);

  const mats = useMemo(
    () => ({
      body: createBodyMaterial(!high),
      grille: createGrilleMaterial(!high),
      polished: createPolishedMaterial(),
      nickel: createNickelMaterial(!high),
      hardware: createHardwareMaterial(),
      cable: createCableMaterial(),
    }),
    [high],
  );

  useEffect(() => {
    let cancelled = false;
    const w = high ? 4096 : 3072;
    const h = high ? 2048 : 1536;
    let made: Texture | null = null;
    createEngravingMask(w, h, rows)
      .then((tex) => {
        if (tex === EMPTY_MASK) return;
        if (cancelled) {
          tex.dispose();
          return;
        }
        made = tex;
        tex.anisotropy = Math.min(high ? 16 : 4, gl.capabilities.getMaxAnisotropy());
        maskOn.current = mats.body.uniforms.uMaskOn;
        fade.current = 0.0001;
        tex.needsUpdate = true;
        const u = mats.body.uniforms;
        u.uMask.value = tex;
        u.uMaskTexel.value = [1 / w, 1 / h];
      })
      .catch(() => {
        /* no engraving rather than no scene */
      });
    return () => {
      cancelled = true;
      if (made) {
        const u = mats.body.uniforms;
        if (u.uMask.value === made) {
          u.uMask.value = EMPTY_MASK;
          u.uMaskOn.value = 0;
        }
        made.dispose();
      }
    };
  }, [gl, high, mats, rows]);

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      mats.body.material.dispose();
      mats.grille.material.dispose();
      mats.polished.dispose();
      mats.nickel.dispose();
      mats.hardware.dispose();
      mats.cable.dispose();
    },
    [geo, mats],
  );

  // Fade the engraving in (about 1.2 s) once the mask is ready.
  useFrame((_, dt) => {
    if (fade.current <= 0 || fade.current >= 1 || !maskOn.current) return;
    fade.current = Math.min(1, fade.current + dt / 1.2);
    const f = fade.current;
    maskOn.current.value = f * f * (3 - 2 * f);
  });

  // The microphone and stand show in the floor reflection.
  useLayoutEffect(() => {
    root.current?.traverse((o) => o.layers.enable(REFLECT_LAYER));
  }, [geo, mats]);

  const sx = STAND_BASE.x;
  const sz = STAND_BASE.z;
  const fy = STAND_BASE.y;

  return (
    <group ref={root}>
      {/* The microphone, in its own (tilted) frame */}
      <group position={MIC_POSITION} quaternion={MIC_QUATERNION}>
        <mesh geometry={geo.body} material={mats.body.material} />
        <mesh geometry={geo.ring} material={mats.nickel} />
        <mesh geometry={geo.grille} material={mats.grille.material} />
        <mesh geometry={geo.clip} material={mats.hardware} />
        <mesh geometry={geo.connector} material={mats.hardware} />
      </group>

      {/* Clip yoke and thumb screw: upright, hinged on the mic Z axis */}
      <group position={PIVOT_WORLD} quaternion={YOKE_Q}>
        <mesh geometry={geo.yokeHw} material={mats.hardware} />
        <mesh geometry={geo.yokeNi} material={mats.nickel} />
      </group>

      {/* Stand */}
      <mesh geometry={geo.base} material={mats.hardware} position={[sx, fy, sz]} />
      <mesh geometry={geo.lower} material={mats.hardware} position={[sx, fy + (0.92 + 0.05) / 2, sz]} />
      <mesh geometry={geo.clutch} material={mats.hardware} position={[sx, fy + 0.915, sz]} />
      <mesh geometry={geo.upper} material={mats.polished} position={[sx, (STAND_TOP_Y + fy + 0.97) / 2, sz]} />
      <mesh geometry={geo.cap} material={mats.hardware} position={[sx, STAND_TOP_Y - 0.0115, sz]} />
      <mesh geometry={geo.cable} material={mats.cable} />
    </group>
  );
}
