'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';
import { belowFold, COMPACT, FULL, scrubbable } from './kit';

/**
 * § 08 · The closing signature.
 *
 * Mouse / trackpad, md+: the signature line inks across, left to right, tied to
 * scroll, finishing exactly as it reaches the middle of the viewport. The
 * headline comes up to full size as it enters (a 9% scale from its bottom-left
 * corner, scrubbed), so the last statement on the page arrives with weight.
 *
 * Touch / small screens: the line draws once as it enters; no scaling.
 */
function setup({ gsap, root }: MotionKit) {
  const rule = root.querySelector<HTMLElement>('[data-sign-rule]');
  const title = root.querySelector<HTMLElement>('#newsletter-title');

  const mm = gsap.matchMedia();
  mm.add({ full: FULL, compact: COMPACT }, (ctx) => {
    const full = Boolean(ctx.conditions?.full);

    if (rule) {
      if (full && scrubbable(rule)) {
        gsap.fromTo(
          rule,
          { scaleX: 0, transformOrigin: '0% 50%' },
          {
            scaleX: 1,
            ease: 'power1.inOut',
            scrollTrigger: { trigger: rule, start: 'top 96%', end: 'top 50%', scrub: 1 },
          },
        );
      } else if (!full && belowFold(rule)) {
        gsap.fromTo(
          rule,
          { scaleX: 0, transformOrigin: '0% 50%' },
          {
            scaleX: 1,
            duration: 1.3,
            ease: 'power3.inOut',
            scrollTrigger: { trigger: rule, start: 'top 90%', once: true },
          },
        );
      }
    }

    if (full && title && scrubbable(title)) {
      gsap.fromTo(
        title,
        { scale: 0.91, transformOrigin: '0% 100%' },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: title, start: 'top bottom', end: 'bottom 45%', scrub: 1.2 },
        },
      );
    }
  });
  return () => mm.revert();
}

export function NewsletterMotion() {
  useSectionMotion('newsletter', setup);
  return null;
}
