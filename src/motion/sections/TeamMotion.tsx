'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';
import { belowFold, COMPACT, FULL, moment, pad2, scrubbable } from './kit';

const GAP = 0.42; // timeline seconds between two signatures
const LINE = 1; // one signature line

/**
 * § 06 · The undersigned, signed in order.
 *
 * Mouse / trackpad, md+: scrubbed to the list's passage through the viewport,
 * each signature line is drawn left to right in sequence (6.1, 6.2, ...); the
 * role typed beneath it settles as the pen passes, then the signature space
 * (the cross, or the name) appears. The "00 of 09 signed" register above ticks
 * with the drawing: the total counts the signature spaces as their lines are
 * drawn, the first figure counts the ones that carry a name. It is an
 * aria-hidden copy; screen readers read the final count from an sr-only twin.
 *
 * Touch / small screens: each block signs itself once as it enters (shorter),
 * and the register ticks up once when it comes into view.
 */
function setup({ gsap, root }: MotionKit) {
  const list = root.querySelector<HTMLElement>('[data-sign-list]');
  const counter = root.querySelector<HTMLElement>('[data-sign-count]');
  if (!list) return;
  const blocks = Array.from(list.querySelectorAll<HTMLElement>('[data-sign]'));
  const signed = blocks.map((b) => b.hasAttribute('data-signed'));
  const finalText = counter?.textContent ?? '';
  const total = blocks.length;

  const parts = (b: HTMLElement) => ({
    line: b.querySelector<HTMLElement>('[data-sign-line]'),
    mark: b.querySelector<HTMLElement>('[data-sign-mark]'),
    text: Array.from(b.querySelectorAll<HTMLElement>('[data-sign-text]')),
  });

  let shown = '';
  const show = (drawn: number) => {
    if (!counter) return;
    let names = 0;
    for (let i = 0; i < drawn; i++) if (signed[i]) names++;
    const text = `${pad2(names)} of ${pad2(drawn)} signed`;
    if (text !== shown) counter.textContent = shown = text;
  };
  const restoreCounter = () => {
    if (counter) counter.textContent = finalText;
    shown = '';
  };

  const mm = gsap.matchMedia();
  mm.add({ full: FULL, compact: COMPACT }, moment((ctx: gsap.Context, undo) => {
    const full = Boolean(ctx.conditions?.full);
    undo.push(restoreCounter);

    if (full) {
      if (!scrubbable(list)) return;
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onUpdate: () => {
          const t = tl.time();
          let drawn = 0;
          for (let i = 0; i < total; i++) if (t >= i * GAP + LINE * 0.92) drawn = i + 1;
          show(drawn);
        },
        scrollTrigger: { trigger: list, start: 'top 85%', end: 'bottom 92%', scrub: 1 },
      });
      blocks.forEach((b, i) => {
        const { line, mark, text } = parts(b);
        const at = i * GAP;
        if (line) tl.fromTo(line, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: LINE }, at);
        if (text.length) tl.fromTo(text, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08 }, at + 0.3);
        if (mark) tl.fromTo(mark, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, at + 0.62);
      });
      show(0);
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
    if (counter && belowFold(counter)) {
      const tick = { n: 0 };
      show(0);
      gsap.to(tick, {
        n: total,
        duration: 0.9,
        ease: 'power1.inOut',
        onUpdate: () => show(Math.round(tick.n)),
        onComplete: restoreCounter,
        scrollTrigger: { trigger: counter, start: 'top 90%', once: true },
      });
    }
  }));
  return () => mm.revert();
}

export function TeamMotion() {
  useSectionMotion('team', setup);
  return null;
}
