'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, Color, Matrix4, Quaternion, Shape, Vector3, type InstancedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bevelledExtrude, roundedBox } from './geometry';
import { SEATING, rowHeight } from './layout';
import { createSeatMaterial } from './materials';

/** One upholstered auditorium seat, facing -Z, origin on the floor. */
function seatGeometry(detail: number) {
  // Seat back: arched top, slight waist, bevelled so the top edge catches a thin highlight.
  const w = 0.25;
  const shape = new Shape();
  shape.moveTo(-w + 0.02, -0.28);
  shape.lineTo(w - 0.02, -0.28);
  shape.quadraticCurveTo(w + 0.004, -0.27, w, -0.22);
  shape.lineTo(w - 0.008, 0.16);
  shape.bezierCurveTo(w - 0.02, 0.29, 0.1, 0.33, 0, 0.33);
  shape.bezierCurveTo(-0.1, 0.33, -w + 0.02, 0.29, -w + 0.008, 0.16);
  shape.lineTo(-w, -0.22);
  shape.quadraticCurveTo(-w - 0.004, -0.27, -w + 0.02, -0.28);
  const back = bevelledExtrude(shape, 0.075, 0.018, detail * 3);
  back.rotateX(0.16);
  back.translate(0, 0.74, 0.21);
  const cushion = roundedBox(0.48, 0.09, 0.45, 0.03, detail);
  cushion.translate(0, 0.44, -0.02);
  const armL = roundedBox(0.05, 0.62, 0.52, 0.012, Math.max(1, detail - 1));
  armL.translate(-0.275, 0.31, 0.0);
  const armR = armL.clone();
  armR.translate(0.55, 0, 0);
  const strip = (g: BufferGeometry) => {
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
          p.set(SEATING.centre.x + Math.sin(a) * R, rowHeight(row), SEATING.centre.z + Math.cos(a) * R);
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
