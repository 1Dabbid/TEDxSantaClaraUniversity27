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
import { createConeMaterial, createDustMaterial, createFloorMaterial, createRugMaterial } from './materials';
import { look } from './look';

const R = RUG_RADIUS;

/** Floor, red rug, overhead spot with a visible cone and drifting dust. */
export default function Stage({ quality }: { quality: 'high' | 'low' }) {
  const high = quality === 'high';
  const spot = useRef<SpotLight>(null);
  const cone = useRef<Mesh>(null);
  const dust = useRef<Points>(null);

  const geo = useMemo(() => {
    const floor = new PlaneGeometry(90, 90, 1, 1);
    floor.rotateX(-Math.PI / 2);
    const rug = machinedLathe(
      [
        [R + 0.012, 0.0008, true],
        [R + 0.0085, 0.0062],
        [R + 0.003, 0.0098],
        [R - 0.006, 0.0116],
        [R - 0.03, 0.012],
        [0, 0.012],
      ],
      high ? 192 : 96,
    );
    const cone = new CylinderGeometry(0.11, Math.tan(SPOT_ANGLE) * SPOT_HEIGHT, SPOT_HEIGHT, high ? 72 : 40, 1, true);
    cone.translate(0, SPOT_HEIGHT / 2, 0);

    const count = high ? 650 : 260;
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
    return { floor, rug, cone, dust };
  }, [high]);

  const mats = useMemo(
    () => ({
      floor: createFloorMaterial(!high),
      rug: createRugMaterial(!high),
      cone: createConeMaterial(),
      dust: createDustMaterial(),
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
    if (spot.current) spot.current.intensity = 240 * look.spot;
  });

  return (
    <group>
      <mesh geometry={geo.floor} material={mats.floor} />
      <mesh geometry={geo.rug} material={mats.rug} />
      <spotLight
        ref={spot}
        position={[0, SPOT_HEIGHT, 0]}
        angle={SPOT_ANGLE * 1.2}
        penumbra={0.75}
        decay={2}
        distance={0}
        intensity={180}
        color="#fff4e8"
      />
      <mesh ref={cone} geometry={geo.cone} material={mats.cone} renderOrder={5} frustumCulled={false} />
      <points ref={dust} geometry={geo.dust} material={mats.dust} renderOrder={6} frustumCulled={false} />
    </group>
  );
}
