'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';

/**
 * § 07 · The FAQ's open/close is pure CSS (globals.css: `::details-content` with
 * `interpolate-size`, plus/minus morph), so native <details> works the same
 * without JS. This only keeps scroll-linked moments further down the page
 * (Newsletter, Footer) measured: a clause opening or closing changes the page
 * height, so triggers are refreshed once the height transition has settled.
 */
function setup({ ScrollTrigger, root }: MotionKit) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onToggle = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ScrollTrigger.refresh(), 760);
  };
  // `toggle` does not bubble: listen in the capture phase.
  root.addEventListener('toggle', onToggle, true);
  return () => {
    clearTimeout(timer);
    root.removeEventListener('toggle', onToggle, true);
  };
}

export function FaqMotion() {
  useSectionMotion('faq', setup);
  return null;
}
