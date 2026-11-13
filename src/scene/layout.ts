import { Matrix4, Quaternion, Vector3 } from 'three';

/**
 * World layout, in metres. Y up, stage centre at the origin, audience towards +Z.
 * Shared by the scene graph and the camera choreography.
 */

export const RUG_RADIUS = 1.5;
export const SPOT_HEIGHT = 7.2;
/** Half-angle of the overhead spot (radians); the cone just covers the rug. */
export const SPOT_ANGLE = Math.atan((RUG_RADIUS + 0.25) / SPOT_HEIGHT);

/** Microphone, in its own frame: +Y runs from the tail (y = 0) to the grille top. */
export const MIC = {
  /** Engraved band (y range, metres). */
  bandY: [0.0505, 0.1005] as const,
  /** Knurled grip (y range) and its (constant) radius. */
  knurlY: [0.0119, 0.0298] as const,
  knurlR: 0.0126,
  /** Barrel radius at the bottom/top of the taper. */
  taperY: [0.033, 0.1035] as const,
  taperR: [0.0130, 0.0196] as const,
  /** Grille ball centre (y), radius, vertical squash. */
  grilleC: 0.1302,
  grilleR: 0.0262,
  grilleSquash: 0.97,
  /** Clip ring height on the barrel. */
  clipY: 0.0405,
  /** Pivot of the stand clip, in mic space (on the underside, -X). */
  pivot: new Vector3(-0.0315, 0.0405, 0),
};

/** Barrel radius at height y (mic space) inside the tapered section. */
export function barrelRadius(y: number): number {
  const t = Math.min(1, Math.max(0, (y - MIC.taperY[0]) / (MIC.taperY[1] - MIC.taperY[0])));
  const f = 1 - Math.pow(1 - t, 1.35);
  return MIC.taperR[0] + (MIC.taperR[1] - MIC.taperR[0]) * f;
}

/** World position of the clip pivot (top of the stand). */
export const PIVOT_WORLD = new Vector3(1.72, 1.43, 0.86);
/** Mic aim: azimuth (from +Z towards +X) and elevation, radians. */
const AIM_AZ = Math.atan2(-0.93, 0.37);
const AIM_EL = (44 * Math.PI) / 180;

function buildMicMatrix(): Matrix4 {
  const y = new Vector3(Math.cos(AIM_EL) * Math.sin(AIM_AZ), Math.sin(AIM_EL), Math.cos(AIM_EL) * Math.cos(AIM_AZ)).normalize();
  const down = new Vector3(0, -1, 0);
  const under = down.sub(y.clone().multiplyScalar(down.dot(y))).normalize();
  const x = under.clone().negate();
  const z = new Vector3().crossVectors(x, y).normalize();
  const rot = new Matrix4().makeBasis(x, y, z);
  const pivotRot = MIC.pivot.clone().applyMatrix4(rot);
  const pos = PIVOT_WORLD.clone().sub(pivotRot);
  rot.setPosition(pos);
  return rot;
}

/** Mic space → world. */
export const MIC_MATRIX = buildMicMatrix();
export const MIC_MATRIX_INV = MIC_MATRIX.clone().invert();
export const MIC_POSITION = new Vector3();
export const MIC_QUATERNION = new Quaternion();
MIC_MATRIX.decompose(MIC_POSITION, MIC_QUATERNION, new Vector3());
export const MIC_AXIS = new Vector3(0, 1, 0).applyQuaternion(MIC_QUATERNION);

export function micToWorld(v: Vector3, out = new Vector3()): Vector3 {
  return out.copy(v).applyMatrix4(MIC_MATRIX);
}

/** Top of the stand tube (the clip stud rises from here to the pivot). */
export const STAND_TOP_Y = PIVOT_WORLD.y - 0.034;
export const STAND_BASE = new Vector3(PIVOT_WORLD.x, 0, PIVOT_WORLD.z);

/** Audience: rows of seats curving around a point behind the stage. */
export const SEATING = {
  centre: new Vector3(0, 0, -2.2),
  firstRadius: 8.3,
  rowGap: 0.98,
  /** Seats per row (front to back). Must sum to 100. */
  rows: [14, 16, 16, 18, 18, 18] as const,
  pitch: 0.58,
  aisle: 1.15,
};
