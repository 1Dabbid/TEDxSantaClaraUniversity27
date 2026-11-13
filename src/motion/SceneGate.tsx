'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import SceneLoader from '@/scene/SceneLoader';

/**
 * Decides whether the WebGL scene exists at all on the current route.
 *
 * - `/`: mounted (SceneLoader still waits for load + idle and checks quality).
 * - `/partners`, `/speakers/*`, 404: not mounted, unless the home page was already
 *   shown in this browsing session (this document). Then the live canvas is kept,
 *   hidden and paused, so coming back home is instant, and nothing is torn down.
 *   A session flag (sessionStorage) records the visit for diagnostics and future
 *   use; a cold load of a secondary page never pays for three.js.
 *
 * Pausing uses the canvas' R3F root (frameloop 'never'), so the scene code in
 * src/scene is untouched. @react-three/fiber is imported lazily, only once the
 * scene chunk has already loaded it.
 */

const FLAG = 'fp:home-visited';

type FiberRoots = Map<Element, { store: { getState: () => { frameloop: string; setFrameloop: (f: 'always' | 'demand' | 'never') => void } } }>;

async function setPaused(container: HTMLElement | null, paused: boolean, saved: { current: string }) {
  const canvas = container?.querySelector('canvas');
  if (!canvas) return;
  const { _roots } = (await import('@react-three/fiber')) as unknown as { _roots: FiberRoots };
  const state = _roots.get(canvas)?.store.getState();
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
    const mo = new MutationObserver(() => void setPaused(el, true, saved));
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [onHome, seen]);

  if (!seen) return null;
  return (
    <div ref={ref} className="scene-gate" data-hidden={onHome ? undefined : ''} aria-hidden="true">
      <SceneLoader />
    </div>
  );
}
