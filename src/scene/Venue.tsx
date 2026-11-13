'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
  type Points,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AUDIENCE_FLOOR_Y, SEATING, STAGE_EDGE_Z, rowHeight } from './layout';
import { createVenueMaterial } from './materials';

const TREAD = SEATING.rowGap / 2;

/** Angular half-width of row k (radians), with a margin past the outer seats. */
function rowSpan(k: number) {
  const R = SEATING.firstRadius + k * SEATING.rowGap;
  return (SEATING.aisle / 2 + SEATING.pitch * (SEATING.rows[k] / 2) + 0.7) / R;
}

/** Raked treads (one per row behind the first), their risers, the stage front and the audience floor. */
function houseGeometry() {
  const parts: BufferGeometry[] = [];
  const c = SEATING.centre;
  for (let k = 1; k < SEATING.rows.length; k++) {
    const R = SEATING.firstRadius + k * SEATING.rowGap;
    const A = rowSpan(k);
    const outer = k === SEATING.rows.length - 1 ? R + 3 : R + TREAD;
    const tread = new RingGeometry(R - TREAD, outer, 48, 1, -Math.PI / 2 - A, 2 * A);
    tread.rotateX(-Math.PI / 2);
    tread.translate(c.x, rowHeight(k), c.z);
    parts.push(tread);
    const riserH = rowHeight(k) - rowHeight(k - 1);
    const riser = new CylinderGeometry(R - TREAD, R - TREAD, riserH, 48, 1, true, -A, 2 * A);
    riser.translate(c.x, rowHeight(k) - riserH / 2, c.z);
    parts.push(riser);
  }
  // Audience floor from the stage front back to the house wall.
  const floor = new PlaneGeometry(60, 40);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, AUDIENCE_FLOOR_Y, STAGE_EDGE_Z + 20);
  parts.push(floor);
  // Stage front (riser), facing the audience.
  const front = new PlaneGeometry(60, -AUDIENCE_FLOOR_Y);
  front.translate(0, AUDIENCE_FLOOR_Y / 2, STAGE_EDGE_Z);
  parts.push(front);
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(n.attributes)) if (key !== 'position' && key !== 'normal') n.deleteAttribute(key);
    return n;
  });
  const merged = mergeGeometries(clean, false) ?? new BufferGeometry();
  merged.computeBoundingSphere();
  return merged;
}

/** Aisle step lights: a small warm lamp at each tread edge on both sides of the centre aisle. */
function aisleLights() {
  const pos: number[] = [];
  const c = SEATING.centre;
  for (let k = 0; k < SEATING.rows.length; k++) {
    const R = SEATING.firstRadius + k * SEATING.rowGap - TREAD + 0.04;
    for (const side of [-1, 1]) {
      const a = (side * (SEATING.aisle / 2 - 0.08)) / R;
      pos.push(c.x + Math.sin(a) * R, rowHeight(k) + 0.06, c.z + Math.cos(a) * R);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeBoundingSphere();
  return g;
}

function lampMaterial() {
  return new ShaderMaterial({
    uniforms: { uScale: { value: 400 } },
    vertexShader: /* glsl */ `
      uniform float uScale;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(0.09 * uScale / -mv.z, 1.5, 24.0);
      }`,
    fragmentShader: /* glsl */ `
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float core = exp(-r * r * 18.0);
        float halo = exp(-r * r * 3.0) * 0.18;
        gl_FragColor = vec4(vec3(1.0, 0.62, 0.32) * (core * 0.5 + halo), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: true,
    fog: false,
  });
}

/**
 * The house: the stage stands 55 cm above the audience floor (its front edge
 * catches a little spill), the rows rise on shallow treads, and dim warm aisle
 * step lights mark the centre aisle: just enough to read as a small
 * auditorium in the dark.
 */
export default function Venue() {
  const geo = useMemo(() => ({ house: houseGeometry(), lamps: aisleLights() }), []);
  const mats = useMemo(() => {
    const house: MeshStandardMaterial = createVenueMaterial();
    house.side = DoubleSide;
    return { house, lamps: lampMaterial() };
  }, []);
  useEffect(
    () => () => {
      geo.house.dispose();
      geo.lamps.dispose();
      mats.house.dispose();
      mats.lamps.dispose();
    },
    [geo, mats],
  );
  const lamps = useRef<Points>(null);
  useFrame((state) => {
    const m = lamps.current?.material as ShaderMaterial | undefined;
    if (m) m.uniforms.uScale.value = (state.size.height * state.viewport.dpr * 0.5) / Math.tan(((state.camera as { fov?: number }).fov ?? 30) * (Math.PI / 360));
  });
  return (
    <group>
      <mesh geometry={geo.house} material={mats.house} />
      <points
        ref={lamps}
        geometry={geo.lamps}
        material={mats.lamps}
        renderOrder={6}
      />
    </group>
  );
}
