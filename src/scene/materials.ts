import {
  AdditiveBlending,
  Color,
  DoubleSide,
  FrontSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { MIC, RUG_RADIUS, SPOT_HEIGHT } from './layout';
import { EMPTY_MASK } from './textures';

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
// Screen-space bump: perturb view-space normal by a height signal h.
vec3 bumpNormal(vec3 n, vec3 viewPos, float h, float scale) {
  vec3 sx = dFdx(viewPos); vec3 sy = dFdy(viewPos);
  vec3 r1 = cross(sy, n); vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * scale * r1 + dFdy(h) * scale * r2);
  return normalize(abs(det) * n - grad);
}
`;

type Patch = {
  uniforms: Record<string, { value: unknown }>;
  vertexHead?: string;
  vertexBody?: string;
  fragmentHead?: string;
  /** Runs after normal_fragment_maps: may edit diffuseColor, roughnessFactor, metalnessFactor, normal. */
  fragmentBody: string;
};

function patch(material: MeshStandardMaterial, key: string, p: Patch) {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, p.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj;\nvarying vec3 vWorld;\n${p.vertexHead ?? ''}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvObj = position;\nvWorld = (modelMatrix * vec4(position, 1.0)).xyz;\n${p.vertexBody ?? ''}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vObj;\nvarying vec3 vWorld;\n${GLSL_NOISE}\n${p.fragmentHead ?? ''}`,
      )
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n{\n${p.fragmentBody}\n}`);
  };
  material.customProgramCacheKey = () => key;
}

const lin = (hex: string) => new Color(hex); // Color() converts sRGB hex to linear working space

/* ------------------------------------------------------------------------- */
/* Microphone                                                                */
/* ------------------------------------------------------------------------- */

export type BodyUniforms = { uMask: { value: Texture }; uMaskTexel: { value: [number, number] } };

/** Anodised, turned barrel with laser-etched band and knurled grip. */
export function createBodyMaterial(cheap: boolean) {
  const uniforms = {
    uMask: { value: EMPTY_MASK as Texture },
    uMaskTexel: { value: [1 / 4096, 1 / 2048] as [number, number] },
    uBand: { value: [MIC.bandY[0], MIC.bandY[1]] },
    uKnurl: { value: [MIC.knurlY[0], MIC.knurlY[1], MIC.knurlR] },
    uKnurlN: { value: 72 },
    uDepth: { value: 4.5e-5 },
    uEtch: { value: lin('#b4b6bb') },
  };
  const m = new MeshStandardMaterial({ color: lin('#4a4c52'), metalness: 1, roughness: 0.32, envMapIntensity: 1.1 });
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
      uniform float uKnurlN; uniform float uDepth; uniform vec3 uEtch;`,
    fragmentBody: `
      float r = length(vObj.xz);
      float phi = atan(vObj.x, vObj.z);
      vec3 T = normalize(vTanV);
      vec3 B = normalize(vBitV);
      // Turned finish: fine circumferential tool marks.
      float fy = fwidth(vObj.y);
      float k1 = 1.0 - smoothstep(0.3, 1.0, fy * 16000.0);
      float k2 = 1.0 - smoothstep(0.3, 1.0, fy * 2600.0);
      float l1 = mix(0.5, hash11(floor(vObj.y * 16000.0)), k1);
      float l2 = mix(0.5, hash11(floor(vObj.y * 2600.0) + 17.0), k2);
      roughnessFactor = clamp(roughnessFactor * (0.8 + 0.3 * l1 + 0.2 * l2), 0.05, 1.0);
      diffuseColor.rgb *= 0.9 + 0.2 * l2;

      float bv = (vObj.y - uBand.x) / (uBand.y - uBand.x);
      if (bv > 0.0 && bv < 1.0 && r > 0.005) {
        vec2 uv = vec2(phi * 0.15915494, bv);
        vec2 dx = dFdx(uv); vec2 dy = dFdy(uv);
        dx.x -= floor(dx.x + 0.5); dy.x -= floor(dy.x + 0.5);
        float m = textureGrad(uMask, uv, dx, dy).r;
        vec2 e = max(uMaskTexel * 1.25, max(abs(dx), abs(dy)));
        float mxp = textureGrad(uMask, uv + vec2(e.x, 0.0), dx, dy).r;
        float mxn = textureGrad(uMask, uv - vec2(e.x, 0.0), dx, dy).r;
        float myp = textureGrad(uMask, uv + vec2(0.0, e.y), dx, dy).r;
        float myn = textureGrad(uMask, uv - vec2(0.0, e.y), dx, dy).r;
        vec2 grad = vec2((mxp - mxn) / (2.0 * e.x * 6.2831853 * r), (myp - myn) / (2.0 * e.y * (uBand.y - uBand.x)));
        normal = normalize(normal + uDepth * (grad.x * T + grad.y * B));
        // Etched floor: frosted bare aluminium.
        float kf = 1.0 - smoothstep(0.3, 1.0, fy * 60000.0);
        float frost = 0.85 + 0.3 * mix(0.5, hash12(floor(vec2(phi * r, vObj.y) * 60000.0)), kf);
        diffuseColor.rgb = mix(diffuseColor.rgb, uEtch * frost, m);
        metalnessFactor = mix(metalnessFactor, 0.55, m);
        roughnessFactor = mix(roughnessFactor, 0.5, m);
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
        diffuseColor.rgb *= mix(1.0, 0.45 + 0.55 * smoothstep(0.0, 0.35, h), k);
        roughnessFactor = mix(roughnessFactor + 0.12, roughnessFactor * (0.8 + 0.4 * flatTop), k);
      }`,
  });
  return { material: m, uniforms };
}

/** Woven steel grille over a dark foam core. */
export function createGrilleMaterial(cheap: boolean) {
  const uniforms = {
    uGC: { value: MIC.grilleC },
    uGR: { value: MIC.grilleR },
    uSquash: { value: MIC.grilleSquash },
    uPitch: { value: 0.0013 },
    uWire: { value: 0.17 },
    uAmp: { value: 0.09 },
    uFoam: { value: lin('#0b0b0c') },
  };
  const m = new MeshStandardMaterial({ color: lin('#d5d8dd'), metalness: 1, roughness: 0.26, envMapIntensity: 1.6 });
  patch(m, `mic-grille-${cheap ? 1 : 0}`, {
    uniforms,
    fragmentHead: `uniform float uGC; uniform float uGR; uniform float uSquash; uniform float uPitch; uniform float uWire; uniform float uAmp; uniform vec3 uFoam;`,
    fragmentBody: `
      vec3 q = vObj - vec3(0.0, uGC, 0.0); q.y /= uSquash;
      vec3 d = normalize(q);
      vec2 st = d.xz * uGR / sqrt(max(0.5 * (1.0 + d.y), 0.02));
      vec2 g = st / uPitch;
      vec3 N = normal;
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
      float aa = 1.0 - smoothstep(${cheap ? '0.25, 0.55' : '0.35, 0.8'}, fwm);
      float ndv = clamp(dot(N, normalize(vViewPosition)), 0.0, 1.0);
      float w = uWire * mix(1.7, 1.0, sqrt(ndv));
      vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
      float aA = 3.14159265 * (g.x - 0.5 + cell.y);
      float aB = 3.14159265 * (g.y - 0.5 + cell.x);
      float hA = uAmp * cos(aA);
      float hB = -uAmp * cos(aB);
      float cA = w * w - f.y * f.y; float cB = w * w - f.x * f.x;
      float zA = cA > 0.0 ? hA + sqrt(cA) : -1e3;
      float zB = cB > 0.0 ? hB + sqrt(cB) : -1e3;
      float soft = max(fwm, 0.02);
      float mA = 1.0 - smoothstep(w - soft, w + soft, abs(f.y));
      float mB = 1.0 - smoothstep(w - soft, w + soft, abs(f.x));
      float mask = max(mA, mB);
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
      float gapAO = smoothstep(0.0, 0.22, min(abs(f.x), abs(f.y)) - w);
      float foamN = 0.75 + 0.5 * hash12(floor(g * 3.0));
      vec3 foam = uFoam * foamN * (0.35 + 0.65 * gapAO);
      float wireAO = 0.55 + 0.45 * smoothstep(-uAmp, uAmp, hTop);
      vec3 cDet = mix(foam, diffuseColor.rgb * wireAO, mask);
      float metDet = mask;
      float rouDet = mix(0.95, roughnessFactor, mask);
      vec3 nDet = normalize(mix(N, nw, mask));
      float cov = 1.0 - (1.0 - 2.0 * uWire) * (1.0 - 2.0 * uWire);
      cov = mix(cov, 1.0, (1.0 - ndv) * 0.6);
      vec3 cAvg = mix(foam, diffuseColor.rgb * 0.85, cov);
      diffuseColor.rgb = mix(cAvg, cDet, aa);
      metalnessFactor = mix(cov, metDet, aa);
      roughnessFactor = mix(0.42, rouDet, aa);
      normal = normalize(mix(N, nDet, aa));`,
  });
  return { material: m, uniforms };
}

export function createPolishedMaterial() {
  return new MeshStandardMaterial({ color: lin('#d4d6da'), metalness: 1, roughness: 0.11, envMapIntensity: 1.3 });
}

/** Matte black powder-coated / cast hardware for the stand and clip. */
export function createHardwareMaterial() {
  const m = new MeshStandardMaterial({ color: lin('#141416'), metalness: 0.85, roughness: 0.42, envMapIntensity: 0.9 });
  patch(m, 'hardware', {
    uniforms: {},
    fragmentBody: `
      float n = vnoise(vWorld.xy * 900.0 + vWorld.z * 700.0);
      roughnessFactor = clamp(roughnessFactor + (n - 0.5) * 0.12, 0.05, 1.0);`,
  });
  return m;
}

/* ------------------------------------------------------------------------- */
/* Stage                                                                     */
/* ------------------------------------------------------------------------- */

export function createFloorMaterial(cheap: boolean) {
  const m = new MeshStandardMaterial({ color: lin('#060606'), metalness: 0, roughness: 0.65, envMapIntensity: 0.1 });
  patch(m, `floor-${cheap ? 1 : 0}`, {
    uniforms: {},
    fragmentBody: `
      vec2 p = vWorld.xz;
      float broad = vnoise(p * 0.35) * 0.6 + vnoise(p * 1.3 + 4.0) * 0.4;
      roughnessFactor = clamp(0.58 + 0.2 * broad, 0.05, 1.0);
      diffuseColor.rgb *= 0.85 + 0.3 * broad;`,
  });
  return m;
}

/** The red circle: low-pile carpet with fibre noise, sheen and a soft, fuzzy edge. */
export function createRugMaterial(cheap: boolean) {
  const params = { color: lin('#EB0028'), metalness: 0, roughness: 1, envMapIntensity: 0.1 };
  const m = cheap
    ? new MeshStandardMaterial(params)
    : new MeshPhysicalMaterial({ ...params, specularIntensity: 0.35, sheen: 0.5, sheenRoughness: 0.55, sheenColor: lin('#b0001c') });
  patch(m, `rug-${cheap ? 1 : 0}`, {
    uniforms: { uR: { value: RUG_RADIUS } },
    fragmentHead: 'uniform float uR;',
    fragmentBody: `
      vec2 p = vWorld.xz;
      float rr = length(p);
      float fw = max(length(fwidth(p)), 1e-6);
      float k1 = 1.0 - smoothstep(0.35 / 700.0, 1.1 / 700.0, fw);
      float k2 = 1.0 - smoothstep(0.35 / 180.0, 1.1 / 180.0, fw);
      float n1 = mix(0.5, vnoise(p * 700.0), k1);
      float n2 = mix(0.5, vnoise(p * 180.0 + 7.3), k2);
      float n3 = vnoise(p * 4.0) * 0.5 + vnoise(p * 15.0) * 0.3 + vnoise(p * 41.0) * 0.2;
      float fib = n1 * 0.55 + n2 * 0.45;
      float edge = smoothstep(uR - 0.05, uR + 0.012, rr);
      diffuseColor.rgb *= (0.78 + 0.34 * fib + 0.26 * (n3 - 0.5)) * (1.0 - 0.45 * edge);
      roughnessFactor = 1.0;
      ${cheap ? '' : 'normal = bumpNormal(normal, -vViewPosition, fib, 0.004 + 0.004 * edge);'}`,
  });
  return m;
}

export function createSeatMaterial() {
  const m = new MeshStandardMaterial({ color: lin('#232327'), metalness: 0.0, roughness: 0.55, envMapIntensity: 0.6 });
  patch(m, 'seat', {
    uniforms: {},
    fragmentBody: `
      float n = vnoise(vWorld.xy * 260.0 + vWorld.zx * 190.0);
      diffuseColor.rgb *= 0.85 + 0.3 * n;`,
  });
  return m;
}

/* ------------------------------------------------------------------------- */
/* Spot cone and dust                                                        */
/* ------------------------------------------------------------------------- */

export function createConeMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uColor: { value: lin('#fff1e0') },
      uHeight: { value: SPOT_HEIGHT },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uIntensity; uniform vec3 uColor; uniform float uHeight;
      varying vec3 vWorld; varying vec3 vN;
      ${GLSL_NOISE}
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        float facing = abs(dot(normalize(vN), V));
        float core = pow(facing, 2.4);
        float y01 = clamp(vWorld.y / uHeight, 0.0, 1.0);
        vec3 p = vWorld * 1.3 + vec3(0.0, -uTime * 0.05, uTime * 0.02);
        float n = vnoise3(p) * 0.6 + vnoise3(p * 2.7 + 3.1) * 0.4;
        float haze = 0.55 + 0.75 * n;
        float fadeFloor = smoothstep(0.0, 0.9, vWorld.y);
        float fadeTop = 1.0 - smoothstep(0.82, 1.0, y01);
        float camDist = length(cameraPosition - vWorld);
        float fadeNear = smoothstep(0.4, 2.0, camDist);
        float a = core * haze * fadeFloor * fadeTop * fadeNear * (0.35 + 0.65 * (1.0 - y01));
        gl_FragColor = vec4(uColor * a * uIntensity * 0.26, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
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
      uTan: { value: (RUG_RADIUS + 0.25) / SPOT_HEIGHT },
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
        float coneR = (uHeight - p.y) * uTan;
        float inside = 1.0 - smoothstep(coneR * 0.65, coneR, length(p.xz));
        float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + seed.z) + seed.x * 40.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = (0.6 + seed.z * 1.2) * 0.006;
        gl_PointSize = max(1.0, size * uScale / -mv.z);
        float fadeNear = smoothstep(0.3, 1.5, -mv.z);
        vA = inside * twinkle * fadeNear * smoothstep(0.0, 0.6, p.y) * min(1.0, gl_PointSize / 2.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = 1.0 - smoothstep(0.1, 0.5, length(c));
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.9) * d * vA * 0.5 * uIntensity, 1.0);
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
