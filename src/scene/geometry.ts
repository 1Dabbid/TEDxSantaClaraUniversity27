import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Shape } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A profile point: [radius, y, sharp?]. A sharp point gets a hard crease (split normals). */
export type ProfilePoint = readonly [number, number, boolean?];

/**
 * Lathe around +Y with per-vertex crease control, so machined chamfers read as
 * crisp bevels instead of being smoothed away. UV: u = angle / 2π, v = arc
 * length in metres from the first point. Angle convention matches
 * THREE.LatheGeometry (x = sin φ · r, z = cos φ · r).
 */
export type LatheOptions = {
  /** Sector start / length (radians). Default: full turn. */
  phiStart?: number;
  phiLength?: number;
  /**
   * Machined ridges (knurling, wing knobs) on rings whose profile index is in
   * [from, to]: radius += depth * trapezoid(count * phi). Normals follow the ridges.
   */
  ridges?: { count: number; depth: number; from: number; to: number };
};

/** Trapezoid wave 0..1 with flat tops and valleys (crisp, countable highlights). */
function trapezoid(x: number) {
  const u = x - Math.floor(x);
  const tri = 1 - 2 * Math.abs(u - 0.5);
  const t = Math.min(1, Math.max(0, (tri - 0.15) / 0.7));
  return t * t * (3 - 2 * t);
}

export function machinedLathe(profile: readonly ProfilePoint[], segments: number, opts: LatheOptions = {}): BufferGeometry {
  const phiStart = opts.phiStart ?? 0;
  const phiLength = opts.phiLength ?? Math.PI * 2;
  const ridges = opts.ridges;
  const n = profile.length;
  // Outward normals for each segment (in r/y plane).
  const segN: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const dr = profile[i + 1][0] - profile[i][0];
    const dy = profile[i + 1][1] - profile[i][1];
    const len = Math.hypot(dr, dy) || 1;
    segN.push([dy / len, -dr / len]);
  }
  // Each ring: [r, y, nr, ny, v, profileIndex]
  const rings: [number, number, number, number, number, number][] = [];
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
      rings.push([r, y, ar / l, ay / l, arc, i]);
      const idx = rings.length - 1;
      if (prevEndRing >= 0) segRings.push([prevEndRing, idx]);
      prevEndRing = idx;
    } else {
      if (nIn) {
        rings.push([r, y, nIn[0], nIn[1], arc, i]);
        segRings.push([prevEndRing, rings.length - 1]);
      }
      if (nOut) {
        rings.push([r, y, nOut[0], nOut[1], arc, i]);
        prevEndRing = rings.length - 1;
      }
    }
  }

  const cols = segments + 1;
  const pos = new Float32Array(rings.length * cols * 3);
  const nor = new Float32Array(rings.length * cols * 3);
  const uv = new Float32Array(rings.length * cols * 2);
  for (let k = 0; k < rings.length; k++) {
    const [r0, y, nr, ny, v, pi] = rings[k];
    const ridged = ridges && pi >= ridges.from && pi <= ridges.to;
    for (let j = 0; j < cols; j++) {
      const phi = phiStart + (j / segments) * phiLength;
      const s = Math.sin(phi);
      const c = Math.cos(phi);
      let r = r0;
      let ex = s;
      let ez = c;
      if (ridged) {
        const f = (p: number) => trapezoid((p * ridges.count) / (Math.PI * 2));
        r = r0 + ridges.depth * f(phi);
        const h = 1e-4;
        const dr = (ridges.depth * (f(phi + h) - f(phi - h))) / (2 * h);
        // Outward normal of the curve (r(phi) sin phi, r(phi) cos phi).
        ex = r * s - dr * c;
        ez = r * c + dr * s;
        const l = Math.hypot(ex, ez) || 1;
        ex /= l;
        ez /= l;
      }
      const o = (k * cols + j) * 3;
      pos[o] = s * r;
      pos[o + 1] = y;
      pos[o + 2] = c * r;
      nor[o] = ex * nr;
      nor[o + 1] = ny;
      nor[o + 2] = ez * nr;
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

/**
 * Extrude an outline (in XY) to depth d along Z, centred, with a small round
 * bevel so the edges catch thin highlights.
 */
export function bevelledExtrude(shape: Shape, d: number, bevel: number, curveSegments = 12): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, d - 2 * bevel),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments,
  });
  g.translate(0, 0, -(d - 2 * bevel) / 2);
  g.computeVertexNormals();
  return g;
}

/**
 * Merge parts (already transformed) into one non-indexed geometry with
 * position / normal / uv, so a whole assembly is a single draw call.
 */
export function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const prepared = parts.map((g) => {
    const out = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') out.deleteAttribute(k);
    if (!out.attributes.uv) out.setAttribute('uv', new BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
    return out;
  });
  const merged = mergeGeometries(prepared, false) ?? prepared[0];
  for (const g of parts) if (g !== merged) g.dispose();
  for (const g of prepared) if (g !== merged) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/** Thread / groove profile: V-grooves of the given pitch between y0 and y1 (rings, not a helix). */
export function threadProfile(rOuter: number, depth: number, y0: number, y1: number, pitch: number): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  const n = Math.max(1, Math.round((y1 - y0) / pitch));
  for (let i = 0; i < n; i++) {
    const y = y0 + i * pitch;
    out.push([rOuter, y + pitch * 0.12, true], [rOuter - depth, y + pitch * 0.5, true]);
  }
  out.push([rOuter, y1 - pitch * 0.12, true]);
  return out;
}
