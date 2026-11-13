import { ScrollTrigger } from '../gsap';
import { initChrome } from './chrome';
import { initCursor } from './cursor';
import { initFocusScroll } from './focus';
import { initMagnetic } from './magnetic';
import { initNavigation } from './navigation';
import { killReveals, pruneReveals, revealFocused, scanReveals } from './reveal';

/**
 * The global motion engine. Loaded on demand by MotionRoot (never part of the
 * first-load bundle) and only when quality !== 'static'.
 */

export type EngineOptions = {
  push: (href: string) => void;
  prefetch: (href: string) => void;
  cursorRoot: HTMLElement | null;
  curtain: HTMLElement | null;
};

export type Engine = {
  route: (initial: boolean) => void;
  stop: () => void;
};

const FINE = '(hover: hover) and (pointer: fine)';

export function startEngine({ push, prefetch, cursorRoot, curtain }: EngineOptions): Engine {
  const cleanups: (() => void)[] = [];

  cleanups.push(initChrome());
  cleanups.push(initFocusScroll());
  const nav = initNavigation({ push, prefetch }, curtain);
  cleanups.push(nav.destroy);

  // Pointer-only niceties follow the media query live (e.g. a tablet docking a mouse).
  const mq = window.matchMedia(FINE);
  let pointerCleanups: (() => void)[] = [];
  const syncPointer = () => {
    pointerCleanups.forEach((c) => c());
    pointerCleanups = [];
    if (!mq.matches) return;
    pointerCleanups.push(initMagnetic());
    if (cursorRoot) pointerCleanups.push(initCursor(cursorRoot));
  };
  syncPointer();
  mq.addEventListener('change', syncPointer);
  cleanups.push(() => {
    mq.removeEventListener('change', syncPointer);
    pointerCleanups.forEach((c) => c());
  });

  const onFocusIn = (e: FocusEvent) => {
    if (e.target instanceof Element) revealFocused(e.target);
  };
  document.addEventListener('focusin', onFocusIn);
  cleanups.push(() => document.removeEventListener('focusin', onFocusIn));

  let refreshRaf = 0;
  const refreshSoon = () => {
    cancelAnimationFrame(refreshRaf);
    refreshRaf = requestAnimationFrame(() => ScrollTrigger.refresh());
  };

  // Re-split / re-measure once web fonts settle (line breaks can change).
  const onFonts = () => refreshSoon();
  document.fonts?.addEventListener?.('loadingdone', onFonts);
  cleanups.push(() => document.fonts?.removeEventListener?.('loadingdone', onFonts));

  return {
    route(initial) {
      pruneReveals();
      nav.onRoute(initial);
      // Scan after the route's scroll reset so above-the-fold elements play at once.
      requestAnimationFrame(() => {
        scanReveals(document);
        refreshSoon();
      });
    },
    stop() {
      cancelAnimationFrame(refreshRaf);
      cleanups.forEach((c) => c());
      killReveals();
    },
  };
}
