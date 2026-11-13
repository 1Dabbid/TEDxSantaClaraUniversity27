'use client';

import { useEffect } from 'react';
import { useQuality, type Quality } from '@/lib/quality';

/** Dispatched on window when motion is switched off at runtime (the engine failed to load or start). */
export const MOTION_OFF = 'motion:off';

export type MotionKit = typeof import('./gsap') & { quality: Exclude<Quality, 'static'>; root: HTMLElement };

/**
 * Runs a section's GSAP setup once gsap has been lazily loaded, only when
 * quality !== 'static' and `html.motion` is on. Everything created inside
 * `setup` is recorded in a gsap.context scoped to the section and reverted on
 * unmount (route change) or when quality changes, so no ScrollTriggers or
 * SplitText instances leak across navigations. `setup` may return extra cleanup.
 */
// Several sections mount in the same commit: coalesce their refreshes into one.
let refreshRaf = 0;
function refreshSoon(ST: typeof import('./gsap')['ScrollTrigger']) {
  cancelAnimationFrame(refreshRaf);
  refreshRaf = requestAnimationFrame(() => ST.refresh());
}

export function useSectionMotion(sectionId: string, setup: (kit: MotionKit) => void | (() => void)) {
  const quality = useQuality();

  useEffect(() => {
    if (quality === 'static') return;
    const root = document.getElementById(sectionId);
    if (!root) return;
    let cancelled = false;
    let ctx: { revert: () => void } | null = null;
    let extra: void | (() => void);
    const teardown = () => {
      const [x, c] = [extra, ctx];
      extra = undefined;
      ctx = null;
      try {
        if (typeof x === 'function') x();
      } finally {
        c?.revert();
      }
    };

    import('./gsap')
      .then((mod) => {
        if (cancelled || !document.documentElement.classList.contains('motion')) return;
        let failed = false as boolean;
        ctx = mod.gsap.context(() => {
          // Caught in here: a throw inside a gsap.context function would leave it the
          // active context for every tween created afterwards, anywhere on the page.
          try {
            extra = setup({ ...mod, quality, root });
          } catch (err) {
            failed = true;
            console.error(`[motion] #${sectionId}:`, err);
          }
        }, root);
        // Revert whatever it set up before the throw (hidden start states included):
        // the section stays exactly as rendered.
        if (failed) teardown();
        else refreshSoon(mod.ScrollTrigger);
      })
      .catch(() => {
        // gsap never arrived: nothing was set up, the section stays as rendered.
      });
    // The engine failed to start (MotionRoot drops html.motion): back to static.
    window.addEventListener(MOTION_OFF, teardown);

    return () => {
      cancelled = true;
      window.removeEventListener(MOTION_OFF, teardown);
      teardown();
    };
    // `setup` is a stable module-level function in every caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, sectionId]);
}
