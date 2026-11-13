import {
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { MIC_AXIS } from './layout';

/**
 * Procedural studio environment: black void with a few thin softbox strips,
 * the way product films light machined metal. Rendered once into a PMREM.
 * No HDR download.
 */
type Strip = { pos: [number, number, number]; size: [number, number]; intensity: number; color?: string; alongMic?: boolean };

/** Direction (from the mic) of a strip that lays a long streak down the barrel for the hero camera. */
const STREAK_DIR = (() => {
  const toHeroCam = new Vector3(Math.sin(0.44), 0.05, Math.cos(0.44)).normalize();
  return toHeroCam.applyQuaternion(new Quaternion().setFromAxisAngle(MIC_AXIS, 0.55)).multiplyScalar(8);
})();
const STREAK_DIR2 = (() => {
  const toHeroCam = new Vector3(Math.sin(0.44), 0.05, Math.cos(0.44)).normalize();
  return toHeroCam.applyQuaternion(new Quaternion().setFromAxisAngle(MIC_AXIS, -1.25)).multiplyScalar(8);
})();

const STRIPS: Strip[] = [
  // Long overhead softbox
  { pos: [0, 9, 0], size: [3.5, 14], intensity: 1.2 },
  // Tall thin rim strips behind left and right
  { pos: [-6, 1.5, -6], size: [0.45, 9], intensity: 12 },
  { pos: [6.5, 2, -4.5], size: [0.35, 9], intensity: 10 },
  // Long strip parallel to the mic axis: the bright specular streak down the barrel
  { pos: [STREAK_DIR.x, STREAK_DIR.y, STREAK_DIR.z], size: [0.6, 16], intensity: 45, alongMic: true },
  // Thinner, dimmer second streak on the shadow side
  { pos: [STREAK_DIR2.x, STREAK_DIR2.y, STREAK_DIR2.z], size: [0.3, 16], intensity: 14, color: '#dfe8ff', alongMic: true },
  // Broad soft panel front-right (the hero side): a soft sheen across the barrel in macro
  { pos: [4.6, 2.2, 7.6], size: [3.2, 4.5], intensity: 0.5 },
  // Side kicker, cool
  { pos: [9, 3, 2], size: [0.5, 6], intensity: 2.5, color: '#dfe8ff' },
  // Warm kicker, opposite
  { pos: [-9, 4, 3], size: [0.4, 5], intensity: 1.6, color: '#ffe9d6' },
];

export function createStudioEnvironment(gl: WebGLRenderer): Texture {
  const scene = new Scene();
  scene.background = new Color('#000000');
  const geo = new PlaneGeometry(1, 1);
  const meshes: Mesh[] = [];
  for (const s of STRIPS) {
    const mat = new MeshBasicMaterial({
      color: new Color(s.color ?? '#ffffff').multiplyScalar(s.intensity),
      side: DoubleSide,
      toneMapped: false,
    });
    const m = new Mesh(geo, mat);
    m.position.set(...s.pos);
    m.scale.set(s.size[0], s.size[1], 1);
    if (s.alongMic) {
      m.up.copy(MIC_AXIS);
      m.lookAt(0, 0, 0);
    } else m.lookAt(0, 1, 0);
    scene.add(m);
    meshes.push(m);
  }
  const pmrem = new PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0, 0.1, 50);
  pmrem.dispose();
  geo.dispose();
  for (const m of meshes) (m.material as MeshBasicMaterial).dispose();
  return rt.texture;
}
