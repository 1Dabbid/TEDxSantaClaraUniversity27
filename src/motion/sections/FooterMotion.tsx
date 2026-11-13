'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';
import { belowFold, COMPACT, FULL, maskText, scrubbable } from './kit';

/**
 * The sign-off date. The footer lives in the root layout, so this runs on every
 * route and survives navigations (the engine refreshes triggers per route).
 *
 * Once, as the date enters: the six figures rise out of their own masks, left
 * to right, then the two red points are set last, like the full stops of a
 * signature. The date is aria-hidden (the <time> below carries it); the masks
 * are removed again when it lands.
 * Mouse / trackpad, md+: as the page bottoms out the date travels a little
 * faster than the page and settles into place on the last pixel of scroll.
 */
function setup({ gsap, ScrollTrigger, root }: MotionKit) {
  const date = root.querySelector<HTMLElement>('[data-footer-date]');
  if (!date) return;
  const dots = Array.from(date.querySelectorAll<HTMLElement>('[data-footer-dot]'));

  const mm = gsap.matchMedia();
  mm.add({ full: FULL, compact: COMPACT }, (ctx) => {
    const full = Boolean(ctx.conditions?.full);
    let undo: (() => void) | null = null;

    if (belowFold(date)) {
      const m = maskText(date, { only: /\d/ });
      undo = m.revert;
      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: 'expo.out' },
        onComplete: () => {
          undo?.();
          undo = null;
          gsap.set(dots, { clearProps: 'transform,display' });
        },
      });
      tl.fromTo(
        m.pieces.map((p) => p.inner),
        { yPercent: 100 },
        { yPercent: 0, duration: 1.5, stagger: 0.075 },
        0,
      );
      tl.fromTo(
        dots,
        { display: 'inline-block', scale: 0, transformOrigin: '50% 85%' },
        { scale: 1, duration: 0.7, ease: 'power3.out', stagger: 0.14 },
        0.85,
      );
      if (!full) tl.timeScale(1.35);
      ScrollTrigger.create({ trigger: date, start: 'top 90%', once: true, onEnter: () => void tl.play() });
    }

    if (full && scrubbable(date)) {
      gsap.fromTo(
        date,
        { y: () => -Math.min(56, window.innerWidth * 0.035) },
        {
          y: 0,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true },
        },
      );
    }

    return () => undo?.();
  });
  return () => mm.revert();
}

export function FooterMotion() {
  useSectionMotion('site-footer', setup);
  return null;
}
