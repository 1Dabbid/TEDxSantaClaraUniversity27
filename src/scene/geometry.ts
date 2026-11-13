import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Shape } from 'three';

/** A profile point: [radius, y, sharp?]. A sharp point gets a hard crease (split normals). */
export type ProfilePoint = readonly [number, number, boolean?];

/**
 * Lathe around +Y with per-vertex crease control, so machined chamfers read as
 * crisp bevels instead of being smoothed away. UV: u = angle / 2π, v = arc
 * length in metres from the first point. Angle convention matches
 * THREE.LatheGeometry (x = sin φ · r, z = cos φ · r).
 */
export function machinedLathe(profile: readonly ProfilePoint[], segments: number): BufferGeometry {
  const n = profile.length;
  // Outward normals for each segment (in r/y plane).
  const segN: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const dr = profile[i + 1][0] - profile[i][0];
    const dy = profile[i + 1][1] - profile[i][1];
    const len = Math.hypot(dr, dy) || 1;
    segN.push([dy / len, -dr / len]);
  }
  // Each ring: [r, y, nr, ny, v]
  const rings: [number, number, number, number, number][] = [];
  // Index pairs: for each segment, the ring index at its start and end.
  const segRings: [number, number][] = [];
  let arc = 0;
  let prevEndRing = -1;
  for (let i = 0; i < n; i++) {
    const [r, y, sharp] = profile[i];
    if (i > 0) arc += Math.hypot(r - profile[i - 1][0], y - profile[i - 1][1]);
    const nIn = i > 0 ? segN[i - 1] : null;
    const nOut = i < n - 1 ? segN[i] : null;
    if (nIn && nOut && !sharp) {
      const ar = nIn[0] + nOut[0];
      const ay = nIn[1] + nOut[1];
      const l = Math.hypot(ar, ay) || 1;
      rings.push([r, y, ar / l, ay / l, arc]);
      const idx = rings.length - 1;
      if (prevEndRing >= 0) segRings.push([prevEndRing, idx]);
      prevEndRing = idx;
    } else {
      if (nIn) {
        rings.push([r, y, nIn[0], nIn[1], arc]);
        segRings.push([prevEndRing, rings.length - 1]);
      }
      if (nOut) {
        rings.push([r, y, nOut[0], nOut[1], arc]);
        prevEndRing = rings.length - 1;
      }
    }
  }

  const cols = segments + 1;
  const pos = new Float32Array(rings.length * cols * 3);
  const nor = new Float32Array(rings.length * cols * 3);
  const uv = new Float32Array(rings.length * cols * 2);
  for (let k = 0; k < rings.length; k++) {
    const [r, y, nr, ny, v] = rings[k];
    for (let j = 0; j < cols; j++) {
      const phi = (j / segments) * Math.PI * 2;
      const s = Math.sin(phi);
      const c = Math.cos(phi);
      const o = (k * cols + j) * 3;
      pos[o] = s * r;
      pos[o + 1] = y;
      pos[o + 2] = c * r;
      nor[o] = s * nr;
      nor[o + 1] = ny;
      nor[o + 2] = c * nr;
      const u = (k * cols + j) * 2;
      uv[u] = j / segments;
      uv[u + 1] = v;
    }
  }
  const index: number[] = [];
  for (const [a, b] of segRings) {
    for (let j = 0; j < segments; j++) {
      const a0 = a * cols + j;
      const a1 = a0 + 1;
      const b0 = b * cols + j;
      const b1 = b0 + 1;
      // Profile runs bottom → top: wind so faces point outward.
      index.push(a0, a1, b0, a1, b1, b0);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

/** Append a smooth arc of profile points (centre cr, cy; radius R; angles in radians from +r axis). */
export function arcPoints(cr: number, cy: number, R: number, a0: number, a1: number, steps: number): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([Math.max(0, cr + Math.cos(a) * R), cy + Math.sin(a) * R]);
  }
  return out;
}

/**
 * Rounded box (bevelled on all edges), centred at the origin. Built from an
 * extruded rounded rectangle so edges catch thin rim highlights.
 */
export function roundedBox(w: number, h: number, d: number, r: number, curveSegments = 4): BufferGeometry {
  const shape = new Shape();
  const x = -w / 2 + r;
  const y = -h / 2 + r;
  const iw = Math.max(1e-4, w - 2 * r);
  const ih = Math.max(1e-4, h - 2 * r);
  // Inner rectangle; the bevel supplies the rounding.
  shape.moveTo(x, y);
  shape.lineTo(x + iw, y);
  shape.lineTo(x + iw, y + ih);
  shape.lineTo(x, y + ih);
  shape.lineTo(x, y);
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, d - 2 * r),
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: curveSegments,
    curveSegments,
  });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.computeVertexNormals();
  return g;
}
