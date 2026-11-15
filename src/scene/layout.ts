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

/**
 * The hero's camera heading (see choreography.ts): from the subject towards
 * the camera, as an azimuth from +Z towards +X. The hero, the push in and the
 * engraving macro look back along it (orbit 0), and everything lit or aimed
 * "for the camera" there (the mic aim, the studio strips, the engraving) is
 * placed relative to it. From the pull out on, the camera orbits away from it
 * (towards the grille side), in one direction only.
 */
export const VIEW_AZ = 0.12;

/**
 * Where every engraved row begins around the barrel (mic-space angle, atan(x, z)). The camera
 * axis meets the barrel at about +0.09; starting the rows a quarter radian to its left puts the
 * column of row starts just right of the theme headline in the macro, with the copy running
 * across the lit face of the barrel instead of the seam between row ends and row starts.
 */
export const ENGRAVING_START_PHI = -0.14;

/** Rug pile height: the stand's foot stands on it. */
export const RUG_TOP = 0.0185;
/** World position of the clip pivot (top of the stand): the stand stands at the centre of the rug. */
export const PIVOT_WORLD = new Vector3(0, 1.43 + RUG_TOP, 0);
/**
 * Mic aim: azimuth (from +Z towards +X) and elevation, radians. The mic points
 * to screen left, seen side-on from the camera axis (a few degrees away from
 * the lens), its grille towards the page copy.
 */
const AIM_AZ = Math.atan2(-Math.cos(VIEW_AZ), Math.sin(VIEW_AZ)) - 0.06;
const AIM_EL = (54 * Math.PI) / 180;

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
/** Where the stand's foot sits: the centre of the rug, on top of the pile. */
export const STAND_BASE = new Vector3(PIVOT_WORLD.x, RUG_TOP, PIVOT_WORLD.z);

/**
 * The house (seats, treads, aisle lights, audience floor, stage front and the
 * stage deck that ends at it) is turned about the stage centre so that it lies
 * in front of the stage, downstage of the microphone, opposite the upstage
 * curtain: the one continuous move (choreography.ts) orbits about 200 degrees
 * round the stand from the hero's heading and ends behind the microphone at a
 * speaker's eye height, looking out past the grille over the seats. HOUSE_AZ
 * is set so that view looks over the grille at the middle of the house, and
 * the crane over Venue sees the rows sweep across beyond the rug. The house
 * axis points along azimuth HOUSE_AZ (from +Z towards
 * +X). SEATING, STAGE_EDGE_Z and the house geometry are written in house space
 * (+Z towards the audience); `toHouse` takes a world point there, `fromHouse`
 * the other way. The curtain, the rug, the spot and the microphone stay in
 * world space.
 */
export const HOUSE_AZ = 0.2;
const HOUSE_COS = Math.cos(HOUSE_AZ);
const HOUSE_SIN = Math.sin(HOUSE_AZ);
/** World point -> house space (x across the house, z towards the audience). */
export function toHouse(p: Vector3, out = new Vector3()): Vector3 {
  return out.set(p.x * HOUSE_COS - p.z * HOUSE_SIN, p.y, p.x * HOUSE_SIN + p.z * HOUSE_COS);
}
/** House space -> world point. */
export function fromHouse(p: Vector3, out = new Vector3()): Vector3 {
  return out.set(p.x * HOUSE_COS + p.z * HOUSE_SIN, p.y, -p.x * HOUSE_SIN + p.z * HOUSE_COS);
}

/** Audience (house space): rows of seats curving around a point behind the stage. */
export const SEATING = {
  centre: new Vector3(0, 0, -2.2),
  firstRadius: 8.3,
  rowGap: 0.98,
  /** Seats per row (front to back). Must sum to 100. */
  rows: [14, 16, 16, 18, 18, 18] as const,
  pitch: 0.58,
  aisle: 1.15,
};

/** Seats in front of each row (the lighting order's row starts). */
export const ROW_STARTS: readonly number[] = SEATING.rows.map((_, r) => SEATING.rows.slice(0, r).reduce((a, b) => a + b, 0));
/** Total seats in the house. */
export const HOUSE_SEATS = SEATING.rows.reduce((a, b) => a + b, 0);
/**
 * A seat's place in the build order (Seats.tsx): row by row from the front,
 * the -X half of each row then the +X half, each half counted from the aisle.
 * `side` is -1 / +1 (which half of the row), `k` the seat's index in its half.
 */
export function seatIndex(row: number, side: number, k: number): number {
  return ROW_STARTS[row] + (side < 0 ? 0 : SEATING.rows[row] / 2) + k;
}

/** A seat's angle about the seating centre (house space, radians, + towards house +X). */
function seatAngle(row: number, side: number, k: number): number {
  return (side * (SEATING.aisle / 2 + SEATING.pitch * (k + 0.5))) / (SEATING.firstRadius + row * SEATING.rowGap);
}

/**
 * The lighting order sweeps across the whole house, left to right as seen from
 * the back (house -X to +X, where the Tickets camera stands), like the ruler
 * under the counter printing its ticks, with the front rows a little ahead of
 * the back ones (SEAT_SWEEP_ROW of the sweep). So every row the camera shows
 * keeps lighting up for the whole count, 1 to 100, on any screen.
 */
export const SEAT_SWEEP_ROW = 0.22;
/** Build index (seatIndex) -> place in the lighting order (0-based; a permutation of 0 .. HOUSE_SEATS - 1). */
export const SEAT_ORDER: readonly number[] = (() => {
  const seats: { i: number; key: number }[] = [];
  const aMax = seatAngle(0, 1, SEATING.rows[0] / 2 - 1);
  SEATING.rows.forEach((n, row) => {
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < n / 2; k++) {
        const u = (seatAngle(row, side, k) + aMax) / (2 * aMax);
        seats.push({ i: seatIndex(row, side, k), key: u * (1 - SEAT_SWEEP_ROW) + (row / (SEATING.rows.length - 1)) * SEAT_SWEEP_ROW });
      }
    }
  });
  const order = new Array<number>(seats.length);
  seats
    .slice()
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .forEach((s, rank) => {
      order[s.i] = rank;
    });
  return order;
})();
/** A seat's place in the lighting order (0-based): seat n + 1 lights when the counter reaches n + 1. */
export function seatOrder(row: number, side: number, k: number): number {
  return SEAT_ORDER[seatIndex(row, side, k)];
}

/** Front edge of the raised stage (z), the audience floor below it, and each seating row's tread height (raked). */
export const STAGE_EDGE_Z = 5.0;
export const AUDIENCE_FLOOR_Y = -0.55;
export const rowHeight = (row: number) => AUDIENCE_FLOOR_Y + row * 0.13;
