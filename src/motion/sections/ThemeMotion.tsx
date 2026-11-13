'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';

const SUB = ['a', 'b', 'c'];

/**
 * The signature moment.
 *
 * md+: the section is a 250vh runway with a sticky stage (CSS, globals.css), so it
 * works with Lenis and needs no pin spacer. One scrubbed timeline maps the runway:
 *   1. the heading lifts away and a scrim settles in over the 3D push-in,
 *   2. each phrase of the definitions clause lights up in the 9px contract text,
 *      then a full-size copy grows out of that exact spot (FLIP: translate+scale
 *      from the small phrase's rect, transform only) until it fills the width,
 *   3. earlier phrases dim while the next one grows; at the end all settle at
 *      full strength and the small print returns,
 *   4. a clause counter ticks: § 1.0 → § 1.4(a) → (b) → (c).
 * Measurements are functions re-evaluated on every ScrollTrigger refresh.
 *
 * Mobile: natural height, lines rise from masks as they enter.
 */
function setup({ gsap, ScrollTrigger, root }: MotionKit) {
  const stage = root.querySelector<HTMLElement>('[data-theme-stage]');
  const titleWrap = root.querySelector<HTMLElement>('[data-theme-title-wrap]');
  const title = titleWrap?.querySelector<HTMLElement>('h2') ?? null;
  const stack = root.querySelector<HTMLElement>('[data-theme-stack]');
  const fine = root.querySelector<HTMLElement>('[data-theme-fine]');
  const fineList = fine?.querySelector<HTMLElement>('ol') ?? null;
  const foot = root.querySelector<HTMLElement>('[data-theme-foot]');
  const scrim = root.querySelector<HTMLElement>('[data-theme-scrim]');
  const clauseEl = root.querySelector<HTMLElement>('[data-theme-clause]');
  const stepEl = root.querySelector<HTMLElement>('[data-theme-step]');
  const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-theme-line]'));
  const inners = Array.from(root.querySelectorAll<HTMLElement>('[data-theme-line-inner]'));
  const phrases = Array.from(root.querySelectorAll<HTMLElement>('[data-theme-phrase]'));
  if (!stage || !titleWrap || !stack || !fine || lines.length === 0 || phrases.length !== lines.length) return;
  const defIndex = stage.dataset.defIndex ?? '4';
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#eb0028';

  const mm = gsap.matchMedia();

  mm.add('(min-width: 768px)', () => {
    // Fit the longest phrase to the stage width (and the three lines to its height).
    const fit = () => {
      stack.style.removeProperty('--theme-fs');
      const fs = parseFloat(getComputedStyle(inners[0]).fontSize) || 100;
      const widest = Math.max(...inners.map((el) => el.offsetWidth)) || 1;
      const byWidth = (fs * stack.clientWidth) / widest;
      const byHeight = (stage.clientHeight * 0.58) / (lines.length * 0.95);
      stack.style.setProperty('--theme-fs', `${Math.floor(Math.min(byWidth * 0.98, byHeight))}px`);
    };
    fit();
    ScrollTrigger.addEventListener('refreshInit', fit);

    const flip = (i: number) => {
      const a = phrases[i].getClientRects()[0] ?? phrases[i].getBoundingClientRect();
      const b = lines[i].getBoundingClientRect();
      const fsA = parseFloat(getComputedStyle(phrases[i]).fontSize) || 9;
      const fsB = parseFloat(getComputedStyle(inners[i]).fontSize) || 100;
      return { x: a.left - b.left, y: a.top - b.top, s: fsA / fsB };
    };

    const n = lines.length;
    const t0 = 0.14;
    const span = 0.72 / n;
    const grow = span * 0.9;
    let step = -1;

    const setStep = (k: number) => {
      if (k === step) return;
      step = k;
      if (clauseEl) clauseEl.textContent = k === 0 ? '1.0' : `1.${defIndex}(${SUB[k - 1] ?? k})`;
      if (stepEl) stepEl.textContent = String(k).padStart(2, '0');
    };
    setStep(0);

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        invalidateOnRefresh: true,
      },
      onUpdate: () => {
        const t = tl.time();
        let k = 0;
        for (let i = 0; i < n; i++) if (t >= t0 + i * span + grow * 0.35) k = i + 1;
        setStep(k);
      },
    });

    tl.to(titleWrap, { opacity: 0, y: -48, duration: 0.12, ease: 'power2.in' }, 0.02);
    if (scrim) tl.to(scrim, { opacity: 1, duration: 0.2 }, 0.04);

    inners.forEach((inner, i) => {
      const at = t0 + i * span;
      tl.to(phrases[i], { color: '#fff', duration: 0.03 }, at - 0.04);
      tl.fromTo(
        inner,
        { x: () => flip(i).x, y: () => flip(i).y, scale: () => flip(i).s },
        { x: 0, y: 0, scale: 1, duration: grow, ease: 'power3.inOut', immediateRender: true },
        at,
      );
      // Opacity arrives early in the growth so the copy reads as emerging from the small type.
      tl.fromTo(inner, { opacity: 0 }, { opacity: 1, duration: grow * 0.14, immediateRender: true }, at);
      tl.to(phrases[i], { color: accent, duration: 0.03 }, at + grow * 0.5);
      if (i > 0) tl.to(lines.slice(0, i), { opacity: 0.22, duration: grow * 0.6, ease: 'power1.inOut' }, at);
      if (i === 0) tl.to(fineList ?? fine, { opacity: 0.35, duration: grow * 0.6 }, at + grow * 0.4);
    });

    // Settle: everything at full strength, the small print returns.
    const end = t0 + n * span;
    tl.to(lines, { opacity: 1, duration: 0.08, ease: 'power2.out' }, end);
    tl.to(fineList ?? fine, { opacity: 0.8, duration: 0.08 }, end);
    if (foot) tl.fromTo(foot, { opacity: 0 }, { opacity: 1, duration: 0.06, immediateRender: true }, end + 0.02);
    tl.to({}, { duration: 0.001 }, 1);

    // Entrance before the stage sticks.
    if (title) {
      gsap.from(title, {
        yPercent: 40,
        opacity: 0,
        duration: 1.4,
        ease: 'expo.out',
        scrollTrigger: { trigger: root, start: 'top 75%', once: true },
      });
    }

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', fit);
      stack.style.removeProperty('--theme-fs');
    };
  });

  mm.add('(max-width: 767.98px)', () => {
    if (title) {
      gsap.from(title, {
        yPercent: 30,
        opacity: 0,
        duration: 1.3,
        ease: 'expo.out',
        scrollTrigger: { trigger: title, start: 'top 88%', once: true },
      });
    }
    inners.forEach((inner, i) => {
      gsap.from(inner, {
        yPercent: 112,
        duration: 1.3,
        delay: i * 0.08,
        ease: 'expo.out',
        scrollTrigger: { trigger: stack, start: 'top 85%', once: true },
      });
    });
    gsap.from(fine, {
      opacity: 0,
      y: 24,
      duration: 1.2,
      ease: 'expo.out',
      scrollTrigger: { trigger: fine, start: 'top 90%', once: true },
    });
  });

  return () => mm.revert();
}

export function ThemeMotion() {
  useSectionMotion('theme', setup);
  return null;
}
