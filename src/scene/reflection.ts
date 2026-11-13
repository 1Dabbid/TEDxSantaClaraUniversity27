import {
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  PerspectiveCamera,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { look } from './look';
import { shared } from './materials';
import { EMPTY_MASK } from './textures';

/**
 * Planar reflection of the stage floor (high tier only): the scene objects on
 * REFLECT_LAYER (rug, microphone and stand, beam, dust, curtain, lights) are
 * rendered from the camera mirrored in y = 0 into a half-resolution HDR target with
 * mipmaps; the floor samples it projectively, blurred by roughness and
 * weighted by Fresnel. Skipped (and faded out) in macro shots and whenever
 * the stage is dark.
 */
export const REFLECT_LAYER = 1;
const SCALE = 1 / 2;

export function createReflection(gl: WebGLRenderer) {
  const canHalf = gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float');
  const rt = new WebGLRenderTarget(4, 4, {
    type: canHalf ? HalfFloatType : UnsignedByteType,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
  });
  const cam = new PerspectiveCamera();
  cam.layers.set(REFLECT_LAYER);
  const bias = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const fwd = new Vector3();
  const tgt = new Vector3();
  let on = 0;
  // Debug (?scene-debug=1&reflmul=k): scale the reflection to check its registration.
  let mul = 1;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has('scene-debug')) mul = Number(q.get('reflmul') ?? 1);
  } catch {
    /* ignore */
  }
  shared.uRefl.value = rt.texture;

  return {
    dispose() {
      rt.dispose();
      shared.uReflOn.value = 0;
      if (shared.uRefl.value === rt.texture) shared.uRefl.value = EMPTY_MASK;
    },
    /** Renders the mirrored view if the shot can show it; call before the main render. */
    render(scene: Scene, camera: PerspectiveCamera, width: number, height: number, dt: number) {
      const wide = camera.position.y > 0.25 && camera.near > 0.09 && look.spot > 0.05;
      on += ((wide ? 1 : 0) - on) * Math.min(1, dt * 4);
      shared.uReflOn.value = on * Math.min(1, look.spot * 2) * mul;
      if (on < 0.01) return;
      const w = Math.max(16, Math.round(width * SCALE));
      const h = Math.max(16, Math.round(height * SCALE));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      cam.fov = camera.fov;
      cam.aspect = camera.aspect;
      cam.near = Math.max(0.05, camera.near);
      cam.far = camera.far;
      cam.updateProjectionMatrix();
      camera.getWorldDirection(fwd);
      cam.position.set(camera.position.x, -camera.position.y, camera.position.z);
      tgt.copy(camera.position).add(fwd);
      tgt.y = -tgt.y;
      cam.up.set(camera.up.x, -camera.up.y, camera.up.z);
      cam.lookAt(tgt);
      cam.updateMatrixWorld();
      shared.uReflMat.value.copy(bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
      const prevTarget = gl.getRenderTarget();
      gl.setRenderTarget(rt);
      gl.clear();
      gl.render(scene, cam);
      gl.setRenderTarget(prevTarget);
    },
  };
}
