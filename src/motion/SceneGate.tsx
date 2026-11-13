'use client';

import { usePathname } from 'next/navigation';
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSceneEnabled } from '@/lib/quality';

// Not even the loader is in the first-load bundle: it (and next/dynamic) is fetched only when the
// scene may actually run on this route and device.
const SceneLoader = lazy(() => import('@/scene/SceneLoader'));

/**
 * Decides whether the WebGL scene exists at all on the current route.
 *
 * - `/`: mounted when `useSceneEnabled()` (quality not `static`, WebGL not a software
 *   rasterizer); SceneLoader then still waits for load + idle.
 * - `/partners`, `/speakers/*`, 404: not mounted, unless the home page was already
 *   shown in this browsing session (this document). Then the live canvas is kept,
 *   hidden and paused, so coming back home is instant, and nothing is torn down.
 *   A session flag (sessionStorage) records the visit for diagnostics and future
 *   use; a cold load of a secondary page never pays for three.js.
 *
 * Pausing uses the canvas' R3F root (frameloop 'never'), so the scene code in
 * src/scene is untouched. @react-three/fiber is imported lazily, only once the
 * scene chunk has already loaded it.
 *
 * The scene is decoration: if it fails (a chunk that does not load on a flaky
 * network or after a redeploy, WebGL context creation failing although the probe
 * passed), SceneBoundary catches the error, the scene stays down for the rest of
 * the visit and the still frames (SceneStills) stay up. Nothing reaches the
 * route's or the global error page.
 */

class SceneBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const FLAG = 'fp:home-visited';

type FiberRoots = Map<Element, { store: { getState: () => { frameloop: string; setFrameloop: (f: 'always' | 'demand' | 'never') => void } } }>;

type R3FState = { gl: { toneMappingExposure: number; info: { render: { frame: number } } } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolves true once the live canvas has drawn and faded up, so the still
 * frames (src/components/SceneStills.tsx) can fade out over an identical live
 * frame instead of over black: the canvas has rendered frames, its CSS fade-in
 * has finished, and the tone-mapping exposure (the scene fades up from black)
 * has stopped rising. Resolves to the canvas, or null if none draws within
 * `timeout` ms.
 */
async function whenLive(container: HTMLElement, cancelled: () => boolean, timeout = 20_000): Promise<HTMLCanvasElement | null> {
  const t0 = performance.now();
  let canvas: HTMLCanvasElement | null = null;
  let state: R3FState | undefined;
  while (!cancelled() && performance.now() - t0 < timeout) {
    canvas = container.querySelector('canvas');
    if (canvas) {
      const fiber = (await import('@react-three/fiber').catch(() => null)) as unknown as {
        _roots: Map<Element, { store: { getState: () => R3FState } }>;
      } | null;
      if (!fiber) return null;
      state = fiber._roots.get(canvas)?.store.getState();
      if (state && state.gl.info.render.frame > 1) break;
    }
    await sleep(150);
  }
  if (!canvas || !state || cancelled() || performance.now() - t0 >= timeout) return null;
  const drawnAt = performance.now();
  const fades = (canvas.closest('.scene-canvas') as HTMLElement | null)?.getAnimations() ?? [];
  await Promise.race([Promise.all(fades.map((a) => a.finished.catch(() => null))), sleep(3000)]);
  // Exposure settles within ~2 s; give up waiting after 5 s (e.g. the dark end of the page stays at 0).
  let prev = -1;
  while (!cancelled() && performance.now() - drawnAt < 5000) {
    const e = state.gl.toneMappingExposure;
    if (e > 0.05 && Math.abs(e - prev) < 0.02 * e) break;
    prev = e;
    await sleep(200);
  }
  return cancelled() ? null : canvas;
}

async function setPaused(container: HTMLElement | null, paused: boolean, saved: { current: string }) {
  const canvas = container?.querySelector('canvas');
  if (!canvas) return;
  const fiber = (await import('@react-three/fiber').catch(() => null)) as unknown as { _roots: FiberRoots } | null;
  const state = fiber?._roots.get(canvas)?.store.getState();
  if (!state) return;
  if (paused) {
    if (state.frameloop !== 'never') saved.current = state.frameloop;
    state.setFrameloop('never');
  } else if (state.frameloop === 'never') {
    state.setFrameloop((saved.current as 'always' | 'demand') || 'always');
  }
}

export default function SceneGate() {
  const pathname = usePathname();
  const onHome = pathname === '/';
  // Set during render (no extra commit); the layout keeps this component alive
  // across client-side navigations, so "seen" lasts for the browsing session.
  const [seen, setSeen] = useState(onHome);
  if (onHome && !seen) setSeen(true);
  const ref = useRef<HTMLDivElement>(null);
  const saved = useRef('always');
  // A failed scene stays down for the rest of the visit (the stills cover it).
  const [failed, setFailed] = useState(false);
  const sceneOk = useSceneEnabled() && !failed;

  useEffect(() => {
    if (!onHome) return;
    try {
      sessionStorage.setItem(FLAG, '1');
    } catch {
      /* storage blocked: the in-memory flag is enough */
    }
  }, [onHome]);

  // Pause off home, resume on home. The canvas may appear later (SceneLoader waits
  // for idle), so watch for it while hidden.
  useEffect(() => {
    const el = ref.current;
    if (!el || !seen) return;
    void setPaused(el, !onHome, saved);
    if (onHome) return;
    const pause = () => void setPaused(el, true, saved);
    const mo = new MutationObserver(pause);
    mo.observe(el, { childList: true, subtree: true });
    // Coming back to the tab must not wake the hidden canvas: re-assert the pause after
    // anything else that reacts to the same event (the scene has its own wake-up handler).
    let t: ReturnType<typeof setTimeout> | undefined;
    const onVis = () => {
      if (document.hidden) return;
      pause();
      clearTimeout(t);
      t = setTimeout(pause, 100);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(t);
    };
  }, [onHome, seen, sceneOk]);

  // Still frames (SceneStills, home page) stand in for the canvas until it is live:
  // `html.scene-pending` once the scene is known to load (the stills below the hero are
  // then never requested), `html.scene-live` once it has drawn and faded up (the stills
  // fade out). The classes outlive route changes, as the canvas does.
  useEffect(() => {
    const root = document.documentElement;
    if (!seen || !sceneOk) {
      root.classList.remove('scene-pending', 'scene-live');
      return;
    }
    if (root.classList.contains('scene-live') || !ref.current) return;
    root.classList.add('scene-pending');
    let cancelled = false;
    let lost: (() => void) | undefined;
    let drawn: HTMLCanvasElement | null = null;
    void whenLive(ref.current, () => cancelled).then((canvas) => {
      if (cancelled) return;
      root.classList.remove('scene-pending');
      if (!canvas) return;
      root.classList.add('scene-live');
      // If the GPU drops the context, the stills come back.
      drawn = canvas;
      lost = () => root.classList.remove('scene-live');
      canvas.addEventListener('webglcontextlost', lost);
    });
    return () => {
      cancelled = true;
      if (lost) drawn?.removeEventListener('webglcontextlost', lost);
    };
  }, [seen, sceneOk]);

  // Save-Data: only the hero still (CSS cannot see the setting; without JS all stills load lazily).
  useEffect(() => {
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) {
      document.documentElement.classList.add('save-data');
    }
  }, []);

  if (!seen || !sceneOk) return null;
  return (
    <div ref={ref} className="scene-gate" data-hidden={onHome ? undefined : ''} aria-hidden="true">
      <SceneBoundary onFail={() => setFailed(true)}>
        <Suspense fallback={null}>
          <SceneLoader />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
