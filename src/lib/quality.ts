'use client';

import { useSyncExternalStore } from 'react';

/**
 * Rendering quality tier.
 *
 * - `static`: no WebGL canvas, no smooth scroll, no scroll-driven animation.
 *   Chosen for prefers-reduced-motion, Save-Data, or no WebGL support.
 *   This is also what the server renders, so the HTML is always the static look.
 * - `low`: canvas with reduced DPR and cheaper effects. Coarse pointer, small
 *   viewport, low deviceMemory or few CPU cores.
 * - `high`: everything on.
 *
 * Read it in components with `useQuality()`. Outside React use `getQuality()`
 * and `subscribeQuality()`.
 */
export type Quality = 'high' | 'low' | 'static';

type NavigatorExtras = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; addEventListener?: (t: string, cb: () => void) => void };
};

let cached: Quality | null = null;
let webglSupport: boolean | null = null;
const listeners = new Set<() => void>();

function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGLRenderingContext | null) ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    webglSupport = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function compute(): Quality {
  if (typeof window === 'undefined') return 'static';
  const nav = navigator as NavigatorExtras;
  const mq = (q: string) => window.matchMedia(q).matches;

  if (mq('(prefers-reduced-motion: reduce)')) return 'static';
  if (nav.connection?.saveData) return 'static';
  if (!hasWebGL()) return 'static';

  const coarse = mq('(pointer: coarse)');
  const small = Math.min(window.innerWidth, window.innerHeight) < 600 || window.innerWidth < 768;
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const fewCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4;

  if (coarse || small || lowMemory || fewCores) return 'low';
  return 'high';
}

function recompute() {
  const next = compute();
  if (next !== cached) {
    cached = next;
    listeners.forEach((l) => l());
  }
}

let watching = false;
function watch() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  for (const q of ['(prefers-reduced-motion: reduce)', '(pointer: coarse)']) {
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
  if (cached === null) cached = compute();
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
