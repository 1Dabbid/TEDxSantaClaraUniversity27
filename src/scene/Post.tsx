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
  type PerspectiveCamera,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import { look } from './look';
import { createReflection } from './reflection';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const HASH = /* glsl */ `
  float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`;

/**
 * Single fullscreen composite (high tier): edge chromatic aberration, fake
 * depth of field around a focus point (mip blur), thresholded mip bloom on
 * true highlights only, a short anamorphic streak on the brightest speculars,
 * vignette, scrims, tone map, a black-point toe for rich blacks, fine grain.
 */
const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tScene; uniform vec2 uRes; uniform float uTime; uniform float uDof; uniform vec2 uFocus;
  uniform float uVig; uniform float uGrain; uniform float uBloom; uniform float uShade; uniform float uScrim;
  uniform float uStreak; uniform float uCA; uniform float uEdge;
  varying vec2 vUv;
  ${HASH}
  // NaN / Inf guard: a single bad pixel would otherwise smear through every mip as a box.
  vec3 tap(vec2 uv, float lod) {
    vec3 c = textureLod(tScene, uv, lod).rgb;
    return (any(isnan(c)) || any(isinf(c))) ? vec3(0.0) : min(c, vec3(64.0));
  }
  // Keep only the part of a colour above a luminance threshold (soft knee).
  vec3 hi(vec3 c, float thr) {
    c = min(c, vec3(3.0));
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = max(l - thr, 0.0);
    return c * (k * k / (k + 0.25 * thr)) / max(l, 1e-4);
  }
  // Four diagonal taps around a mip level: hides the box shape of single mip texels.
  vec3 soft(vec2 uv, float lod) {
    vec2 o = exp2(lod) * 0.75 / uRes;
    return 0.25 * (hi(tap(uv + vec2(o.x, o.y), lod), 1.3) + hi(tap(uv + vec2(-o.x, o.y), lod), 1.3)
                 + hi(tap(uv + vec2(o.x, -o.y), lod), 1.3) + hi(tap(uv + vec2(-o.x, -o.y), lod), 1.3));
  }
  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 c = uv - 0.5; c.x *= aspect;
    float r = length(c);
    vec2 fc = uv - uFocus; fc.x *= aspect;
    float rf = length(fc);
    vec2 ca = (uv - 0.5) * uCA * smoothstep(0.45, 1.0, r);
    vec3 col = vec3(tap(uv - ca, 0.0).r, tap(uv, 0.0).g, tap(uv + ca, 0.0).b);
    float blur = uDof * smoothstep(0.1, 0.72, rf);
    if (blur > 0.004) {
      float lod = blur * 4.5;
      vec2 px = exp2(lod) / uRes;
      vec3 b = tap(uv + vec2(px.x, 0.5 * px.y), lod) + tap(uv + vec2(-0.5 * px.x, px.y), lod)
             + tap(uv + vec2(-px.x, -0.5 * px.y), lod) + tap(uv + vec2(0.5 * px.x, -px.y), lod);
      col = mix(col, b * 0.25, smoothstep(0.0, 0.3, blur));
    }
    vec3 bl = hi(tap(uv, 2.0), 1.2) * 0.4 + soft(uv, 3.5) * 0.35 + soft(uv, 5.0) * 0.3;
    col += bl * uBloom;
    if (uStreak > 0.001) {
      vec3 sk = vec3(0.0);
      for (int i = 1; i <= 6; i++) {
        float fi = float(i);
        vec2 d = vec2(fi * 11.0 / uRes.x, 0.0);
        float w = exp(-fi * 0.5);
        sk += (hi(tap(uv + d, 2.0), 2.5) + hi(tap(uv - d, 2.0), 2.5)) * w;
      }
      col += sk * uStreak * vec3(0.7, 0.82, 1.0);
    }
    col *= mix(1.0, smoothstep(1.2, 0.18, r), uVig);
    col *= 1.0 - uShade * smoothstep(0.52, 0.78, uv.x);
    col *= 1.0 - uScrim * (1.0 - smoothstep(0.3, 0.66, uv.x));
    col *= 1.0 - uEdge * max(1.0 - smoothstep(0.0, 0.17, uv.y), smoothstep(0.78, 0.9, uv.y));
    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    // Black point toe (the darkest values sink to true black) and a gentle S-curve: the low mids
    // drop away instead of sitting as a grey veil, highlights get a little more snap.
    vec3 g0 = clamp(gl_FragColor.rgb, 0.0, 1.0);
    vec3 gt = g0 * smoothstep(0.0, 0.07, g0);
    gl_FragColor.rgb = mix(gt, gt * gt * (3.0 - 2.0 * gt), 0.22);
    float lum = dot(g0, vec3(0.333));
    float g = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 917.0) - 0.5;
    gl_FragColor.rgb += g * uGrain * (0.35 + 0.65 * smoothstep(0.0, 0.25, lum));
  }`;

/** Low tier: no offscreen pass, just a blended vignette + scrim + grain veil over the frame. */
const OVERLAY_FRAG = /* glsl */ `
  uniform vec2 uRes; uniform float uTime; uniform float uVig; uniform float uGrain; uniform float uShade; uniform float uScrim; uniform float uEdge;
  varying vec2 vUv;
  ${HASH}
  void main() {
    vec2 c = vUv - 0.5; c.x *= uRes.x / uRes.y;
    float v = (1.0 - smoothstep(1.2, 0.18, length(c))) * uVig;
    v = 1.0 - (1.0 - v) * (1.0 - uShade * smoothstep(0.52, 0.78, vUv.x)) * (1.0 - uScrim * (1.0 - smoothstep(0.3, 0.66, vUv.x))) * (1.0 - uEdge * max(1.0 - smoothstep(0.0, 0.17, vUv.y), smoothstep(0.78, 0.9, vUv.y)));
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
export default function Post({ post, reflect = false }: { post: boolean; reflect?: boolean }) {
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
        uFocus: { value: new Vector2(0.5, 0.5) },
        uVig: { value: 0.6 },
        uGrain: { value: 0.035 },
        uBloom: { value: 0.6 },
        uShade: { value: 0 },
        uScrim: { value: 0 },
        uStreak: { value: 0.12 },
        uCA: { value: 0.0015 },
        uEdge: { value: 0 },
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
        uScrim: { value: 0 },
        uEdge: { value: 0 },
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

  // Compile the composite / overlay programs before they are first needed.
  useEffect(() => {
    const { gl } = get();
    gl.compileAsync(post ? res.compScene : res.overScene, res.cam).catch(() => {});
  }, [get, res, post]);

  useEffect(
    () => () => {
      res.rt.dispose();
      res.tri.dispose();
      res.composite.dispose();
      res.overlay.dispose();
    },
    [res],
  );

  // Planar floor reflection (high tier only): one small extra scene pass, skipped in macro shots.
  const reflection = useMemo(() => (reflect ? createReflection(get().gl) : null), [reflect, get]);
  useEffect(() => () => reflection?.dispose(), [reflection]);

  const resRef = useRef(res);
  useEffect(() => {
    resRef.current = res;
  }, [res]);

  useFrame((state, dt) => {
    const { scene, camera, gl } = state;
    const res = resRef.current;
    const t = state.clock.elapsedTime;
    gl.toneMappingExposure = look.exposure;
    if (reflection) {
      const w = Math.floor(state.size.width * state.viewport.dpr);
      const h = Math.floor(state.size.height * state.viewport.dpr);
      reflection.render(scene, camera as PerspectiveCamera, w, h, Math.min(dt, 0.1));
    }
    if (post) {
      const u = res.composite.uniforms;
      u.uTime.value = t;
      u.uDof.value = look.dof;
      u.uVig.value = look.vignette;
      u.uShade.value = look.shade;
      u.uScrim.value = look.scrim;
      u.uEdge.value = look.scrimEdge;
      u.uBloom.value = 0.45 * look.bloom;
      (u.uFocus.value as Vector2).set(look.focusX, look.focusY);
      u.uGrain.value = 0.028 * Math.min(1, look.exposure * 2);
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
      u.uScrim.value = look.scrim * 0.8;
      u.uEdge.value = look.scrimEdge;
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
