import { lenisRef } from '../lenisRef';

/**
 * Keyboard focus and smooth scrolling.
 *
 * The browser scrolls a newly focused element into view instantly (html has no
 * scroll-behavior: smooth while Lenis runs) and Lenis adopts native scroll
 * positions as they happen. Two things could still go wrong:
 *   1. a Lenis animation in flight (wheel inertia, an anchor glide) keeps running
 *      and drags the page away from the element that just got focus: we cancel
 *      it the moment keyboard focus moves;
 *   2. an element that is "in view" but under the sticky header (or a hair off
 *      the bottom edge) is not scrolled at all: we nudge it, instantly.
 * Only keyboard-driven focus is handled (pointer focus never scrolls).
 */

const MARGIN = 16;
const SKIP = '[data-site-header], [data-menu-panel], .curtain, .cursor';

export function initFocusScroll(): () => void {
  let keyboard = false;
  let raf = 0;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ') keyboard = true;
  };
  const onPointer = () => {
    keyboard = false;
  };

  const headerBottom = () => {
    const header = document.querySelector<HTMLElement>('[data-site-header]');
    if (!header) return 0;
    const r = header.getBoundingClientRect();
    // While it slides away it no longer covers anything that matters.
    return header.hasAttribute('data-hidden') ? 0 : Math.max(0, r.bottom);
  };

  const onFocusIn = (e: FocusEvent) => {
    if (!keyboard) return;
    const el = e.target;
    if (!(el instanceof HTMLElement) || el === document.body || el.id === 'main' || el.closest(SKIP)) return;
    // Programmatic targets (anchor destinations, tabindex=-1) were placed by whoever focused them.
    if (el.getAttribute('tabindex') === '-1') return;
    const lenis = lenisRef.current;
    // 1. Never fight: drop any glide in progress, keep the position the browser chose.
    if (lenis?.isScrolling) {
      lenis.stop();
      lenis.start();
    }
    // 2. Make sure it is clear of the header and the bottom edge (after the native scroll).
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (document.activeElement !== el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const top = headerBottom() + MARGIN;
      const bottom = window.innerHeight - MARGIN;
      let delta = 0;
      if (r.top < top) delta = r.top - top;
      else if (r.bottom > bottom) delta = Math.min(r.bottom - bottom, r.top - top);
      if (Math.abs(delta) < 1) return;
      const l = lenisRef.current;
      if (l) l.scrollTo(l.scroll + delta, { immediate: true, force: true });
      else window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
    });
  };

  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('focusin', onFocusIn);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pointerdown', onPointer, true);
    document.removeEventListener('focusin', onFocusIn);
  };
}
