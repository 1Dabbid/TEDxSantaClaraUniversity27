'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CylinderGeometry, TorusGeometry, type BufferGeometry } from 'three';
import { machinedLathe, roundedBox, type ProfilePoint } from './geometry';
import {
  MIC,
  MIC_POSITION,
  MIC_QUATERNION,
  PIVOT_WORLD,
  STAND_BASE,
  STAND_TOP_Y,
  barrelRadius,
} from './layout';
import { createBodyMaterial, createGrilleMaterial, createHardwareMaterial, createPolishedMaterial } from './materials';
import { createEngravingMask } from './textures';

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
  // Tapered barrel
  for (let i = 0; i <= taperSteps; i++) {
    const y = MIC.taperY[0] + ((MIC.taperY[1] - MIC.taperY[0]) * i) / taperSteps;
    p.push([barrelRadius(y), y, i === 0 || i === taperSteps]);
  }
  p.push([0.0189, 0.1043, true], [0.0189, 0.1056, true], [0, 0.1056]);
  return p;
}

const RING_PROFILE: ProfilePoint[] = [
  [0.0186, 0.105, true],
  [0.0199, 0.1054],
  [0.0204, 0.1061],
  [0.0206, 0.1072],
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

export default function Microphone({ quality }: { quality: 'high' | 'low' }) {
  const high = quality === 'high';
  const gl = useThree((s) => s.gl);

  const geo = useMemo(() => {
    const seg = high ? 160 : 72;
    const out: Record<string, BufferGeometry> = {
      body: machinedLathe(bodyProfile(high ? 40 : 16), seg),
      ring: machinedLathe(RING_PROFILE, seg),
      grille: machinedLathe(grilleProfile(high ? 64 : 28), seg),
      clipRing: new TorusGeometry(0.0149, 0.0027, high ? 16 : 8, high ? 64 : 32, Math.PI * 1.55),
      clipSpine: roundedBox(0.012, 0.0145, 0.0125, 0.0022, high ? 3 : 2),
      pivot: new CylinderGeometry(0.0058, 0.0058, 0.032, high ? 32 : 16),
      knob: machinedLathe(
        [
          [0, 0, true],
          [0.0075, 0, true],
          [0.0088, 0.0012, true],
          [0.0088, 0.0078, true],
          [0.0075, 0.009, true],
          [0, 0.009],
        ],
        high ? 40 : 20,
      ),
      yoke: roundedBox(0.016, 0.022, 0.024, 0.003, high ? 3 : 2),
      stud: new CylinderGeometry(0.0048, 0.0048, PIVOT_WORLD.y - STAND_TOP_Y, 20),
      base: machinedLathe(standBaseProfile(), high ? 128 : 64),
      lower: new CylinderGeometry(0.0095, 0.0095, 0.92 - 0.05, high ? 40 : 20, 1, true),
      clutch: machinedLathe(clutchProfile(), high ? 48 : 24),
      upper: new CylinderGeometry(0.0074, 0.0074, STAND_TOP_Y - 0.97, high ? 32 : 16, 1, true),
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
    };
    return out;
  }, [high]);

  const mats = useMemo(
    () => ({
      body: createBodyMaterial(!high),
      grille: createGrilleMaterial(!high),
      polished: createPolishedMaterial(),
      hardware: createHardwareMaterial(),
    }),
    [high],
  );

  useEffect(() => {
    let cancelled = false;
    const w = high ? 4096 : 3072;
    const h = high ? 2048 : 1536;
    createEngravingMask(w, h).then((tex) => {
      if (cancelled) {
        tex.dispose();
        return;
      }
      tex.anisotropy = Math.min(high ? 8 : 4, gl.capabilities.getMaxAnisotropy());
      tex.needsUpdate = true;
      const u = mats.body.uniforms;
      u.uMask.value = tex;
      u.uMaskTexel.value = [1 / w, 1 / h];
    });
    return () => {
      cancelled = true;
    };
  }, [gl, high, mats]);

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      mats.body.material.dispose();
      mats.grille.material.dispose();
      mats.polished.dispose();
      mats.hardware.dispose();
      const t = mats.body.uniforms.uMask.value;
      if (t.image && (t.image as { width: number }).width > 1) t.dispose();
    },
    [geo, mats],
  );

  const sx = STAND_BASE.x;
  const sz = STAND_BASE.z;

  return (
    <group>
      {/* The microphone, in its own (tilted) frame */}
      <group position={MIC_POSITION} quaternion={MIC_QUATERNION}>
        <mesh geometry={geo.body} material={mats.body.material} />
        <mesh geometry={geo.ring} material={mats.polished} />
        <mesh geometry={geo.grille} material={mats.grille.material} />
        {/* Clip: C-ring around the barrel, open on top (+X), spine and pivot underneath (-X) */}
        <mesh
          geometry={geo.clipRing}
          material={mats.hardware}
          position={[0, MIC.clipY, 0]}
          rotation={[Math.PI / 2, 0, Math.PI * 0.225]}
        />
        <mesh geometry={geo.clipSpine} material={mats.hardware} position={[-0.0215, MIC.clipY, 0]} />
        <mesh
          geometry={geo.pivot}
          material={mats.hardware}
          position={[MIC.pivot.x, MIC.pivot.y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <mesh
          geometry={geo.knob}
          material={mats.hardware}
          position={[MIC.pivot.x, MIC.pivot.y, 0.016]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>

      {/* Clip yoke and stud: stay upright on the stand */}
      <mesh geometry={geo.yoke} material={mats.hardware} position={[sx, PIVOT_WORLD.y - 0.004, sz]} />
      <mesh
        geometry={geo.stud}
        material={mats.hardware}
        position={[sx, (PIVOT_WORLD.y + STAND_TOP_Y) / 2 - 0.006, sz]}
      />

      {/* Stand */}
      <mesh geometry={geo.base} material={mats.hardware} position={[sx, 0, sz]} />
      <mesh geometry={geo.lower} material={mats.hardware} position={[sx, (0.92 + 0.05) / 2, sz]} />
      <mesh geometry={geo.clutch} material={mats.hardware} position={[sx, 0.915, sz]} />
      <mesh geometry={geo.upper} material={mats.polished} position={[sx, (STAND_TOP_Y + 0.97) / 2, sz]} />
      <mesh geometry={geo.cap} material={mats.hardware} position={[sx, STAND_TOP_Y - 0.0115, sz]} />
    </group>
  );
}
