'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';
import { belowFold, COMPACT, FULL, maskText, scrubbable } from './kit';

/** A counter wheel: 0-9 and a second 0, so 9 -> 0 rolls forward. */
const WHEEL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const STEP = 0.05; // timeline seconds between two ticks

/**
 * § 05 · The room as a ruler.
 *
 * - The seat ruler (one tick per seat; `data-seats` carries settings.capacity)
 *   prints tick by tick from its baseline, every tenth tick's number settling
 *   with it, scrubbed to scroll (mouse / trackpad, md+).
 * - The big "001 – 100" counts the seats as they are drawn: the right-hand
 *   number becomes a mechanical counter (one wheel per digit, units rolling
 *   continuously, tens and hundreds turning only on the carry), from 001 to
 *   the capacity. Tabular figures and a ghost glyph per wheel keep every
 *   width exact.
 *   The numerals are aria-hidden; clause 5.1 and the heading carry the capacity.
 *   This is the section's one moment (no stamp on the status register: the
 *   status is read, not performed).
 *
 * Touch / small screens: the same timeline, played once in 1.6s when the ruler
 * enters. Nothing is hidden unless it is still below the fold at setup.
 */
function setup({ gsap, ScrollTrigger, root }: MotionKit) {
  const ruler = root.querySelector<HTMLElement>('[data-seat-ruler]');
  const count = root.querySelector<HTMLElement>('[data-seat-count]');
  const dash = root.querySelector<HTMLElement>('[data-seat-dash]');
  const cells = ruler ? (Array.from(ruler.children) as HTMLElement[]) : [];
  // One cell per seat; the server writes the count on the ruler.
  const seats = Number(ruler?.dataset.seats) || cells.length;

  const mm = gsap.matchMedia();
  mm.add({ full: FULL, compact: COMPACT }, (ctx) => {
    const full = Boolean(ctx.conditions?.full);
    const undo: (() => void)[] = [];

    if (ruler && seats > 1 && cells.length === seats && (full ? scrubbable(ruler) : belowFold(ruler))) {
      // The counter: one wheel per glyph of the printed count ("100" -> three).
      let wheels: HTMLElement[] = [];
      if (count && /^\d+$/.test(count.textContent ?? '')) {
        const m = maskText(count, { strip: () => WHEEL });
        wheels = m.pieces.map((p) => p.inner);
        undo.push(m.revert);
      }
      let last = -1;
      const setCount = (v: number) => {
        if (Math.abs(v - last) < 0.002) return;
        last = v;
        // Detents: each step rests on its figure for most of its travel and turns over
        // quickly (smoothstep on the last 45%), so a paused scroll never shows half a digit.
        const whole = Math.floor(v);
        const f = Math.min(1, Math.max(0, (v - whole - 0.55) / 0.45));
        const step = f * f * (3 - 2 * f);
        const n = wheels.length;
        for (let j = 0; j < n; j++) {
          const place = 10 ** (n - 1 - j);
          // A higher wheel turns only while every wheel below it rolls 9 -> 0 (the carry).
          const pos = (Math.floor(whole / place) % 10) + (whole % place === place - 1 ? step : 0);
          wheels[j].style.transform = `translate3d(0, ${(-pos * 100) / WHEEL.length}%, 0)`;
        }
      };

      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: 'power3.out' },
        // The count lands on the capacity just before the last tick finishes printing.
        onUpdate: () => setCount(1 + (seats - 1) * Math.min(1, tl.progress() / 0.94)),
      });
      if (dash) tl.fromTo(dash, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1.4, ease: 'power3.inOut' }, 0);
      cells.forEach((cell, i) => {
        const tick = cell.querySelector<HTMLElement>('[data-seat-tick]');
        const label = cell.querySelector<HTMLElement>('[data-seat-label]');
        const at = i * STEP;
        if (tick) tl.fromTo(tick, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.7 }, at);
        if (label) tl.fromTo(label, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.8 }, at + 0.15);
      });
      tl.progress(0);
      setCount(1);

      if (full) {
        ScrollTrigger.create({ trigger: ruler, start: 'top 92%', end: 'top 40%', scrub: 0.9, animation: tl });
      } else {
        ScrollTrigger.create({
          trigger: ruler,
          start: 'top 88%',
          once: true,
          onEnter: () => void gsap.to(tl, { progress: 1, duration: 1.6, ease: 'power2.inOut' }),
        });
      }
    }

    return () => undo.forEach((u) => u());
  });
  return () => mm.revert();
}

export function TicketsMotion() {
  useSectionMotion('tickets', setup);
  return null;
}
