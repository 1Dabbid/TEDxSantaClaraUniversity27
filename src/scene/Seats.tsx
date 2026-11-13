'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, Color, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { roundedBox } from './geometry';
import { SEATING } from './layout';
import { createSeatMaterial } from './materials';

/** One upholstered auditorium seat, facing -Z, origin on the floor. */
function seatGeometry(detail: number) {
  const back = roundedBox(0.5, 0.56, 0.07, 0.024, detail);
  back.rotateX(0.16);
  back.translate(0, 0.74, 0.21);
  const cushion = roundedBox(0.48, 0.09, 0.45, 0.03, detail);
  cushion.translate(0, 0.44, -0.02);
  const armL = roundedBox(0.05, 0.62, 0.52, 0.012, Math.max(1, detail - 1));
  armL.translate(-0.275, 0.31, 0.0);
  const armR = armL.clone();
  armR.translate(0.55, 0, 0);
  const strip = (g: ReturnType<typeof roundedBox>) => {
    const out = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
    return out;
  };
  const merged = mergeGeometries([back, cushion, armL, armR].map(strip), false) ?? new BoxGeometry(0.5, 0.9, 0.5);
  merged.computeBoundingSphere();
  return merged;
}

/** 100 seats in curved rows with a centre aisle, facing the stage. */
export default function Seats({ quality }: { quality: 'high' | 'low' }) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => seatGeometry(quality === 'high' ? 4 : 2), [quality]);
  const material = useMemo(() => createSeatMaterial(), []);
  const count = SEATING.rows.reduce((a, b) => a + b, 0);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const p = new Vector3();
    const one = new Vector3(1, 1, 1);
    const c = new Color();
    let i = 0;
    SEATING.rows.forEach((n, row) => {
      const R = SEATING.firstRadius + row * SEATING.rowGap;
      const half = n / 2;
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < half; k++) {
          const s = SEATING.aisle / 2 + SEATING.pitch * (k + 0.5);
          const a = (side * s) / R;
          p.set(SEATING.centre.x + Math.sin(a) * R, 0, SEATING.centre.z + Math.cos(a) * R);
          q.setFromAxisAngle(up, a);
          m.compose(p, q, one);
          mesh.setMatrixAt(i, m);
          const v = 0.9 + ((i * 7919) % 13) / 13 * 0.2;
          mesh.setColorAt(i, c.setScalar(v));
          i++;
        }
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [geometry]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useEffect(() => () => material.dispose(), [material]);

  return <instancedMesh ref={ref} args={[geometry, material, count]} />;
}
