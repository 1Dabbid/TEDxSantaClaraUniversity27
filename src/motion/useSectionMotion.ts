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
 *
 * Setup is spread out so page load is not one long main-thread task: a section
 * within a viewport of the screen is set up at once; one further away waits for
 * an idle moment (3 s at most) or until the reader comes near it, whichever is
 * first. A deep link (/#tickets) sets everything up at once, so the page has its
 * final layout before the engine lands on the target.
 */
// Several sections mount in the same commit: coalesce their refreshes into one.
let refreshRaf = 0;
function refreshSoon(ST: typeof import('./gsap')['ScrollTrigger']) {
  cancelAnimationFrame(refreshRaf);
  refreshRaf = requestAnimationFrame(() => ST.refresh());
}

// Deferred sections finish one by one: one refresh once they have gone quiet.
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function refreshLater(ST: typeof import('./gsap')['ScrollTrigger']) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => ST.refresh(), 200);
}

/**
 * Calls `run(false)` right away for a section on or near the screen (or when the
 * browser cannot tell us, or on a deep link); otherwise `run(true)` at the first
 * idle moment or when the section comes within a viewport of the screen.
 * Returns a cancel function.
 */
function whenNeeded(root: HTMLElement, run: (deferred: boolean) => void): () => void {
  if (window.location.hash || !('IntersectionObserver' in window) || !('requestIdleCallback' in window)) {
    run(false);
    return () => {};
  }
  let done = false;
  let idle = 0;
  const stop = () => {
    done = true;
    io.disconnect();
    if (idle) window.cancelIdleCallback(idle);
  };
  const go = (deferred: boolean) => {
    if (done) return;
    stop();
    run(deferred);
  };
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) go(idle !== 0);
      else if (!idle) idle = window.requestIdleCallback(() => go(true), { timeout: 3000 });
    },
    { rootMargin: '100% 0px' },
  );
  io.observe(root);
  return stop;
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

    const run = (deferred: boolean) => import('./gsap')
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
        else if (deferred) refreshLater(mod.ScrollTrigger);
        else refreshSoon(mod.ScrollTrigger);
      })
      .catch(() => {
        // gsap never arrived: nothing was set up, the section stays as rendered.
      });
    const cancelWait = whenNeeded(root, run);
    // The engine failed to start (MotionRoot drops html.motion): back to static.
    window.addEventListener(MOTION_OFF, teardown);

    return () => {
      cancelled = true;
      cancelWait();
      window.removeEventListener(MOTION_OFF, teardown);
      teardown();
    };
    // `setup` is a stable module-level function in every caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, sectionId]);
}
