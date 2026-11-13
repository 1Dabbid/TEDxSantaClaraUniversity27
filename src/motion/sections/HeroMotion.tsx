'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';

/**
 * Hero scroll-out: as the hero leaves, the headline scales down a touch, its
 * words drift apart (x per word, transform only, so each word keeps its kerning)
 * and it fades while the 3D microphone takes the frame. Phones get a shorter,
 * lighter version (no drift: the words are stacked; the body below the fold
 * stays put). The intro is CSS.
 */
function setup({ gsap, root }: MotionKit) {
  const title = root.querySelector<HTMLElement>('[data-hero-title]');
  const words = Array.from(root.querySelectorAll<HTMLElement>('[data-hero-word]'));
  const body = root.querySelector<HTMLElement>('[data-hero-body]');
  if (!title) return;

  const mm = gsap.matchMedia();
  mm.add({ phone: '(max-width: 639.98px)', wide: '(min-width: 640px)' }, (ctx) => {
    const phone = Boolean(ctx.conditions?.phone);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: root, start: 'top top', end: phone ? '70% top' : 'bottom top', scrub: phone ? true : 0.6, invalidateOnRefresh: true },
    });
    tl.to(title, { scale: phone ? 0.94 : 0.9, yPercent: phone ? -10 : -18, opacity: 0, ease: 'power1.in' }, 0);
    if (!phone) tl.to(words, { x: (_i: number, el: HTMLElement) => Number(el.dataset.heroWord) * 0.06 * window.innerWidth }, 0);
    // On phones the body is still being read while the title leaves: leave it alone.
    if (body && !phone) tl.to(body, { y: -70, opacity: 0, ease: 'power1.in' }, 0);
  });
  return () => mm.revert();
}

export function HeroMotion() {
  useSectionMotion('hero', setup);
  return null;
}
