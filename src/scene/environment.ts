import {
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * Procedural studio environment: black void with a few thin softbox strips,
 * the way product films light machined metal. Rendered once into a PMREM.
 * No HDR download.
 */
type Strip = { pos: [number, number, number]; size: [number, number]; intensity: number; color?: string };

const STRIPS: Strip[] = [
  // Long overhead softbox
  { pos: [0, 9, 0], size: [3.5, 14], intensity: 1.6 },
  // Tall thin rim strips behind left and right
  { pos: [-6, 1.5, -6], size: [0.45, 9], intensity: 12 },
  { pos: [6.5, 2, -4.5], size: [0.35, 9], intensity: 10 },
  // Broad soft panel front-right (the hero side): a soft sheen across the barrel in macro
  { pos: [4.6, 2.2, 7.6], size: [3.2, 4.5], intensity: 1.1 },
  // Low front fill strip (gives the barrel a horizon line)
  { pos: [0, 0.4, 9], size: [12, 0.25], intensity: 1.4 },
  // Side kicker, cool
  { pos: [9, 3, 2], size: [0.5, 6], intensity: 3, color: '#dfe8ff' },
  // Warm kicker, opposite
  { pos: [-9, 4, 3], size: [0.4, 5], intensity: 2, color: '#ffe9d6' },
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
    m.lookAt(0, 1, 0);
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
