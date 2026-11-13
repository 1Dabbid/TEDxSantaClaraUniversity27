import {
  AdditiveBlending,
  Color,
  Matrix4,
  BackSide,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector3,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { MIC, PIVOT_WORLD, RUG_RADIUS, SEATING, SPOT_HEIGHT, STAGE_EDGE_Z, STAND_BASE } from './layout';
import { EMPTY_MASK } from './textures';

/* ------------------------------------------------------------------------- */
/* Shared per-frame uniforms                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Uniform objects shared by every patched material, written once per frame by
 * the camera rig (Experience). Sharing the objects means one write updates all
 * programs.
 */
export const shared = {
  /** World position of the mic key light (glints are computed against it). */
  uKeyPos: { value: new Vector3(2, 2, 2) },
  /** Key colour x intensity, for procedural glints. */
  uKeyColor: { value: new Color(1, 1, 1) },
  /** World direction towards the rim light (camera-relative, set per shot). */
  uRimDir: { value: new Vector3(0, 1, 0) },
  /** Rim colour x intensity. */
  uRimColor: { value: new Color(0, 0, 0) },
  /** Overhead spot multiplier (pool, bounce, floor reflection). */
  uSpot: { value: 1 },
  /** Volumetric cone multiplier (floor reflection of the beam). */
  uCone: { value: 1 },
  uTime: { value: 0 },
  /** Planar floor reflection (high tier): texture, world -> texture matrix, 0..1 strength. */
  uRefl: { value: EMPTY_MASK as Texture },
  uReflMat: { value: new Matrix4() },
  uReflOn: { value: 0 },
};

/* ------------------------------------------------------------------------- */
/* GLSL helpers                                                              */
/* ------------------------------------------------------------------------- */

export const GLSL_NOISE = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
`;

/** Fragment-only helpers. */
const GLSL_BUMP = /* glsl */ `
// Screen-space bump: perturb view-space normal by a height signal h.
vec3 bumpNormal(vec3 n, vec3 viewPos, float h, float scale) {
  vec3 sx = dFdx(viewPos); vec3 sy = dFdy(viewPos);
  vec3 r1 = cross(sy, n); vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * scale * r1 + dFdy(h) * scale * r2);
  return normalize(abs(det) * n - grad);
}
`;

/** Lighting helpers for patched lit materials (need vWorld, vViewPosition). */
const GLSL_LIGHT = /* glsl */ `
uniform vec3 uKeyPos; uniform vec3 uKeyColor; uniform vec3 uRimDir; uniform vec3 uRimColor;
uniform float uSpot; uniform float uCone; uniform float uTime;
vec3 toWorld(vec3 nView) { return normalize((vec4(nView, 0.0) * viewMatrix).xyz); }
// Thin, hard rim: grazing normals that face the rim light.
float rimTerm(vec3 nView, float width) {
  vec3 L = normalize((viewMatrix * vec4(uRimDir, 0.0)).xyz);
  float f = 1.0 - clamp(dot(nView, normalize(vViewPosition)), 0.0, 1.0);
  return smoothstep(1.0 - width, 1.0 - width * 0.25, f) * clamp(dot(nView, L) * 1.6, 0.0, 1.0);
}
// Very sharp highlight of the key light for a (perturbed) world normal.
float keyGlint(vec3 nW, float sharp) {
  vec3 L = normalize(uKeyPos - vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 H = normalize(L + V + vec3(1e-5));
  return pow(max(dot(nW, H), 0.0), sharp) * step(0.0, dot(nW, L));
}
// Broad GGX lobe of the key light (roughness r) times N.L: the round specular hotspot of a glossy form.
float keyLobe(vec3 nW, float r) {
  vec3 L = normalize(uKeyPos - vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 H = normalize(L + V + vec3(1e-5));
  float a2 = r * r * r * r;
  float nh = max(dot(nW, H), 0.0);
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * d * d) * max(dot(nW, L), 0.0);
}
// Box-filtered pulse train (pulses of half-width w centred on x = k + 0.5) over a footprint fw:
// exact area coverage, so a weave fades to its average instead of shimmering.
float pulseI(float x, float w) { return floor(x) * 2.0 * w + clamp(fract(x) - 0.5 + w, 0.0, 2.0 * w); }
float pulseF(float x, float w, float fw) {
  fw = max(fw, 1e-3);
  return (pulseI(x + 0.5 * fw, w) - pulseI(x - 0.5 * fw, w)) / fw;
}
// Level-of-detail glitter: cells about 1.5 px wide, each a tiny randomly tilted mirror.
float glitter(vec2 sp, vec3 n, vec3 T, vec3 B, float density, float tilt, float sharp) {
  float px = max(length(fwidth(sp)), 1e-7);
  float lvl = ceil(log2(px * 1.6));
  float cs = exp2(lvl);
  vec2 gc = floor(sp / cs);
  float on = step(1.0 - density, hash12(gc + lvl * 17.0));
  vec2 j = vec2(hash12(gc + 3.1 + lvl), hash12(gc + 5.7 - lvl)) * 2.0 - 1.0;
  vec3 ng = normalize(n + (j.x * T + j.y * B) * tilt);
  return on * keyGlint(toWorld(ng), sharp);
}
`;

type Patch = {
  uniforms: Record<string, { value: unknown }>;
  vertexHead?: string;
  vertexBody?: string;
  fragmentHead?: string;
  /** Runs just before alpha test (may edit diffuseColor.a). */
  alphaBody?: string;
  /** Runs after normal_fragment_maps: may edit diffuseColor, roughnessFactor, metalnessFactor, normal, totalEmissiveRadiance, ccMul. */
  fragmentBody: string;
  /**
   * Drop image-based lighting entirely. Needed because three replaces a
   * material's envMapIntensity with scene.environmentIntensity whenever the
   * scene environment is used, so a per-material 0 would be ignored.
   */
  noEnv?: boolean;
};

function patch(material: MeshStandardMaterial, key: string, p: Patch) {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, shared, p.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj;\nvarying vec3 vWorld;\n${p.vertexHead ?? ''}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvObj = position;\nvWorld = (modelMatrix * vec4(position, 1.0)).xyz;\n${p.vertexBody ?? ''}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vObj;\nvarying vec3 vWorld;\n${GLSL_NOISE}\n${GLSL_BUMP}\n${GLSL_LIGHT}\n${p.fragmentHead ?? ''}`,
      )
      .replace('#include <alphatest_fragment>', `{\n${p.alphaBody ?? ''}\n}\n#include <alphatest_fragment>`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\nfloat ccMul = 1.0;\nfloat sheenMul = 1.0;\n{\n${p.fragmentBody}\n}`)
      .replace('material.clearcoat = clearcoat;', 'material.clearcoat = clearcoat * ccMul;')
      .replace('material.sheenColor = sheenColor;', 'material.sheenColor = sheenColor * sheenMul;');
    if (p.noEnv) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', '');
  };
  material.customProgramCacheKey = () => key;
  material.userData.patchUniforms = p.uniforms;
}

const lin = (hex: string) => new Color(hex); // Color() converts sRGB hex to linear working space

/* ------------------------------------------------------------------------- */
/* Microphone                                                                */
/* ------------------------------------------------------------------------- */

export type BodyUniforms = { uMask: { value: Texture }; uMaskTexel: { value: [number, number] } };

/**
 * Black anodised, turned barrel: circumferential tool marks (anisotropic
 * highlight running down the barrel), clear sealed coat, laser-etched band of
 * bare frosted aluminium with bright bevelled walls and glitter, micro
 * scratches that only resolve in macro, knurled grip.
 */
export function createBodyMaterial(cheap: boolean) {
  const uniforms = {
    uMask: { value: EMPTY_MASK as Texture },
    uMaskTexel: { value: [1 / 4096, 1 / 2048] as [number, number] },
    uBand: { value: [MIC.bandY[0], MIC.bandY[1]] },
    uKnurl: { value: [MIC.knurlY[0], MIC.knurlY[1], MIC.knurlR] },
    uKnurlN: { value: 72 },
    uDepth: { value: 9e-5 },
    uEtch: { value: lin('#b9bbbf') },
    /** 0..1: fades the engraving in once its mask has been built. */
    uMaskOn: { value: 0 },
  };
  const params = { color: lin('#2b2c31'), metalness: 1, roughness: 0.3, envMapIntensity: 1.25 };
  const m = cheap
    ? new MeshStandardMaterial(params)
    : new MeshPhysicalMaterial({
        ...params,
        anisotropy: 0.3,
        anisotropyRotation: Math.PI / 2,
        clearcoat: 0.45,
        clearcoatRoughness: 0.2,
      });
  patch(m, `mic-body-${cheap ? 1 : 0}`, {
    uniforms,
    vertexHead: 'varying vec3 vTanV; varying vec3 vBitV;',
    vertexBody: `
      vec3 tObj = normalize(vec3(position.z, 0.0, -position.x) + vec3(1e-7, 0.0, 0.0));
      vTanV = normalize(normalMatrix * tObj);
      vBitV = normalize(normalMatrix * cross(normal, tObj));`,
    fragmentHead: `
      varying vec3 vTanV; varying vec3 vBitV;
      uniform sampler2D uMask; uniform vec2 uMaskTexel; uniform vec2 uBand; uniform vec3 uKnurl;
      uniform float uKnurlN; uniform float uDepth; uniform vec3 uEtch; uniform float uMaskOn;`,
    fragmentBody: `
      float r = length(vObj.xz);
      float phi = atan(vObj.x, vObj.z);
      vec3 T = normalize(vTanV);
      vec3 B = normalize(vBitV);
      vec2 sp = vec2(phi * r, vObj.y);
      // Turned finish: fine circumferential tool marks.
      float fy = fwidth(vObj.y);
      float k1 = 1.0 - smoothstep(0.3, 1.0, fy * 16000.0);
      float k2 = 1.0 - smoothstep(0.3, 1.0, fy * 2600.0);
      float l1 = mix(0.5, hash11(floor(vObj.y * 16000.0)), k1);
      float l2 = mix(0.5, hash11(floor(vObj.y * 2600.0) + 17.0), k2);
      roughnessFactor = clamp(roughnessFactor * (0.72 + 0.4 * l1 + 0.25 * l2), 0.05, 1.0);
      diffuseColor.rgb *= 0.88 + 0.24 * l2;
      normal = normalize(normal + B * (l1 - 0.5) * 0.05 * k1);

      // Micro scratches: only where they resolve (macro), they catch the key.
      float ks = 1.0 - smoothstep(0.25, 0.9, fy * 3500.0);
      float scratch = 0.0;
      if (ks > 0.0) {
        vec2 sg = sp * 700.0;
        vec2 cell = floor(sg);
        vec2 f = fract(sg) - 0.5;
        float a = hash12(cell) * 3.14159;
        vec2 dir = vec2(cos(a), sin(a));
        float dl = abs(dot(f, vec2(-dir.y, dir.x)));
        float len = abs(dot(f, dir));
        float w = fwidth(sg.y) * 0.7 + 0.004;
        scratch = step(0.62, hash12(cell + 7.1)) * (1.0 - smoothstep(0.0, w, dl)) * (1.0 - smoothstep(0.25, 0.5, len)) * ks;
        vec3 nS = normalize(normal + (-dir.y * T + dir.x * B) * 0.6 * sign(hash12(cell + 2.0) - 0.5));
        totalEmissiveRadiance += uKeyColor * scratch * keyGlint(toWorld(nS), 40.0) * 0.06;
        roughnessFactor = mix(roughnessFactor, 0.1, scratch * 0.7);
      }

      float bv = (vObj.y - uBand.x) / (uBand.y - uBand.x);
      if (bv > 0.0 && bv < 1.0 && r > 0.005) {
        vec2 uv = vec2(phi * 0.15915494, bv);
        vec2 dx = dFdx(uv); vec2 dy = dFdy(uv);
        dx.x -= floor(dx.x + 0.5); dy.x -= floor(dy.x + 0.5);
        float mr = textureGrad(uMask, uv, dx, dy).r;
        float tpp = max(max(abs(dx.x), abs(dy.x)) / uMaskTexel.x, max(abs(dx.y), abs(dy.y)) / uMaskTexel.y);
        vec2 e = max(uMaskTexel * 1.0, max(abs(dx), abs(dy)));
        float mxp = textureGrad(uMask, uv + vec2(e.x, 0.0), dx, dy).r;
        float mxn = textureGrad(uMask, uv - vec2(e.x, 0.0), dx, dy).r;
        float myp = textureGrad(uMask, uv + vec2(0.0, e.y), dx, dy).r;
        float myn = textureGrad(uMask, uv - vec2(0.0, e.y), dx, dy).r;
        vec2 grad = vec2((mxp - mxn) / (2.0 * e.x * 6.2831853 * r), (myp - myn) / (2.0 * e.y * (uBand.y - uBand.x)));
        float resolved = 1.0 - smoothstep(0.8, 2.5, tpp);
        // Razor glyph edges where the texture is magnified; mip average otherwise.
        float fwm = fwidth(mr);
        float mSharp = smoothstep(0.5 - fwm * 0.7 - 0.02, 0.5 + fwm * 0.7 + 0.02, mr);
        float m = mix(mr, mSharp, resolved);
        float wall = 4.0 * mr * (1.0 - mr) * resolved * uMaskOn;
        m *= uMaskOn;
        grad *= uMaskOn;
        normal = normalize(normal + uDepth * (grad.x * T + grad.y * B) * mix(0.35, 1.0, resolved));
        // Etched floor: frosted bare aluminium. Walls: bright polished bevel.
        float kf = 1.0 - smoothstep(0.3, 1.0, fy * 60000.0);
        float frost = 0.8 + 0.4 * mix(0.5, hash12(floor(sp * 60000.0)), kf);
        vec3 etchCol = uEtch * frost;
        diffuseColor.rgb = mix(diffuseColor.rgb, etchCol, m);
        diffuseColor.rgb = mix(diffuseColor.rgb, uEtch * 1.15, wall * 0.8);
        metalnessFactor = mix(metalnessFactor, 1.0, max(m, wall));
        roughnessFactor = mix(roughnessFactor, 0.36, m);
        roughnessFactor = mix(roughnessFactor, 0.1, wall);
        ccMul = 1.0 - max(m, wall) * 0.9;
        // Glitter of the frosted floor and wall facets as the key sweeps.
        float gl = glitter(sp, normal, T, B, 0.035, 0.42, 420.0);
        totalEmissiveRadiance += uKeyColor * gl * (m * 0.9 + wall) * 0.12;
      }

      if (vObj.y > uKnurl.x && vObj.y < uKnurl.y) {
        float P = 6.2831853 * uKnurl.z / uKnurlN;
        float s = phi * uKnurl.z;
        vec2 ab = vec2(s + vObj.y, s - vObj.y) / P;
        vec2 f = fract(ab) - 0.5;
        vec2 tri = 1.0 - 2.0 * abs(f);
        float h = min(tri.x, tri.y);
        vec2 dh = tri.x < tri.y ? vec2(-sign(f.x), -sign(f.x)) : vec2(-sign(f.y), sign(f.y));
        float flatTop = smoothstep(0.78, 0.86, h);
        dh *= (1.0 - flatTop) * 0.75;
        float fw = length(fwidth(vObj)) / P;
        float k = 1.0 - smoothstep(0.25, 0.8, fw);
        vec3 nk = normalize(normal - (dh.x * T + dh.y * B));
        normal = normalize(mix(normal, nk, k));
        diffuseColor.rgb *= mix(1.0, 0.45 + 0.75 * smoothstep(0.0, 0.35, h), k);
        roughnessFactor = mix(roughnessFactor + 0.1, roughnessFactor * (0.6 + 0.4 * flatTop), k);
        ccMul = 0.3;
        totalEmissiveRadiance += uKeyColor * k * flatTop * keyGlint(toWorld(normal), 220.0) * 0.08;
        totalEmissiveRadiance += uKeyColor * (1.0 - k) * glitter(sp, normal, T, B, 0.03, 0.5, 300.0) * 0.06;
      }
      totalEmissiveRadiance += uRimColor * rimTerm(normal, 0.32);`,
  });
  return { material: m, uniforms };
}

/**
 * Two-layer woven grille in dark chrome over a black foam core: outer weave
 * with real over/under wires (analytically box-filtered, so it fades to a
 * micro-facet average instead of shimmering as it approaches pixel size), a
 * broad round key hotspot across the ball, crisp glints on the crossings that
 * travel with the key and the camera, an inner finer mesh seen with parallax
 * through deep dark gaps, and a tight fresnel rim.
 */
export function createGrilleMaterial(cheap: boolean) {
  const uniforms = {
    uGC: { value: MIC.grilleC },
    uGR: { value: MIC.grilleR },
    uSquash: { value: MIC.grilleSquash },
    // Low tier: a coarser weave that still resolves on small screens.
    uPitch: { value: cheap ? 0.0026 : 0.0013 },
    uWire: { value: 0.16 },
    uAmp: { value: 0.09 },
    uInner: { value: 1.3 },
    uFoam: { value: lin('#030304') },
  };
  const m = new MeshStandardMaterial({ color: lin('#6d7178'), metalness: 1, roughness: 0.12, envMapIntensity: 0.24 });
  patch(m, `mic-grille-${cheap ? 1 : 0}`, {
    uniforms,
    fragmentHead: `uniform float uGC; uniform float uGR; uniform float uSquash; uniform float uPitch; uniform float uWire; uniform float uAmp; uniform float uInner; uniform vec3 uFoam;`,
    fragmentBody: `
      vec3 q = vObj - vec3(0.0, uGC, 0.0); q.y /= uSquash;
      vec3 d = normalize(q);
      vec2 st = d.xz * uGR / sqrt(max(0.5 * (1.0 + d.y), 0.02));
      vec2 g = st / uPitch;
      vec3 N = normal;
      vec3 Vv = normalize(vViewPosition);
      vec3 pos = -vViewPosition;
      vec3 dp1 = dFdx(pos); vec3 dp2 = dFdy(pos);
      vec2 duv1 = dFdx(g); vec2 duv2 = dFdy(g);
      vec3 dp2perp = cross(dp2, N); vec3 dp1perp = cross(N, dp1);
      vec3 Tg = dp2perp * duv1.x + dp1perp * duv2.x;
      vec3 Bg = dp2perp * duv1.y + dp1perp * duv2.y;
      float invmax = inversesqrt(max(max(dot(Tg, Tg), dot(Bg, Bg)), 1e-30));
      Tg *= invmax; Bg *= invmax;
      vec2 fwg = fwidth(g);
      float fwm = max(fwg.x, fwg.y);
      // Detail visibility: wire normals, glints and the inner layer only where the weave resolves.
      float aa = 1.0 - smoothstep(0.22, 0.55, fwm);
      float ndv = clamp(dot(N, Vv), 0.0, 1.0);
      float w = uWire * mix(1.7, 1.0, sqrt(ndv));
      vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
      // Exact filtered coverage of the two wire families.
      float covA = pulseF(g.y, w, fwg.y);
      float covB = pulseF(g.x, w, fwg.x);
      float mask = 1.0 - (1.0 - covA) * (1.0 - covB);
      float aA = 3.14159265 * (g.x - 0.5 + cell.y);
      float aB = 3.14159265 * (g.y - 0.5 + cell.x);
      float hA = uAmp * cos(aA);
      float hB = -uAmp * cos(aB);
      float cA = w * w - f.y * f.y; float cB = w * w - f.x * f.x;
      float zA = cA > 0.0 ? hA + sqrt(cA) : -1e3;
      float zB = cB > 0.0 ? hB + sqrt(cB) : -1e3;
      vec3 nl; float hTop;
      if (zA >= zB) {
        float sq = max(sqrt(max(cA, 0.0)), 0.3 * w);
        nl = normalize(vec3(uAmp * 3.14159265 * sin(aA), f.y / sq, 1.0));
        hTop = hA;
      } else {
        float sq = max(sqrt(max(cB, 0.0)), 0.3 * w);
        nl = normalize(vec3(f.x / sq, -uAmp * 3.14159265 * sin(aB), 1.0));
        hTop = hB;
      }
      vec3 nw = normalize(Tg * nl.x + Bg * nl.y + N * nl.z);
      vec3 nWire = normalize(mix(N, nw, aa));
      // Gaps: deep and dark, darkest right against the wires.
      float gapAO = mix(0.35, smoothstep(0.0, 0.22, min(abs(f.x), abs(f.y)) - w), aa);
      // Inner mesh: finer, rotated 45 degrees, one layer deeper (parallax through the gaps).
      vec2 vt = vec2(dot(Vv, Tg), dot(Vv, Bg)) / max(ndv, 0.3);
      vec2 gi = g - vt * uInner;
      vec2 gr = vec2(gi.x + gi.y, gi.x - gi.y) * 1.1;
      vec2 fwr = fwidth(gr);
      float mi = 1.0 - (1.0 - pulseF(gr.x + 0.5, 0.17, fwr.x)) * (1.0 - pulseF(gr.y + 0.5, 0.17, fwr.y));
      vec3 foam = uFoam * (0.55 + 0.6 * hash12(floor(gi * 2.0)));
      // The inner layer catches a dim, broad wash of the key through the outer weave.
      float innerLit = keyLobe(toWorld(N), 0.55) * 0.012;
      vec3 inner = mix(foam, diffuseColor.rgb * (0.04 + innerLit), mi);
      float wireAO = mix(0.7, 0.3 + 0.7 * smoothstep(-uAmp, uAmp, hTop), aa);
      vec3 base = diffuseColor.rgb;
      diffuseColor.rgb = mix(inner * gapAO, base * wireAO, mask);
      metalnessFactor = mask;
      // Unresolved weave: the wire normal spread becomes micro-facet roughness.
      roughnessFactor = mix(0.9, mix(0.36, roughnessFactor, aa), mask);
      normal = normalize(mix(N, nWire, mask));
      vec3 T2 = normalize(Tg); vec3 B2 = normalize(Bg);
      vec3 nWorldMacro = toWorld(N);
      // Round hotspot with falloff across the ball (broad lobe on the macro normal), on the metal only.
      float hot = keyLobe(nWorldMacro, mix(0.4, 0.3, aa)) * mask * wireAO;
      // Crisp glints riding the wire crowns and crossings: they travel with the key sweep and the pointer parallax.
      float crossGl = keyGlint(toWorld(nw), 320.0) * mask * aa * wireAO;
      float farGl = glitter(st, N, T2, B2, 0.06, 0.55, 260.0) * (1.0 - aa) * mask;
      totalEmissiveRadiance += uKeyColor * (hot * 0.14 + crossGl * 0.5 + farGl * 0.2);
      // Tight bright fresnel rim (rim light) plus a thin key-side edge.
      float fr = pow(1.0 - ndv, 5.0);
      totalEmissiveRadiance += uRimColor * rimTerm(N, 0.22) * mix(0.6, 1.0, mask) * 2.2;
      totalEmissiveRadiance += uKeyColor * fr * clamp(dot(nWorldMacro, normalize(uKeyPos - vWorld)) + 0.2, 0.0, 1.0) * mask * 0.01;`,
  });
  return { material: m, uniforms };
}

/** Satin nickel (band ring, thumb screw, threads): warm, softly brushed. */
export function createNickelMaterial(cheap: boolean) {
  const params = { color: lin('#cfc6b6'), metalness: 1, roughness: 0.14, envMapIntensity: 1.35 };
  const m = new MeshStandardMaterial(params);
  patch(m, `nickel-${cheap ? 1 : 0}`, {
    uniforms: {},
    fragmentBody: `
      float fy = fwidth(vObj.y);
      float k1 = 1.0 - smoothstep(0.3, 1.0, fy * 9000.0);
      float l1 = mix(0.5, hash11(floor(vObj.y * 9000.0)), k1);
      roughnessFactor = clamp(roughnessFactor * (0.8 + 0.4 * l1), 0.05, 1.0);
      vec3 nW = toWorld(normal);
      totalEmissiveRadiance += uKeyColor * (keyGlint(nW, 600.0) * 0.015 + keyLobe(nW, 0.3) * 0.006);
      totalEmissiveRadiance += uRimColor * rimTerm(normal, 0.3) * 0.9;`,
  });
  return m;
}

/** Polished chrome (upper stand tube). */
export function createPolishedMaterial() {
  const m = new MeshStandardMaterial({ color: lin('#d4d6da'), metalness: 1, roughness: 0.1, envMapIntensity: 1.3 });
  patch(m, 'chrome', {
    uniforms: {},
    fragmentBody: `totalEmissiveRadiance += uRimColor * rimTerm(normal, 0.3) * 0.6;`,
  });
  return m;
}

/** Red light bounced off the rug, for things near the rug edge. */
const GLSL_BOUNCE = /* glsl */ `
  vec3 bounceRed(vec3 nW) {
    float rr = length(vWorld.xz);
    vec3 toRug = normalize(vec3(-vWorld.x, -max(vWorld.y, 0.05) * 1.5, -vWorld.z));
    float face = clamp(dot(nW, toRug) * 0.7 + 0.3, 0.0, 1.0);
    float near = exp(-max(rr - ${RUG_RADIUS.toFixed(2)}, 0.0) / 0.45) * exp(-vWorld.y / 0.55);
    return vec3(0.9, 0.02, 0.05) * face * near * uSpot * 0.16;
  }`;

/**
 * Satin black powder-coated cast metal for the stand and clip. Near the clip
 * the key is allowed past its narrow cone as a soft fill, so the clip, yoke
 * and thumb screw read as machined parts (bevel glints, a broad sheen and a
 * clean rim) rather than a dark silhouette.
 */
export function createHardwareMaterial() {
  const m = new MeshStandardMaterial({ color: lin('#17171a'), metalness: 0.85, roughness: 0.36, envMapIntensity: 1.0 });
  patch(m, 'hardware', {
    uniforms: { uClip: { value: PIVOT_WORLD.clone() } },
    fragmentHead: GLSL_BOUNCE + 'uniform vec3 uClip;',
    fragmentBody: `
      float n = vnoise(vWorld.xy * 900.0 + vWorld.z * 700.0);
      roughnessFactor = clamp(roughnessFactor + (n - 0.5) * 0.12, 0.05, 1.0);
      vec3 nW = toWorld(normal);
      float nearClip = exp(-distance(vWorld, uClip) / 0.06);
      vec3 Lk = normalize(uKeyPos - vWorld);
      float wrap = clamp(dot(nW, Lk) * 0.6 + 0.4, 0.0, 1.0);
      float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      float fres = 0.08 + 0.92 * pow(1.0 - ndv, 5.0);
      totalEmissiveRadiance += uKeyColor * nearClip * (keyLobe(nW, 0.38) * 0.02 * (0.3 + fres) + keyGlint(nW, 180.0) * 0.05 + wrap * 0.0035);
      totalEmissiveRadiance += bounceRed(nW);
      totalEmissiveRadiance += uRimColor * rimTerm(normal, mix(0.3, 0.42, nearClip)) * mix(0.7, 1.4, nearClip);`,
  });
  return m;
}

/** Black rubber mic cable. */
export function createCableMaterial() {
  const m = new MeshStandardMaterial({ color: lin('#0c0c0d'), metalness: 0, roughness: 0.45, envMapIntensity: 0.5 });
  patch(m, 'cable', {
    uniforms: {},
    fragmentHead: GLSL_BOUNCE,
    fragmentBody: `
      totalEmissiveRadiance += bounceRed(toWorld(normal)) * 0.6;
      totalEmissiveRadiance += uRimColor * rimTerm(normal, 0.3) * 0.25;`,
  });
  return m;
}

/* ------------------------------------------------------------------------- */
/* Stage                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Dark polished stage floor: contact shadows, gaffer-tape spike marks, red
 * bounce from the rug, and (high tier) a blurred analytic reflection of the
 * light beam.
 */
export function createFloorMaterial(cheap: boolean) {
  const m = new MeshStandardMaterial({ color: lin('#080808'), metalness: 0, roughness: 0.45, envMapIntensity: 0 });
  patch(m, `floor-${cheap ? 1 : 0}`, {
    noEnv: true,
    uniforms: {
      uRugR: { value: RUG_RADIUS },
      uStand: { value: [STAND_BASE.x, STAND_BASE.z] },
      uH: { value: SPOT_HEIGHT },
      uTanA: { value: (RUG_RADIUS + 0.25) / SPOT_HEIGHT },
    },
    fragmentHead: `uniform float uRugR; uniform vec2 uStand; uniform float uH; uniform float uTanA; uniform sampler2D uRefl; uniform mat4 uReflMat; uniform float uReflOn;
      float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }`,
    fragmentBody: `
      vec2 p = vWorld.xz;
      float rr = length(p);
      // Contact shadows: tight under the rug lip, broad around it, stand base.
      float ao = 1.0 - 0.8 * (1.0 - smoothstep(uRugR, uRugR + 0.05, rr)) - 0.35 * (1.0 - smoothstep(uRugR, uRugR + 0.4, rr));
      ao *= 1.0 - 0.75 * (1.0 - smoothstep(0.13, 0.32, length(p - uStand)));
      ao = max(ao, 0.0);
      diffuseColor.rgb *= ao;
      float broad = vnoise(p * 0.35) * 0.6 + vnoise(p * 1.3 + 4.0) * 0.4;
      float scuff = vnoise(p * vec2(9.0, 2.0) + 2.0) * vnoise(p * 24.0);
      roughnessFactor = clamp(0.5 + 0.14 * broad + 0.08 * scuff, 0.05, 1.0) + (1.0 - ao) * 0.3;
      diffuseColor.rgb *= 0.85 + 0.3 * broad;
      // Spike tape: a T downstage centre, two corner marks.
      vec2 q = p - vec2(0.0, uRugR + 0.32);
      float d = min(sdBox(q, vec2(0.12, 0.024)), sdBox(q - vec2(0.0, 0.085), vec2(0.024, 0.07)));
      vec2 q2 = p - vec2(-2.35, 0.9);
      d = min(d, min(sdBox(q2, vec2(0.13, 0.024)), sdBox(q2 - vec2(-0.106, 0.1), vec2(0.024, 0.1))));
      vec2 q3 = p - vec2(1.25, -2.1);
      d = min(d, min(sdBox(q3, vec2(0.13, 0.024)), sdBox(q3 - vec2(0.106, -0.1), vec2(0.024, 0.1))));
      float afw = fwidth(d) + 1e-5;
      float tape = 1.0 - smoothstep(-afw, afw, d);
      float wear = 0.8 + 0.3 * vnoise(p * 300.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.09, 0.085) * wear, tape);
      roughnessFactor = mix(roughnessFactor, 0.75, tape);
      // Soft white spill from the spot's outer field: the stage floor is just readable around the pool.
      float spill = exp(-max(rr - uRugR, 0.0) / 1.4) * (0.35 + 0.65 * exp(-rr * rr / 30.0));
      totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.95, 0.9) * spill * uSpot * 2.2;
      // Red bounce spilling off the rug.
      float outside = smoothstep(uRugR - 0.02, uRugR + 0.02, rr);
      totalEmissiveRadiance += vec3(0.8, 0.0, 0.021) * exp(-max(rr - uRugR, 0.0) / 0.32) * outside * uSpot * 0.05;
      // Scuffs: faint arcs and drag marks that break the reflection up.
      float sc1 = vnoise(vec2(dot(p, vec2(0.8, 0.6)) * 3.0, dot(p, vec2(-0.6, 0.8)) * 40.0));
      float sc2 = vnoise(vec2(length(p - vec2(0.6, 1.9)) * 55.0, atan(p.y - 1.9, p.x - 0.6) * 2.0));
      float scuff2 = smoothstep(0.8, 0.98, sc1) * 0.35 + smoothstep(0.85, 0.99, sc2) * 0.25 * exp(-rr * 0.4);
      roughnessFactor = clamp(roughnessFactor + scuff2 * 0.25, 0.05, 1.0);
      vec3 Vd = normalize(vWorld - cameraPosition);
      float fres = 0.04 + 0.96 * pow(1.0 - clamp(-Vd.y, 0.0, 1.0), 5.0);
      float gloss = 1.0 - smoothstep(0.42, 0.85, roughnessFactor);
      ${
        cheap
          ? `
      // Low tier: a painted reflection (no extra pass): the rug's red glow just beyond its near edge, a soft warm column under the beam.
      vec2 toCam = normalize(cameraPosition.xz - p);
      float nearSide = clamp(dot(p / max(rr, 1e-4), toCam) * 0.5 + 0.5, 0.0, 1.0);
      float redRefl = exp(-max(rr - uRugR, 0.0) / 0.5) * outside * nearSide;
      totalEmissiveRadiance += (vec3(0.83, 0.0, 0.022) * redRefl * 0.08 + vec3(1.0, 0.94, 0.86) * exp(-rr * rr / 6.0) * outside * uCone * 0.012) * fres * gloss * uSpot * 3.0;`
          : `
      // Planar reflection (rendered mirrored at half resolution): Fresnel-weighted, blurred by roughness
      // and stretched vertically like a real glossy floor, jittered by the scuffs.
      vec4 rc = uReflMat * vec4(vWorld, 1.0);
      vec2 ruv = rc.xy / max(rc.w, 1e-4);
      vec2 wob = (vec2(vnoise(p * 7.0), vnoise(p * 7.0 + 5.2)) - 0.5) * 0.006 * (0.6 + 2.0 * scuff2);
      float lod = mix(0.6, 2.6, smoothstep(0.4, 0.9, roughnessFactor));
      vec2 sv = vec2(0.0, 0.012 * (1.0 + lod));
      vec3 refl = textureLod(uRefl, ruv + wob, lod).rgb * 0.4
                + textureLod(uRefl, ruv + wob + sv, lod + 0.6).rgb * 0.25 + textureLod(uRefl, ruv + wob - sv, lod + 0.6).rgb * 0.25
                + textureLod(uRefl, ruv + wob + 2.5 * sv, lod + 1.2).rgb * 0.05 + textureLod(uRefl, ruv + wob - 2.5 * sv, lod + 1.2).rgb * 0.05;
      totalEmissiveRadiance += refl * fres * mix(0.35, 1.0, gloss) * uReflOn * 4.0;`
      }`,
  });
  return m;
}

/** TEDx red (#EB0028) in linear working space: the hue the rug must keep at its lit centre. */
export const TEDX_RED = lin('#eb0028');

/**
 * The red circle: cut-pile carpet. Fine fibres at two scales (filtered out
 * with distance, never printed-looking), only a very gentle large-scale nap
 * variation, a velvet sheen that brightens towards grazing angles, a fuzzy,
 * slightly irregular alpha-to-coverage edge and a darker pile wall. Every
 * light term is tinted with the rug's own red so the lit centre keeps the
 * TEDx hue instead of drifting to pink (white specular) or orange.
 */
export function createRugMaterial(cheap: boolean) {
  const albedo = TEDX_RED.clone().multiplyScalar(0.46);
  const params = { color: albedo, metalness: 0, roughness: 1, envMapIntensity: 0, alphaTest: 0.5 };
  const m = cheap
    ? new MeshStandardMaterial(params)
    : new MeshPhysicalMaterial({ ...params, specularIntensity: 0, sheen: 1, sheenRoughness: 0.5, sheenColor: TEDX_RED.clone().multiplyScalar(0.55) });
  m.alphaToCoverage = true;
  patch(m, `rug-${cheap ? 1 : 0}`, {
    noEnv: true,
    uniforms: { uR: { value: RUG_RADIUS }, uRed: { value: TEDX_RED } },
    fragmentHead: 'uniform float uR; uniform vec3 uRed;',
    alphaBody: `
      vec2 pa = vWorld.xz;
      float ang = atan(pa.y, pa.x);
      float fwa = max(length(fwidth(pa)), 1e-6);
      float kf = 1.0 - smoothstep(0.002, 0.006, fwa);
      // Tufts poking past the edge (fine, fade with distance) plus a gentle hand-cut irregularity.
      float fz = (vnoise(vec2(ang * 900.0, 0.5)) - 0.5) * 0.012 * kf + (vnoise(pa * 500.0) - 0.5) * 0.01 * kf
               + (vnoise(vec2(ang * 23.0, 2.0)) - 0.5) * 0.006;
      diffuseColor.a = 1.0 - smoothstep(uR - 0.004 - fwa, uR + 0.006 + fwa, length(pa) + fz);`,
    fragmentBody: `
      vec2 p = vWorld.xz;
      float rr = length(p);
      float fw = max(length(fwidth(p)), 1e-6);
      float k1 = 1.0 - smoothstep(0.35 / 900.0, 1.1 / 900.0, fw);
      float k2 = 1.0 - smoothstep(0.35 / 220.0, 1.1 / 220.0, fw);
      float k3 = 1.0 - smoothstep(0.35 / 60.0, 1.1 / 60.0, fw);
      float n1 = mix(0.5, vnoise(p * 900.0), k1);
      float n2 = mix(0.5, vnoise(p * 220.0 + 7.3), k2);
      float n3 = mix(0.5, vnoise(p * 60.0 + 1.7), k3);
      float k4 = 1.0 - smoothstep(0.35 / 22.0, 1.1 / 22.0, fw);
      float n4 = mix(0.5, vnoise(p * 22.0 + 4.1), k4);
      float fib = n1 * 0.32 + n2 * 0.26 + n3 * 0.26 + n4 * 0.16;
      // Very gentle, very large-scale nap: the pile was brushed one way, not mottled.
      float nap = vnoise(p * 0.55 + 3.0);
      float na = 0.6 + nap * 1.2;
      vec2 napD = vec2(cos(na), sin(na));
      vec3 napV = normalize((viewMatrix * vec4(napD.x, 0.0, napD.y, 0.0)).xyz);
      normal = normalize(normal + napV * 0.035);
      ${cheap ? '' : 'normal = bumpNormal(normal, -vViewPosition, fib, 0.004);'}
      vec3 nW = toWorld(normal);
      float wallF = 1.0 - smoothstep(0.55, 0.92, toWorld(vNormal).y);
      float edge = smoothstep(uR - 0.06, uR, rr);
      float hot = 0.62 + 0.55 * exp(-rr * rr / 0.9);
      diffuseColor.rgb *= (0.64 + 0.58 * fib) * (0.94 + 0.12 * nap) * (1.0 - 0.35 * edge) * hot * mix(1.0, 0.6, wallF);
      roughnessFactor = 1.0;
      // The rug is only lit by the overhead spot: keep it dark when the spot is down.
      float lit = clamp(uSpot * 4.0, 0.0, 1.0);
      diffuseColor.rgb *= lit;
      sheenMul = lit;
      vec3 Vw = normalize(cameraPosition - vWorld);
      float pool = 1.0 - smoothstep(uR * 0.55, uR + 0.2, rr);
      // Velvet: fibre tips light up towards grazing view angles (retro-reflective pile), in the rug's own red.
      float ndv = clamp(dot(nW, Vw), 0.0, 1.0);
      float velvet = pow(1.0 - ndv, 3.0) * (0.55 + 0.45 * n1);
      totalEmissiveRadiance += uRed * velvet * pool * uSpot * 0.055;
      // Fibre highlight (Kajiya-Kay) under the overhead spot: fibres stand up, leaning along the nap.
      vec3 Tf = normalize(vec3(napD.x * 0.5, 1.0, napD.y * 0.5));
      vec3 Ls = normalize(vec3(0.0, ${SPOT_HEIGHT.toFixed(2)}, 0.0) - vWorld);
      float th = dot(Tf, normalize(Ls + Vw));
      float kk = pow(sqrt(max(1.0 - th * th, 0.0)), 24.0);
      totalEmissiveRadiance += uRed * kk * pool * (0.4 + 0.6 * n1) * uSpot * 0.03;`,
  });
  return m;
}

/** Faint upstage curtain: heavy velvet with soft vertical folds catching a little spill. */
export function createCurtainMaterial() {
  const m = new MeshStandardMaterial({ color: lin('#0c0b0c'), metalness: 0, roughness: 0.85, envMapIntensity: 0 });
  const folds = /* glsl */ `
    float foldPhase(float x) { return x * 5.2 + vnoise(vec2(x * 0.9, 1.0)) * 5.0; }`;
  patch(m, 'curtain', {
    noEnv: true,
    uniforms: {},
    vertexHead: `${GLSL_NOISE}\n${folds}`,
    vertexBody: `
      transformed.z += sin(foldPhase(position.x)) * 0.09;
      vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    fragmentHead: folds,
    fragmentBody: `
      float x = vObj.x;
      float ph = foldPhase(x);
      vec3 tx = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
      normal = normalize(normal - tx * cos(ph) * 0.75);
      vec3 Nw = toWorld(normal);
      float lam = clamp(dot(Nw, normalize(vec3(0.35, 0.25, 1.0))), 0.0, 1.0);
      float pool = exp(-pow(vWorld.x / 3.6, 2.0)) * smoothstep(0.0, 1.0, vWorld.y) * (1.0 - smoothstep(1.8, 5.5, vWorld.y));
      float sheen = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
      totalEmissiveRadiance += vec3(1.0, 0.82, 0.78) * (lam * lam * 0.055 + sheen * 0.025) * pool * uSpot;
      diffuseColor.rgb *= 0.6 + 0.4 * lam;`,
  });
  return m;
}

/**
 * The house (audience floor, raked treads, stage front): matte black. The
 * stage front's top edge catches the spot's spill; warm pools from the aisle
 * step lights sit on the tread fronts either side of the centre aisle.
 */
export function createVenueMaterial() {
  const m = new MeshStandardMaterial({ color: lin('#0b0b0c'), metalness: 0, roughness: 0.9, envMapIntensity: 0 });
  patch(m, 'venue', {
    noEnv: true,
    uniforms: {
      uSeat: { value: [SEATING.centre.x, SEATING.centre.z, SEATING.firstRadius, SEATING.rowGap] },
      uAisle: { value: SEATING.aisle },
      uEdgeZ: { value: STAGE_EDGE_Z },
    },
    fragmentHead: 'uniform vec4 uSeat; uniform float uAisle; uniform float uEdgeZ;',
    fragmentBody: `
      vec3 nW = toWorld(normal);
      // Stage front: a thin worn nosing along the top edge catches the spill.
      float front = step(0.7, nW.z) * (1.0 - smoothstep(0.0, 0.03, abs(vWorld.z - uEdgeZ)));
      float nosing = smoothstep(-0.035, -0.004, vWorld.y) * front;
      float spill = exp(-vWorld.x * vWorld.x / 18.0);
      totalEmissiveRadiance += vec3(1.0, 0.93, 0.86) * nosing * spill * uSpot * 0.05;
      diffuseColor.rgb *= 1.0 - 0.4 * front * (1.0 - nosing);
      // Aisle step-light pools on the treads.
      vec2 d = vWorld.xz - uSeat.xy;
      float R = length(d);
      float s = atan(d.x, d.y) * R;
      float fr = fract((R - uSeat.z + uSeat.w * 0.5) / uSeat.w);
      float pool = exp(-pow(abs(s) - uAisle * 0.5 + 0.08, 2.0) / 0.03) * exp(-fr * 7.0) * step(0.5, nW.y) * step(uEdgeZ + 0.3, vWorld.z);
      totalEmissiveRadiance += vec3(1.0, 0.6, 0.3) * pool * 0.012;`,
  });
  return m;
}

/** Upholstered seats: fabric noise, a thin warm highlight along the curved top edge, cool rim. */
export function createSeatMaterial() {
  const m = new MeshStandardMaterial({ color: lin('#1e1e22'), metalness: 0.0, roughness: 0.6, envMapIntensity: 0.2 });
  patch(m, 'seat', {
    uniforms: {
      uEdge: { value: lin('#ffd9c4').multiplyScalar(0.2) },
      uSeatRim: { value: lin('#b8c4dc').multiplyScalar(0.05) },
    },
    fragmentHead: 'uniform vec3 uEdge; uniform vec3 uSeatRim;',
    fragmentBody: `
      float n = vnoise(vWorld.xy * 260.0 + vWorld.zx * 190.0);
      diffuseColor.rgb *= 0.85 + 0.3 * n;
      vec3 Nw = toWorld(normal);
      float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      // Piping along the curved top: faces that point up and towards the stage.
      vec3 toStage = normalize(vec3(-vWorld.x, 3.0, -vWorld.z));
      float edge = smoothstep(0.55, 0.9, Nw.y) * smoothstep(0.62, 0.9, vObj.y) * clamp(dot(Nw, toStage), 0.0, 1.0);
      totalEmissiveRadiance += uEdge * edge * (0.6 + 0.4 * pow(1.0 - ndv, 2.0)) * uSpot;
      totalEmissiveRadiance += uSeatRim * smoothstep(0.6, 0.95, 1.0 - ndv) * smoothstep(0.0, 0.8, Nw.y);`,
  });
  return m;
}

/* ------------------------------------------------------------------------- */
/* Spot cone, dust, haze, motes                                              */
/* ------------------------------------------------------------------------- */

/** Spot beam: radius at the lens, and how far the soft beam geometry extends past the nominal edge. */
export const BEAM = { r0: 0.11, rBottom: RUG_RADIUS + 0.25, pad: 1.45 };
const BEAM_K = (BEAM.rBottom - BEAM.r0) / SPOT_HEIGHT;

/**
 * Light in haze: a short ray march through the beam volume, drawn on the back
 * faces of an oversized cone (so it also works with the camera inside it).
 * Gaussian radial profile (no edges), exponential falloff from the fixture
 * and a fade at the lens (no cap), Henyey-Greenstein phase (brighter looking
 * towards the light), slowly drifting haze noise, soft where it meets the
 * floor. Low tier: three samples and no noise.
 */
export function createConeMaterial(cheap = false) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uColor: { value: lin('#fff1e0') },
      uHeight: { value: SPOT_HEIGHT },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uIntensity; uniform vec3 uColor; uniform float uHeight;
      varying vec3 vWorld;
      ${GLSL_NOISE}
      const float R0 = ${BEAM.r0.toFixed(4)};
      const float K = ${BEAM_K.toFixed(5)};
      const float PAD = ${BEAM.pad.toFixed(3)};
      const int STEPS = ${cheap ? 3 : 9};
      float density(vec3 p, vec3 rd) {
        float down = uHeight - p.y;
        float R = R0 + down * K;
        float q = length(p.xz) / R;
        float prof = exp(-q * q * 2.3);
        // Exponential falloff from the fixture, a soft fade at the lens, soft floor contact.
        float fall = exp(-down / 5.5) * (0.35 + 0.65 * ${BEAM.rBottom.toFixed(3)} / (R + 0.6));
        float lens = smoothstep(0.0, 1.6, down);
        float floorF = smoothstep(0.0, 0.35, p.y);
        float n = 1.0;
        ${cheap ? '' : 'vec3 np = p * vec3(1.1, 0.55, 1.1) + vec3(uTime * 0.02, -uTime * 0.045, uTime * 0.013); n = 0.55 + 0.9 * vnoise3(np);'}
        // Henyey-Greenstein, g = 0.5: haze scatters forward, so looking up the beam is brighter.
        vec3 Ld = normalize(p - vec3(0.0, uHeight, 0.0));
        float c = dot(Ld, -rd);
        float g = 0.5;
        float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) * 0.25;
        return prof * fall * lens * floorF * n * hg;
      }
      void main() {
        vec3 ro = cameraPosition;
        vec3 seg = vWorld - ro;
        float tExit = length(seg);
        vec3 rd = seg / tExit;
        // Entry: the other root of the padded cone (apex above the lens).
        float k = K * PAD;
        float ay = uHeight + R0 * PAD / k;
        float h = ay - ro.y;
        float a = rd.x * rd.x + rd.z * rd.z - k * k * rd.y * rd.y;
        float b = 2.0 * (ro.x * rd.x + ro.z * rd.z + k * k * h * rd.y);
        float cc = ro.x * ro.x + ro.z * ro.z - k * k * h * h;
        float disc = b * b - 4.0 * a * cc;
        float tEnter = 0.0;
        if (disc > 0.0 && abs(a) > 1e-6) {
          float sq = sqrt(disc);
          float t1 = (-b - sq) / (2.0 * a);
          float t2 = (-b + sq) / (2.0 * a);
          float tOther = abs(t1 - tExit) < abs(t2 - tExit) ? t2 : t1;
          if (tOther < tExit && ro.y + rd.y * tOther < ay) tEnter = max(tOther, 0.0);
        }
        // Clip to the floor and below the lens.
        if (rd.y < 0.0) tExit = min(tExit, -ro.y / rd.y);
        if (rd.y > 0.0) tExit = min(tExit, (uHeight - ro.y) / rd.y);
        if (rd.y < 0.0 && ro.y > uHeight) tEnter = max(tEnter, (uHeight - ro.y) / rd.y);
        float len = tExit - tEnter;
        if (len <= 0.0) discard;
        float dt = len / float(STEPS);
        float jit = hash12(gl_FragCoord.xy + fract(uTime) * 61.0);
        float sum = 0.0;
        for (int i = 0; i < STEPS; i++) {
          vec3 p = ro + rd * (tEnter + (float(i) + jit) * dt);
          sum += density(p, rd);
        }
        sum *= dt;
        // Low in the beam the haze also catches red light bounced off the rug.
        vec3 pm = ro + rd * (tEnter + 0.5 * len);
        float bounce = exp(-max(pm.y, 0.0) / 0.9) * exp(-max(length(pm.xz) - ${RUG_RADIUS.toFixed(2)}, 0.0) / 0.6);
        vec3 col = mix(uColor, vec3(1.0, 0.0, 0.03), bounce * 0.55);
        gl_FragColor = vec4(col * sum * uIntensity * 0.55, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: BackSide,
    toneMapped: true,
    fog: false,
  });
}

export function createDustMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 400 },
      uIntensity: { value: 1 },
      uHeight: { value: SPOT_HEIGHT },
      uTan: { value: BEAM_K },
    },
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime; uniform float uScale; uniform float uHeight; uniform float uTan;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * (0.012 + seed.w * 0.02);
        p.y = mod(p.y - t * 2.0, uHeight * 0.95);
        p.x += sin(uTime * 0.11 + seed.x * 6.28) * 0.12;
        p.z += cos(uTime * 0.09 + seed.y * 6.28) * 0.12;
        float coneR = ${BEAM.r0.toFixed(4)} + (uHeight - p.y) * uTan;
        float qd = length(p.xz) / coneR;
        // Only lit inside the beam (same soft profile as the haze), brighter looking up the beam.
        float inside = exp(-qd * qd * 2.6);
        vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz;
        float cph = dot(normalize(wp - vec3(0.0, uHeight, 0.0)), normalize(cameraPosition - wp));
        inside *= 0.5 + 1.5 * pow(max(cph, 0.0), 3.0);
        // Motes turn their flat sides to the light now and then: sharp sparkles.
        float ph = sin(uTime * (0.5 + seed.z * 1.4) + seed.x * 40.0) * 0.5 + 0.5;
        float twinkle = 0.25 + 0.5 * ph + 3.0 * pow(ph, 24.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = (0.5 + seed.z * 1.1) * 0.0055;
        gl_PointSize = max(1.0, size * uScale / -mv.z);
        float fadeNear = smoothstep(0.3, 1.5, -mv.z);
        vA = inside * twinkle * fadeNear * smoothstep(0.0, 0.6, p.y) * min(1.0, gl_PointSize / 2.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = 1.0 - smoothstep(0.05, 0.5, length(c));
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.9) * d * d * vA * 0.7 * uIntensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: true,
    fog: false,
    side: DoubleSide,
  });
}

/** Soft atmospheric glow behind the subject (a camera-facing quad). */
export function createHazeMaterial() {
  return new ShaderMaterial({
    uniforms: { uIntensity: { value: 0 }, uColor: { value: lin('#8d8a86') }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity; uniform vec3 uColor; uniform float uTime;
      varying vec2 vUv;
      ${GLSL_NOISE}
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c * vec2(1.0, 1.25)) * 2.0;
        float n = vnoise(vUv * 3.0 + vec2(uTime * 0.03, -uTime * 0.02)) * 0.6 + vnoise(vUv * 7.0 - uTime * 0.02) * 0.4;
        float a = exp(-r * r * 3.2) * (0.75 + 0.5 * n) + exp(-r * r * 14.0) * 0.6;
        a *= 1.0 - smoothstep(0.85, 1.0, r);
        gl_FragColor = vec4(uColor * a * uIntensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: true,
    fog: false,
  });
}

/**
 * Out-of-focus dust motes floating just in front of the lens (positions in a
 * unit camera frustum; the group follows the camera, scaled by focus distance).
 * Brighter where a raking beam from screen right crosses them.
 */
export function createMotesMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uScale: { value: 400 },
      uTanX: { value: 0.4 },
      uTanY: { value: 0.27 },
      uBeam: { value: 0.6 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime; uniform float uScale; uniform float uTanX; uniform float uTanY;
      varying float vA; varying float vBokeh;
      void main() {
        float z = -mix(0.18, 0.95, seed.z);
        vec2 xy = position.xy;
        xy += vec2(sin(uTime * 0.07 + seed.x * 6.28), cos(uTime * 0.05 + seed.y * 6.28)) * 0.08;
        xy.y = mod(xy.y + 1.0 - uTime * 0.006 * (0.5 + seed.w), 2.0) - 1.0;
        vec3 p = vec3(xy.x * uTanX * -z, xy.y * uTanY * -z, z);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        // Circle of confusion grows away from the focus plane (z = -1).
        float coc = abs(1.0 / -z - 1.0);
        float px = (0.004 + coc * 0.03) * uScale / -z;
        gl_PointSize = clamp(px, 1.0, 90.0);
        vBokeh = clamp(coc * 1.5, 0.0, 1.0);
        float beam = smoothstep(-0.3, 0.9, xy.x) * (0.6 + 0.4 * sin(xy.y * 2.0 + 1.0));
        float tw = 0.6 + 0.4 * sin(uTime * (0.4 + seed.w) + seed.x * 30.0);
        // Same energy spread over a larger disc: big bokeh is dimmer.
        vA = beam * tw / max(1.0, gl_PointSize * gl_PointSize / 16.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying float vA; varying float vBokeh;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float disc = 1.0 - smoothstep(mix(0.2, 0.82, vBokeh), 1.0, r);
        disc *= mix(1.0, 0.75 + 0.35 * smoothstep(0.55, 0.95, r), vBokeh);
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * disc * vA * uIntensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    toneMapped: true,
    fog: false,
  });
}
