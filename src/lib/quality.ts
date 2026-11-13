'use client';

import { useSyncExternalStore } from 'react';

/**
 * Rendering quality tier.
 *
 * - `static`: no WebGL canvas, no smooth scroll, no scroll-driven animation.
 *   Chosen for prefers-reduced-motion, Save-Data, a 2G-class connection, or no
 *   WebGL support. This is also what the server renders, so the HTML is always
 *   the static look.
 * - `low`: canvas with reduced DPR and cheaper effects. Phones and tablets
 *   (touch-only pointer), small viewports, clearly weak hardware (≤ 2 cores or
 *   ≤ 2 GB, or 4 cores *and* 4 GB together), or a known weak GPU.
 * - `high`: everything on. A 4-core laptop with a real GPU and a mouse is high.
 *
 * Separately, `sceneEnabled()` is false when WebGL only runs on a software
 * rasterizer (SwiftShader, llvmpipe, Microsoft Basic Render Driver, or the
 * browser reports a major performance caveat). Such a device keeps smooth
 * scroll and motion (`low`), but the 3D scene is never downloaded: rendering
 * it on the CPU would block the main thread for hundreds of ms per frame.
 * SceneGate checks it before loading anything from src/scene.
 *
 * The WebGL probe itself is deferred to the first idle callback after
 * hydration (see scheduleProbe): until then the tier assumes a working GPU and
 * `sceneEnabled()` is false; the probe can then lower the tier.
 *
 * QA override: `?quality=high|low|static` on the first URL of a visit forces
 * the tier (and forces the scene on for high/low, even on software WebGL).
 *
 * Read it in components with `useQuality()`. Outside React use `getQuality()`
 * and `subscribeQuality()`. Everything here is SSR safe: the server always
 * sees `static` and no scene.
 */
export type Quality = 'high' | 'low' | 'static';

type NavigatorExtras = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
    addEventListener?: (t: string, cb: () => void) => void;
  };
};

type GpuInfo = { webgl: boolean; software: boolean; weak: boolean; renderer: string };

let cached: Quality | null = null;
let cachedScene = false;
let gpu: GpuInfo | null = null;
const ASSUMED_GPU: GpuInfo = { webgl: true, software: false, weak: false, renderer: '' };
let override: Quality | null | undefined;
const listeners = new Set<() => void>();

// Software rasterizers: WebGL "works" but every frame is drawn on the CPU.
const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render driver|mesa offscreen|lavapipe/i;
// GPUs that run the scene, but only at reduced DPR and effects.
const WEAK_GPU =
  /intel\(r\) hd graphics(?! [5-6]\d\d\b)|intel hd graphics(?! [5-6]\d\d\b)|gma \d|mali-(?:[2-4]\d\d|t\d+|g[357][12]\b)|adreno \(tm\) [2-5]\d\d|powervr|sgx|videocore|geforce (?:[2-9]\d\d|gt \d{3})m?\b|radeon (?:hd|r[579] m?\d)/i;

function readOverride(): Quality | null {
  if (override !== undefined) return override;
  override = null;
  try {
    const q = new URLSearchParams(window.location.search).get('quality');
    if (q === 'high' || q === 'low' || q === 'static') override = q;
  } catch {
    /* no URL access: no override */
  }
  return override;
}

/**
 * One short-lived WebGL context, created once per page load: is WebGL there,
 * is it a software rasterizer, and is the GPU on the weak list.
 */
function probeGpu(): GpuInfo {
  if (gpu) return gpu;
  gpu = { webgl: false, software: false, weak: false, renderer: '' };
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const get = (type: 'webgl2' | 'webgl', opts?: WebGLContextAttributes) =>
      canvas.getContext(type, opts) as WebGLRenderingContext | null;
    // A context that refuses `failIfMajorPerformanceCaveat` but exists without it is software rendered.
    let gl = get('webgl2', { failIfMajorPerformanceCaveat: true }) ?? get('webgl', { failIfMajorPerformanceCaveat: true });
    let caveat = false;
    if (!gl) {
      // getContext returns null for every later call on a canvas that already has one: use a fresh canvas.
      const c2 = document.createElement('canvas');
      c2.width = c2.height = 1;
      gl =
        (c2.getContext('webgl2') as WebGLRenderingContext | null) ??
        (c2.getContext('webgl') as WebGLRenderingContext | null);
      caveat = Boolean(gl);
    }
    if (gl) {
      // Firefox reports the real (sanitized) renderer here and warns about the debug extension;
      // Chromium and WebKit say "WebKit WebGL" and need the extension.
      let renderer = String(gl.getParameter(gl.RENDERER) ?? '');
      if (/^webkit webgl$/i.test(renderer)) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? renderer);
      }
      gpu = {
        webgl: true,
        software: caveat || SOFTWARE_GPU.test(renderer),
        weak: WEAK_GPU.test(renderer),
        renderer,
      };
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* treat as no WebGL */
  }
  return gpu;
}

function compute(): Quality {
  if (typeof window === 'undefined') return 'static';
  const forced = readOverride();
  if (forced) return forced;

  const nav = navigator as NavigatorExtras;
  const mq = (q: string) => window.matchMedia(q).matches;

  if (mq('(prefers-reduced-motion: reduce)')) return 'static';
  const conn = nav.connection;
  if (conn?.saveData) return 'static';
  if (conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') return 'static';
  // Until the idle-time probe has run, assume a working hardware GPU (see scheduleProbe).
  const g = gpu ?? ASSUMED_GPU;
  if (!g.webgl) return 'static';

  // Touch-first device (phone, tablet): no fine pointer anywhere.
  const touchOnly = mq('(pointer: coarse)') && !mq('(any-pointer: fine)');
  const small = Math.min(window.innerWidth, window.innerHeight) < 600 || window.innerWidth < 768;
  // deviceMemory is Chromium-only and capped at 8; hardwareConcurrency is capped/rounded by some browsers
  // (Safari reports at most 8, sometimes 4). Treat a single "4" as normal, only both together as weak.
  const mem = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;
  const cores = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined;
  const veryWeak = (mem !== undefined && mem <= 2) || (cores !== undefined && cores <= 2);
  const modest = mem !== undefined && mem <= 4 && cores !== undefined && cores <= 4;

  if (touchOnly || small || veryWeak || modest || g.weak || g.software) return 'low';
  return 'high';
}

/** False when the 3D scene must not be downloaded at all (static tier or software-only WebGL). */
export function sceneEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  getQuality();
  return cachedScene;
}

function computeScene(q: Quality): boolean {
  if (q === 'static') return false;
  if (readOverride()) return true;
  // Unknown until the probe ran: the scene waits for load + idle anyway, so it simply waits for the probe too.
  return gpu !== null && !gpu.software;
}

/**
 * The WebGL probe costs one context creation (≈10 ms on a laptop, 30–40 ms on a
 * 4x-throttled phone profile). It runs at the first idle moment after hydration
 * instead of inside it; the tier is then recomputed (a weak or software GPU moves
 * high → low, no WebGL at all → static) before the scene is ever requested.
 */
let probeScheduled = false;
function scheduleProbe() {
  if (probeScheduled || typeof window === 'undefined') return;
  probeScheduled = true;
  if (readOverride()) {
    // Forced tier: still probe (diagnostics), but synchronously so the scene can start.
    probeGpu();
    return;
  }
  const run = () => {
    probeGpu();
    recompute();
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1500 });
  else setTimeout(run, 300);
}

/** The renderer string the tier was based on (diagnostics only; '' before the first probe or on the server). */
export function gpuRenderer(): string {
  return gpu?.renderer ?? '';
}

function recompute() {
  const next = compute();
  const scene = computeScene(next);
  if (next !== cached || scene !== cachedScene) {
    cached = next;
    cachedScene = scene;
    listeners.forEach((l) => l());
  }
}

let watching = false;
function watch() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  scheduleProbe();
  for (const q of ['(prefers-reduced-motion: reduce)', '(pointer: coarse)', '(any-pointer: fine)']) {
    window.matchMedia(q).addEventListener('change', recompute);
  }
  let t: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(recompute, 250);
  });
  (navigator as NavigatorExtras).connection?.addEventListener?.('change', recompute);
}

export function getQuality(): Quality {
  if (typeof window === 'undefined') return 'static';
  if (cached === null) {
    scheduleProbe();
    cached = compute();
    cachedScene = computeScene(cached);
  }
  return cached;
}

export function subscribeQuality(listener: () => void): () => void {
  watch();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getServerQuality = (): Quality => 'static';

/** SSR safe: renders `static` on the server and during hydration, then upgrades. */
export function useQuality(): Quality {
  return useSyncExternalStore(subscribeQuality, getQuality, getServerQuality);
}

const getServerScene = () => false;

/** SSR safe: false on the server and during hydration; true once the scene may load on this device. */
export function useSceneEnabled(): boolean {
  return useSyncExternalStore(subscribeQuality, sceneEnabled, getServerScene);
}
