'use client';

import { useEffect } from 'react';
import { useQuality, type Quality } from '@/lib/quality';

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

    import('./gsap').then((mod) => {
      if (cancelled || !document.documentElement.classList.contains('motion')) return;
      ctx = mod.gsap.context(() => {
        extra = setup({ ...mod, quality, root });
      }, root);
      refreshSoon(mod.ScrollTrigger);
    });

    return () => {
      cancelled = true;
      if (typeof extra === 'function') extra();
      ctx?.revert();
    };
    // `setup` is a stable module-level function in every caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, sectionId]);
}
