'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';

/**
 * Hero scroll-out: as the hero leaves, the headline scales down a touch, its
 * letters track apart (per-character x, transform only) and it fades while the
 * 3D microphone takes the frame. The intro itself is CSS (globals.css).
 */
function setup({ gsap, root }: MotionKit) {
  const title = root.querySelector<HTMLElement>('[data-hero-title]');
  const chars = Array.from(root.querySelectorAll<HTMLElement>('[data-hero-char]'));
  const body = root.querySelector<HTMLElement>('[data-hero-body]');
  if (!title) return;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 0.6 },
  });
  tl.to(title, { scale: 0.9, yPercent: -18, opacity: 0, ease: 'power1.in' }, 0);
  tl.to(chars, { x: (_i: number, el: HTMLElement) => Number(el.dataset.heroChar) * 9 }, 0);
  if (body) tl.to(body, { y: -70, opacity: 0, ease: 'power1.in' }, 0);
}

export function HeroMotion() {
  useSectionMotion('hero', setup);
  return null;
}
