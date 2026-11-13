'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';
import { belowFold, COMPACT, FULL, scrubbable } from './kit';

const GAP = 0.42; // timeline seconds between two signatures
const LINE = 1; // one signature line

/**
 * Team: the named board members, signed in order.
 *
 * Mouse / trackpad, md+: scrubbed to the list's passage through the viewport,
 * each signature line is drawn left to right in sequence; the role beneath it
 * settles as the pen passes, then the name appears.
 *
 * Touch / small screens: each block signs itself once as it enters (shorter).
 */
function setup({ gsap, root }: MotionKit) {
  const list = root.querySelector<HTMLElement>('[data-sign-list]');
  if (!list) return;
  const blocks = Array.from(list.querySelectorAll<HTMLElement>('[data-sign]'));

  const parts = (b: HTMLElement) => ({
    line: b.querySelector<HTMLElement>('[data-sign-line]'),
    mark: b.querySelector<HTMLElement>('[data-sign-mark]'),
    text: Array.from(b.querySelectorAll<HTMLElement>('[data-sign-text]')),
  });

  const mm = gsap.matchMedia();
  mm.add({ full: FULL, compact: COMPACT }, (ctx) => {
    const full = Boolean(ctx.conditions?.full);

    if (full) {
      if (!scrubbable(list)) return;
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: { trigger: list, start: 'top 85%', end: 'bottom 92%', scrub: 1 },
      });
      blocks.forEach((b, i) => {
        const { line, mark, text } = parts(b);
        const at = i * GAP;
        if (line) tl.fromTo(line, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: LINE }, at);
        if (text.length) tl.fromTo(text, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08 }, at + 0.3);
        if (mark) tl.fromTo(mark, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, at + 0.62);
      });
      return;
    }

    // Compact: per block, once.
    blocks.forEach((b) => {
      if (!belowFold(b)) return;
      const { line, mark, text } = parts(b);
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: b, start: 'top 92%', once: true },
      });
      if (line) tl.fromTo(line, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' }, 0);
      if (text.length) tl.fromTo(text, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06 }, 0.2);
      if (mark) tl.fromTo(mark, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.45);
    });
  });
  return () => mm.revert();
}

export function TeamMotion() {
  useSectionMotion('team', setup);
  return null;
}
