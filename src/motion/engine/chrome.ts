import { gsap } from '../gsap';
import { lenisRef } from '../lenisRef';
import { scrollState } from '@/scene/scrollState';

/**
 * Header behaviour + reading progress.
 *
 * The header stays a solid black bar. It slides away while reading downwards
 * and returns on any upward scroll, near the top, while it (or the mobile menu)
 * holds focus, so keyboard users are never stranded. The red hairline under it
 * tracks whole-page progress (and stays visible at the top edge when the header
 * is away).
 */
export function initChrome(): () => void {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return () => {};
  const bar = header.querySelector<HTMLElement>('[data-progress]');

  let hidden = false;
  let lastY = lenisRef.current?.scroll ?? window.scrollY;
  let travel = 0;
  let lastP = -1;
  let headerH = header.offsetHeight;
  const onResize = () => {
    headerH = header.offsetHeight;
  };
  window.addEventListener('resize', onResize, { passive: true });

  const set = (v: boolean) => {
    if (v === hidden) return;
    hidden = v;
    header.toggleAttribute('data-hidden', v);
  };

  const pinnedOpen = () =>
    header.contains(document.activeElement) ||
    document.documentElement.hasAttribute('data-menu-open') ||
    document.documentElement.classList.contains('nav-pending');

  const tick = () => {
    const y = lenisRef.current?.scroll ?? window.scrollY;
    const dy = y - lastY;
    lastY = y;
    if (dy !== 0) {
      // Accumulate travel in one direction so tiny jitters do not toggle it.
      travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      if (y < headerH * 1.5 || pinnedOpen()) set(false);
      else if (travel > 48) set(true);
      else if (travel < -24) set(false);
    }
    const p = scrollState.progress;
    if (bar && Math.abs(p - lastP) > 0.0004) {
      lastP = p;
      bar.style.transform = `scaleX(${p})`;
    }
  };

  const onFocusIn = () => set(false);
  header.addEventListener('focusin', onFocusIn);
  gsap.ticker.add(tick);

  return () => {
    gsap.ticker.remove(tick);
    window.removeEventListener('resize', onResize);
    header.removeEventListener('focusin', onFocusIn);
    header.removeAttribute('data-hidden');
    if (bar) bar.style.transform = '';
  };
}
