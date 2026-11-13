import { Vector3 } from 'three';
import { AUDIENCE_FLOOR_Y, MIC, PIVOT_WORLD, SEATING, STAGE_EDGE_Z, STAND_BASE, STAND_TOP_Y, barrelRadius, micToWorld, rowHeight } from './layout';

/**
 * Cheap distance proxies for the scene's solid geometry (metres). The rig
 * uses them to keep the near plane in front of any surface the camera
 * passes close to; the debug simulator reports them per step.
 */

const MIC_A = micToWorld(new Vector3(0, -0.044, 0));
const MIC_B = micToWorld(new Vector3(0, MIC.grilleC + MIC.grilleR * MIC.grilleSquash, 0));
const MIC_LEN = MIC_A.distanceTo(MIC_B);
const CLIP_C = micToWorld(new Vector3(-0.022, MIC.clipY, 0));
const tmp = new Vector3();
const tmp2 = new Vector3();

function micRadius(y: number) {
  if (y < 0) return 0.0092;
  if (y < MIC.taperY[0]) return 0.0126;
  if (y < 0.1056) return barrelRadius(y);
  if (y < 0.113) return 0.0206;
  const dy = (y - MIC.grilleC) / MIC.grilleSquash;
  return Math.sqrt(Math.max(0, MIC.grilleR * MIC.grilleR - dy * dy));
}

function distSegment(p: Vector3, a: Vector3, b: Vector3, out: { t: number }) {
  tmp.subVectors(b, a);
  const l2 = tmp.lengthSq();
  const t = Math.min(1, Math.max(0, tmp2.subVectors(p, a).dot(tmp) / l2));
  out.t = t;
  return tmp2.copy(a).addScaledVector(tmp, t).distanceTo(p);
}

const SEATS: Vector3[] = [];
SEATING.rows.forEach((n, row) => {
  const R = SEATING.firstRadius + row * SEATING.rowGap;
  for (let side = -1; side <= 1; side += 2)
    for (let k = 0; k < n / 2; k++) {
      const a = (side * (SEATING.aisle / 2 + SEATING.pitch * (k + 0.5))) / R;
      SEATS.push(new Vector3(SEATING.centre.x + Math.sin(a) * R, rowHeight(row) + 0.45, SEATING.centre.z + Math.cos(a) * R));
    }
});

const tt = { t: 0 };
/** Distance (m) from p to the nearest surface, and the object's name. */
export function clearance(p: Vector3): [number, string] {
  let best = 1e9;
  let name = '';
  const take = (d: number, n: string) => {
    if (d < best) {
      best = d;
      name = n;
    }
  };
  // Microphone body + grille (capsule with a varying radius).
  const dm = distSegment(p, MIC_A, MIC_B, tt);
  take(dm - micRadius(-0.044 + tt.t * MIC_LEN), 'mic');
  take(p.distanceTo(CLIP_C) - 0.012, 'clip');
  take(p.distanceTo(PIVOT_WORLD) - 0.019, 'yoke');
  // Stand tube, clutch and base.
  const stand = Math.hypot(p.x - STAND_BASE.x, p.z - STAND_BASE.z);
  const yIn = Math.min(STAND_TOP_Y, Math.max(0.05, p.y));
  take(Math.hypot(stand - 0.0095 > 0 ? stand - 0.0095 : 0, p.y - yIn), 'stand');
  take(Math.hypot(Math.max(0, stand - 0.15), Math.max(0, p.y - STAND_BASE.y - 0.055)), 'base');
  // Floors: stage (with the rug) and the audience floor beyond the lip.
  const onStage = p.z < STAGE_EDGE_Z;
  if (onStage) take(p.y - (Math.hypot(p.x, p.z) < 1.52 ? 0.0185 : 0), 'floor');
  else take(Math.hypot(p.y - AUDIENCE_FLOOR_Y, 0), 'audience floor');
  take(Math.hypot(Math.max(0, p.z - STAGE_EDGE_Z), Math.max(0, p.y)), 'stage lip');
  take(p.z + 4.6 - 0.1, 'curtain');
  for (const s of SEATS) {
    const dx = Math.max(0, Math.abs(p.x - s.x) - 0.3);
    const dy = Math.max(0, Math.abs(p.y - s.y) - 0.45);
    const dz = Math.max(0, Math.abs(p.z - s.z) - 0.3);
    take(Math.hypot(dx, dy, dz), 'seat');
  }
  return [best, name];
}

