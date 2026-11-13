'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';
import { belowFold, COMPACT, FULL, maskText, moment, onFocusWithin, scrubbable, visualCopy } from './kit';

type Side = 'top' | 'bottom';

/** A 1px rule laid exactly over a border edge, drawn with scaleX. */
function hairline(row: HTMLElement, side: Side, color: string) {
  const s = document.createElement('span');
  s.setAttribute('aria-hidden', 'true');
  s.style.cssText = `position:absolute;left:0;right:0;${side}:-1px;height:1px;background:${color};pointer-events:none`;
  row.append(s);
  return s;
}

/**
 * /partners. The hero headline rises line by line with a shear on load (the
 * global reveal, `data-reveal-variant="shear"`). Then:
 *
 * - The tier ledger is ruled row by row: as each tier row enters, the
 *   hairline above it is drawn left to right over the space where the border
 *   sits (the real border is hidden meanwhile, then restored and the drawn rule
 *   removed), and the row's three columns settle in after the pen. The last
 *   row also rules its own foot. Keyboard focus inside a pending row finishes it.
 * - The giant address (Contact) is set character by character from masks, scrubbed
 *   to scroll on mouse / trackpad (md+), played once on touch. The link's
 *   accessible name comes from an sr-only copy; break opportunities are kept
 *   after every character so it still wraps anywhere at 320px.
 */
function setup({ gsap, ScrollTrigger, root }: MotionKit) {
  const ledger = root.querySelector<HTMLElement>('[data-ledger]');
  const cta = root.querySelector<HTMLElement>('[data-cta-text]');
  const link = cta?.closest<HTMLElement>('a') ?? null;

  const mm = gsap.matchMedia();
  mm.add({ full: FULL, compact: COMPACT }, moment((ctx: gsap.Context, undo) => {
    const full = Boolean(ctx.conditions?.full);

    if (ledger) {
      const rows = Array.from(ledger.children) as HTMLElement[];
      const pending = rows.map((r) => belowFold(r));
      const timelines = new Map<HTMLElement, gsap.core.Timeline>();

      rows.forEach((row, i) => {
        if (!pending[i]) return;
        const cols = Array.from(row.children) as HTMLElement[];
        const drawn: HTMLElement[] = [];
        const restores: (() => void)[] = [];
        gsap.set(row, { position: 'relative' });

        const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
        const cleanup = () => {
          drawn.forEach((s) => s.remove());
          drawn.length = 0;
          restores.forEach((r) => r());
          restores.length = 0;
        };
        tl.eventCallback('onComplete', cleanup);
        undo.push(cleanup);

        // The rule above this row is the list's top border, or the previous row's bottom border.
        // Only draw it if that row is pending too (otherwise it is already on screen).
        const owner = i === 0 ? ledger : pending[i - 1] ? rows[i - 1] : null;
        if (owner) {
          const prop = i === 0 ? 'borderTopColor' : 'borderBottomColor';
          const color = getComputedStyle(owner)[prop];
          gsap.set(owner, { [prop]: 'transparent' });
          restores.push(() => gsap.set(owner, { clearProps: prop }));
          const line = hairline(row, 'top', color);
          drawn.push(line);
          tl.fromTo(line, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1.5, ease: 'power3.inOut' }, 0);
        }
        if (i === rows.length - 1) {
          const color = getComputedStyle(row).borderBottomColor;
          gsap.set(row, { borderBottomColor: 'transparent' });
          restores.push(() => gsap.set(row, { clearProps: 'borderBottomColor' }));
          const foot = hairline(row, 'bottom', color);
          drawn.push(foot);
          tl.fromTo(foot, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1.5, ease: 'power3.inOut' }, 0.55);
        }
        tl.fromTo(cols, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1.3, stagger: 0.1 }, 0.3);
        if (!full) tl.timeScale(1.4);
        timelines.set(row, tl);
        ScrollTrigger.create({ trigger: row, start: 'top 86%', once: true, onEnter: () => void tl.play() });
      });

      if (timelines.size) {
        undo.push(
          onFocusWithin(ledger, (target) => {
            const row = rows.find((r) => r.contains(target));
            const tl = row ? timelines.get(row) : undefined;
            if (tl && tl.progress() < 1) tl.progress(1);
          }),
        );
      }
    }

    if (cta && link && (full ? scrubbable(link) : belowFold(link))) {
      const copy = visualCopy(cta);
      const m = maskText(copy.visual, { wbr: true });
      let reverted = false;
      const revert = () => {
        if (reverted) return;
        reverted = true;
        m.revert();
        copy.revert();
      };
      undo.push(revert);
      // Deeper mask at the foot: leading-none would clip descenders.
      gsap.set(link, { '--mo-bottom': '-0.3em' });
      const chars = m.pieces.map((p) => p.inner);
      const tween = full
        ? gsap.fromTo(
            chars,
            { yPercent: 135 },
            {
              yPercent: 0,
              duration: 0.7,
              ease: 'power3.out',
              stagger: 0.06,
              scrollTrigger: { trigger: link, start: 'top 94%', end: 'top 52%', scrub: 0.8 },
            },
          )
        : gsap.fromTo(
            chars,
            { yPercent: 135 },
            {
              yPercent: 0,
              duration: 1,
              ease: 'expo.out',
              stagger: 0.025,
              scrollTrigger: { trigger: link, start: 'top 90%', once: true },
              onComplete: revert,
            },
          );
      undo.push(
        onFocusWithin(link, () => {
          if (reverted) return;
          tween.scrollTrigger?.kill(false, true);
          tween.progress(1);
        }),
      );
    }

  }));
  return () => mm.revert();
}

export function PartnersMotion() {
  useSectionMotion('prospectus', setup);
  return null;
}
