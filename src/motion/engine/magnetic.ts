import { gsap } from '../gsap';

/**
 * Magnetic hover for `[data-magnetic]` (fine pointers only). The element leans
 * a few pixels toward the pointer and settles back with a long power4 ease.
 * Event delegation, so it works for elements added by later routes.
 */

type Movers = { x: gsap.QuickToFunc; y: gsap.QuickToFunc };

const STRENGTH = 0.32;
const MAX = 14;

export function initMagnetic(): () => void {
  const movers = new WeakMap<HTMLElement, Movers>();
  let active: HTMLElement | null = null;
  let center = { x: 0, y: 0 };

  const moversFor = (el: HTMLElement) => {
    let m = movers.get(el);
    if (!m) {
      m = {
        x: gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power4.out' }),
        y: gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power4.out' }),
      };
      movers.set(el, m);
    }
    return m;
  };

  const release = (el: HTMLElement | null) => {
    if (!el) return;
    const m = movers.get(el);
    m?.x(0);
    m?.y(0);
  };

  const measure = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    // Subtract the current magnetic offset so the rest position is the reference.
    const ox = Number(gsap.getProperty(el, 'x')) || 0;
    const oy = Number(gsap.getProperty(el, 'y')) || 0;
    center = { x: r.left - ox + r.width / 2, y: r.top - oy + r.height / 2 };
  };

  const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, v));

  const onOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const el = (e.target as Element).closest<HTMLElement>('[data-magnetic]');
    if (el === active) return;
    release(active);
    active = el;
    if (el) measure(el);
  };

  const onMove = (e: PointerEvent) => {
    if (!active || e.pointerType === 'touch') return;
    const m = moversFor(active);
    m.x(clamp((e.clientX - center.x) * STRENGTH));
    m.y(clamp((e.clientY - center.y) * STRENGTH));
  };

  const onScroll = () => {
    if (active) {
      release(active);
      active = null;
    }
  };

  document.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    document.removeEventListener('pointerover', onOver);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', onScroll);
    release(active);
    active = null;
  };
}
