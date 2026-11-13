'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';
import { belowFold, COMPACT, FULL, maskText, visualCopy } from './kit';

/** Ten glyphs ending on the target: the wheel rolls forward one full turn and locks. */
const rollTo = (ch: string) => {
  const d = Number(ch);
  return Array.from({ length: 10 }, (_, k) => String((d + k + 1) % 10));
};

/**
 * § 04 · The coordinate plate, registered like a proof.
 *
 * Once, as the plate enters: the four crop marks draw out from their corners,
 * the plate's contents settle, the reticle turns into register, and the
 * coordinates resolve digit by digit, left to right, each wheel rolling one turn
 * and locking on its figure (an aria-hidden copy; screen readers get the
 * coordinates as text throughout, and the original text is restored after).
 * Mouse / trackpad, md+: the reticle's degree bezel then turns a few degrees
 * against the fixed crosshair as the section scrolls past.
 */
function setup({ gsap, ScrollTrigger, root }: MotionKit) {
  const plate = root.querySelector<HTMLElement>('[data-venue-plate]');
  if (!plate) return;
  const corners = Array.from(plate.querySelectorAll<HTMLElement>('[data-crop]'));
  const parts = Array.from(plate.querySelectorAll<HTMLElement>(':scope > :not([data-crop-marks])'));
  const reticle = plate.querySelector<SVGElement>('[data-reticle]');
  const bezel = plate.querySelector<SVGGElement>('[data-reticle-bezel]');
  const coords = Array.from(plate.querySelectorAll<HTMLElement>('[data-venue-coord]'));

  const mm = gsap.matchMedia();
  mm.add({ full: FULL, compact: COMPACT }, (ctx) => {
    const full = Boolean(ctx.conditions?.full);
    const undo: (() => void)[] = [];

    if (belowFold(plate)) {
      const strips: HTMLElement[] = [];
      for (const el of coords) {
        const copy = visualCopy(el);
        const m = maskText(copy.visual, { only: /\d/, strip: rollTo });
        strips.push(...m.pieces.map((p) => p.inner));
        undo.push(m.revert, copy.revert);
      }
      const restore = () => {
        // Put the plain text back once every wheel has locked.
        while (undo.length) undo.shift()?.();
      };

      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: 'expo.out' },
        onComplete: restore,
      });
      corners.forEach((c, i) => {
        tl.fromTo(
          c,
          { scale: 0, transformOrigin: c.dataset.crop ?? '50% 50%' },
          { scale: 1, duration: 1.1, ease: 'power3.inOut' },
          i * 0.07,
        );
      });
      tl.fromTo(parts, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.3, stagger: 0.12 }, 0.35);
      if (reticle) {
        tl.fromTo(
          reticle,
          { rotation: -28, scale: 0.9, transformOrigin: '50% 50%' },
          { rotation: 0, scale: 1, duration: 2, ease: 'expo.out' },
          0.45,
        );
      }
      if (strips.length) {
        tl.fromTo(
          strips,
          { yPercent: 0 },
          { yPercent: -90, duration: 1.5, ease: 'expo.out', stagger: 0.055 },
          0.7,
        );
      }
      if (!full) tl.timeScale(1.5);

      ScrollTrigger.create({ trigger: plate, start: 'top 82%', once: true, onEnter: () => void tl.play() });
    }

    if (full && bezel) {
      gsap.fromTo(
        bezel,
        { rotation: -9, svgOrigin: '160 160' },
        {
          rotation: 9,
          svgOrigin: '160 160',
          ease: 'none',
          scrollTrigger: { trigger: plate, start: 'top bottom', end: 'bottom top', scrub: 1.2 },
        },
      );
    }

    return () => undo.forEach((u) => u());
  });
  return () => mm.revert();
}

export function VenueMotion() {
  useSectionMotion('venue', setup);
  return null;
}
