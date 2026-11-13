'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  PlaneGeometry,
  type Mesh,
  type Points,
  type ShaderMaterial,
  type SpotLight,
} from 'three';
import { machinedLathe } from './geometry';
import { RUG_RADIUS, SPOT_ANGLE, SPOT_HEIGHT } from './layout';
import {
  createConeMaterial,
  createCurtainMaterial,
  createDustMaterial,
  createFloorMaterial,
  createRugMaterial,
} from './materials';
import { look } from './look';

const R = RUG_RADIUS;

/** Upstage curtain: distance behind the stage centre, width, height. */
const CURTAIN = { z: -4.6, width: 34, height: 8 };

/**
 * Polished floor with spike tape, the red rug (thick pile, fuzzy edge), the
 * overhead spot with a visible beam and sparkling dust, a faint back curtain.
 */
export default function Stage({ quality }: { quality: 'high' | 'low' }) {
  const high = quality === 'high';
  const spot = useRef<SpotLight>(null);
  const cone = useRef<Mesh>(null);
  const dust = useRef<Points>(null);

  const geo = useMemo(() => {
    const floor = new PlaneGeometry(90, 90, 1, 1);
    floor.rotateX(-Math.PI / 2);
    // Rug: ~18 mm pile with a rounded, slightly sagging lip.
    const rug = machinedLathe(
      [
        [R + 0.014, 0.0006, true],
        [R + 0.0115, 0.008],
        [R + 0.006, 0.0145],
        [R - 0.004, 0.0172],
        [R - 0.03, 0.0182],
        [R - 0.4, 0.0185],
        [0, 0.0185],
      ],
      high ? 256 : 96,
    );
    const cone = new CylinderGeometry(0.11, Math.tan(SPOT_ANGLE) * SPOT_HEIGHT, SPOT_HEIGHT, high ? 72 : 40, 1, true);
    cone.translate(0, SPOT_HEIGHT / 2, 0);

    const count = high ? 700 : 260;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    let s = 1337;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const y = rnd() * SPOT_HEIGHT * 0.95;
      const rr = Math.sqrt(rnd()) * (SPOT_HEIGHT - y) * Math.tan(SPOT_ANGLE) * 1.05;
      const a = rnd() * Math.PI * 2;
      pos.set([Math.cos(a) * rr, y, Math.sin(a) * rr], i * 3);
      seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
    const dust = new BufferGeometry();
    dust.setAttribute('position', new BufferAttribute(pos, 3));
    dust.setAttribute('seed', new BufferAttribute(seed, 4));
    dust.computeBoundingSphere();

    const curtain = new PlaneGeometry(CURTAIN.width, CURTAIN.height, high ? 400 : 200, 1);
    curtain.translate(0, CURTAIN.height / 2, 0);
    return { floor, rug, cone, dust, curtain };
  }, [high]);

  const mats = useMemo(
    () => ({
      floor: createFloorMaterial(!high),
      rug: createRugMaterial(!high),
      cone: createConeMaterial(),
      dust: createDustMaterial(),
      curtain: createCurtainMaterial(),
    }),
    [high],
  );

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
    [geo, mats],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const c = cone.current?.material as ShaderMaterial | undefined;
    const d = dust.current?.material as ShaderMaterial | undefined;
    if (c) {
      c.uniforms.uTime.value = t;
      c.uniforms.uIntensity.value = look.cone;
    }
    if (d) {
      d.uniforms.uTime.value = t;
      d.uniforms.uIntensity.value = look.cone;
      d.uniforms.uScale.value = (state.size.height * state.viewport.dpr * 0.5) / Math.tan((look.fov * Math.PI) / 360);
    }
    if (cone.current) cone.current.visible = look.cone > 0.01;
    if (dust.current) dust.current.visible = look.cone > 0.01;
    if (spot.current) spot.current.intensity = 260 * look.spot;
  });

  return (
    <group>
      <mesh geometry={geo.floor} material={mats.floor} />
      <mesh geometry={geo.rug} material={mats.rug} />
      <mesh geometry={geo.curtain} material={mats.curtain} position={[0, 0, CURTAIN.z]} />
      <spotLight
        ref={spot}
        position={[0, SPOT_HEIGHT, 0]}
        angle={SPOT_ANGLE * 1.08}
        penumbra={0.55}
        decay={2}
        distance={0}
        intensity={200}
        color="#fff2e4"
      />
      <mesh ref={cone} geometry={geo.cone} material={mats.cone} renderOrder={5} frustumCulled={false} />
      <points ref={dust} geometry={geo.dust} material={mats.dust} renderOrder={6} frustumCulled={false} />
    </group>
  );
}
