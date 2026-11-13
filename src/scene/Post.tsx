'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import { look } from './look';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const HASH = /* glsl */ `
  float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`;

/** Single fullscreen composite: fake DOF (mip blur at the edges), mip bloom, vignette, tone map, grain. */
const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tScene; uniform vec2 uRes; uniform float uTime; uniform float uDof; uniform float uVig;
  uniform float uGrain; uniform float uBloom; uniform float uShade;
  varying vec2 vUv;
  ${HASH}
  vec3 tap(vec2 uv, float lod) { return textureLod(tScene, uv, lod).rgb; }
  void main() {
    vec2 uv = vUv;
    vec2 c = uv - 0.5; c.x *= uRes.x / uRes.y;
    float r = length(c);
    vec3 col = tap(uv, 0.0);
    float blur = uDof * smoothstep(0.16, 0.78, r);
    if (blur > 0.004) {
      float lod = blur * 4.5;
      vec2 px = exp2(lod) / uRes;
      vec3 b = tap(uv + vec2(px.x, 0.5 * px.y), lod) + tap(uv + vec2(-0.5 * px.x, px.y), lod)
             + tap(uv + vec2(-px.x, -0.5 * px.y), lod) + tap(uv + vec2(0.5 * px.x, -px.y), lod);
      col = mix(col, b * 0.25, smoothstep(0.0, 0.3, blur));
    }
    vec3 bl = tap(uv, 3.0) * 0.25 + tap(uv, 5.0) * 0.4 + tap(uv, 7.0) * 0.35;
    float bll = dot(bl, vec3(0.2126, 0.7152, 0.0722));
    col += bl * uBloom * smoothstep(0.05, 0.9, bll);
    col *= mix(1.0, smoothstep(1.15, 0.2, r), uVig);
    col *= 1.0 - uShade * smoothstep(0.52, 0.78, uv.x);
    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    float g = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 917.0) - 0.5;
    gl_FragColor.rgb += g * uGrain;
  }`;

/** Low tier: no offscreen pass, just a blended vignette + grain veil over the frame. */
const OVERLAY_FRAG = /* glsl */ `
  uniform vec2 uRes; uniform float uTime; uniform float uVig; uniform float uGrain; uniform float uShade;
  varying vec2 vUv;
  ${HASH}
  void main() {
    vec2 c = vUv - 0.5; c.x *= uRes.x / uRes.y;
    float v = (1.0 - smoothstep(1.15, 0.2, length(c))) * uVig;
    v = 1.0 - (1.0 - v) * (1.0 - uShade * smoothstep(0.52, 0.78, vUv.x));
    float g = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 917.0) - 0.5;
    float lift = max(g, 0.0) * uGrain;
    float a = clamp(v + max(-g, 0.0) * uGrain, 0.0, 1.0);
    gl_FragColor = vec4(vec3(lift), a);
  }`;

function setSamples(rt: WebGLRenderTarget, samples: number) {
  if (rt.samples === samples) return;
  rt.dispose();
  rt.samples = samples;
}

function fullscreenTriangle() {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  return g;
}

/**
 * Owns rendering (useFrame priority 1). With `post` on: scene → HDR MSAA
 * target with mipmaps → one composite pass. Otherwise renders straight to the
 * screen with a cheap blended vignette/grain veil.
 */
export default function Post({ post }: { post: boolean }) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const res = useMemo(() => {
    const { gl } = get();
    const canHalf = gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float');
    const rt = new WebGLRenderTarget(4, 4, {
      type: canHalf ? HalfFloatType : UnsignedByteType,
      samples: gl.capabilities.isWebGL2 ? 4 : 0,
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
    });
    const tri = fullscreenTriangle();
    const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const composite = new ShaderMaterial({
      uniforms: {
        tScene: { value: rt.texture },
        uRes: { value: new Vector2(1, 1) },
        uTime: { value: 0 },
        uDof: { value: 0 },
        uVig: { value: 0.6 },
        uGrain: { value: 0.035 },
        uBloom: { value: 0.35 },
        uShade: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const overlay = new ShaderMaterial({
      uniforms: {
        uRes: { value: new Vector2(1, 1) },
        uTime: { value: 0 },
        uVig: { value: 0.6 },
        uGrain: { value: 0.03 },
        uShade: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: OVERLAY_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      toneMapped: false,
    });
    const compScene = new Scene();
    const compMesh = new Mesh(tri, composite);
    compMesh.frustumCulled = false;
    compScene.add(compMesh);
    const overScene = new Scene();
    const overMesh = new Mesh(tri, overlay);
    overMesh.frustumCulled = false;
    overScene.add(overMesh);
    return { rt, tri, cam, composite, overlay, compScene, overScene };
  }, [get]);

  useEffect(() => {
    const w = Math.max(1, Math.floor(size.width * dpr));
    const h = Math.max(1, Math.floor(size.height * dpr));
    // MSAA cost scales with pixel count; at high DPR the extra density already antialiases.
    const samples = dpr > 1.6 ? 0 : dpr > 1.2 ? 2 : 4;
    if (get().gl.capabilities.isWebGL2) setSamples(res.rt, samples);
    if (post) res.rt.setSize(w, h);
    (res.composite.uniforms.uRes.value as Vector2).set(w, h);
    (res.overlay.uniforms.uRes.value as Vector2).set(w, h);
  }, [post, res, size, dpr, get]);

  useEffect(
    () => () => {
      res.rt.dispose();
      res.tri.dispose();
      res.composite.dispose();
      res.overlay.dispose();
    },
    [res],
  );

  const resRef = useRef(res);
  useEffect(() => {
    resRef.current = res;
  }, [res]);

  useFrame((state) => {
    const { scene, camera, gl } = state;
    const res = resRef.current;
    const t = state.clock.elapsedTime;
    gl.toneMappingExposure = look.exposure;
    if (post) {
      const u = res.composite.uniforms;
      u.uTime.value = t;
      u.uDof.value = look.dof;
      u.uVig.value = look.vignette;
      u.uShade.value = look.shade;
      u.uGrain.value = 0.03 * Math.min(1, look.exposure * 2);
      gl.setRenderTarget(res.rt);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      gl.render(res.compScene, res.cam);
    } else {
      const u = res.overlay.uniforms;
      u.uTime.value = t;
      u.uVig.value = Math.min(1, look.vignette + look.dof * 0.25);
      u.uShade.value = look.shade;
      u.uGrain.value = 0.028 * Math.min(1, look.exposure * 2);
      gl.render(scene, camera);
      const auto = gl.autoClear;
      gl.autoClear = false;
      gl.render(res.overScene, res.cam);
      gl.autoClear = auto;
    }
  }, 1);

  return null;
}
