'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';

const SUB = ['a', 'b', 'c'];

/** Keep in sync with the pinned / not pinned media blocks in globals.css. Short
 *  viewports (e.g. 200% zoom) get the simple reveal: the stage would not fit. */
const PINNED = '(min-width: 768px) and (min-height: 44rem)';
const UNPINNED = '(max-width: 767.98px), (max-height: 43.99rem)';

/** Content-area rect of an element's text (independent of line-height, so two
 *  copies in the same font compare exactly: the ratio of their font sizes). */
function textRect(el: HTMLElement): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getClientRects()[0] ?? range.getBoundingClientRect();
}

/**
 * The signature moment.
 *
 * md+: the section is a tall runway with a sticky stage (CSS, globals.css), so it
 * works with Lenis and needs no pin spacer. One scrubbed timeline maps the runway:
 *   1. the heading lifts away and a scrim settles in over the 3D push-in,
 *   2. each phrase of the definitions clause lights up in the 9px contract text
 *      (a defined term, set in the sans), then lifts off: a take-off copy in the
 *      same family, weight, tracking and text is laid exactly over it (FLIP from
 *      the measured text rects: same left, same top, scale = size ratio, so the
 *      baselines coincide) and the small phrase hands over in the same frame.
 *      It grows until it fills the width and on the way settles into display
 *      weight and tight tracking (opacity crossfade to the display copy, done
 *      while it is still small, so no double image is visible at full size),
 *   3. earlier phrases dim while the next one grows; at the end all settle at
 *      full strength and the small print returns, its terms marked in accent,
 *   4. a clause counter ticks: § 1.0 → § 1.4(a) → (b) → (c).
 * Measurements are functions re-evaluated on every ScrollTrigger refresh.
 *
 * Mobile: natural height, lines rise from masks as they enter (short, snappy).
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
  const texts = Array.from(root.querySelectorAll<HTMLElement>('[data-theme-text]'));
  const ghosts = Array.from(root.querySelectorAll<HTMLElement>('[data-theme-ghost]'));
  const phrases = Array.from(root.querySelectorAll<HTMLElement>('[data-theme-phrase]'));
  const n = lines.length;
  if (!stage || !titleWrap || !stack || !fine || n === 0) return;
  if (phrases.length !== n || ghosts.length !== n || texts.length !== n) return;
  const defIndex = stage.dataset.defIndex ?? '4';
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#eb0028';

  const mm = gsap.matchMedia();

  mm.add(PINNED, () => {
    // Fit the longest phrase to the stage width (and the three lines to its height).
    const fit = () => {
      stack.style.removeProperty('--theme-fs');
      const fs = parseFloat(getComputedStyle(inners[0]).fontSize) || 100;
      const widest = Math.max(...texts.map((el) => el.offsetWidth)) || 1;
      const byWidth = (fs * stack.clientWidth) / widest;
      const byHeight = (stage.clientHeight * 0.58) / (n * 0.95);
      stack.style.setProperty('--theme-fs', `${Math.floor(Math.min(byWidth * 0.98, byHeight))}px`);
    };
    // Untransformed geometry per line, measured once per refresh (three tweens share it).
    const cache = new Map<number, { x: number; y: number; s: number }>();
    const onRefreshInit = () => {
      cache.clear();
      fit();
    };
    fit();
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit);

    const flip = (i: number) => {
      const hit = cache.get(i);
      if (hit) return hit;
      const inner = inners[i];
      const prev = inner.style.transform;
      inner.style.transform = 'none';
      const box = inner.getBoundingClientRect();
      const g = textRect(ghosts[i]);
      inner.style.transform = prev;
      const a = textRect(phrases[i]);
      const fsA = parseFloat(getComputedStyle(phrases[i]).fontSize) || 9;
      const fsB = parseFloat(getComputedStyle(ghosts[i]).fontSize) || 100;
      const s = fsA / fsB;
      // transform-origin is the inner's top-left: box + t + s * (g - box) must land on a.
      const v = {
        x: a.left - box.left - s * (g.left - box.left),
        y: a.top - box.top - s * (g.top - box.top),
        s,
      };
      cache.set(i, v);
      return v;
    };

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

    gsap.set(inners, { opacity: 0 });
    gsap.set(texts, { opacity: 0 });

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
      // The defined term lights up in the contract first.
      tl.to(phrases[i], { color: '#fff', duration: 0.03 }, at - 0.04);
      // Take-off: the copy sits exactly over the small phrase; the phrase hands over.
      tl.set(inner, { opacity: 1 }, at);
      tl.set(phrases[i], { opacity: 0 }, at);
      tl.fromTo(
        inner,
        { x: () => flip(i).x, y: () => flip(i).y, scale: () => flip(i).s },
        { x: 0, y: 0, scale: 1, duration: grow, ease: 'power3.inOut', immediateRender: true },
        at,
      );
      // Settle into display weight and tracking while still small.
      const settleAt = at + grow * 0.16;
      tl.fromTo(ghosts[i], { opacity: 1 }, { opacity: 0, duration: grow * 0.28, ease: 'power1.inOut', immediateRender: false }, settleAt);
      tl.fromTo(texts[i], { opacity: 0 }, { opacity: 1, duration: grow * 0.28, ease: 'power1.inOut', immediateRender: false }, settleAt);
      if (i > 0) tl.to(lines.slice(0, i), { opacity: 0.22, duration: grow * 0.6, ease: 'power1.inOut' }, at);
      if (i === 0) tl.to(fineList ?? fine, { opacity: 0.35, duration: grow * 0.6 }, at + grow * 0.4);
    });

    // Settle: everything at full strength, the small print returns with its terms marked.
    const end = t0 + n * span;
    tl.to(lines, { opacity: 1, duration: 0.08, ease: 'power2.out' }, end);
    tl.to(fineList ?? fine, { opacity: 0.8, duration: 0.08 }, end);
    tl.set(phrases, { color: accent }, end);
    tl.to(phrases, { opacity: 1, duration: 0.06 }, end);
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
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
      stack.style.removeProperty('--theme-fs');
    };
  });

  mm.add(UNPINNED, () => {
    if (title) {
      gsap.from(title, {
        yPercent: 30,
        opacity: 0,
        duration: 0.9,
        ease: 'expo.out',
        scrollTrigger: { trigger: title, start: 'top 90%', once: true },
      });
    }
    inners.forEach((inner, i) => {
      gsap.from(inner, {
        yPercent: 110,
        duration: 0.85,
        delay: i * 0.06,
        ease: 'expo.out',
        scrollTrigger: { trigger: stack, start: 'top 88%', once: true },
      });
    });
    gsap.from(fine, {
      opacity: 0,
      y: 16,
      duration: 0.8,
      ease: 'expo.out',
      scrollTrigger: { trigger: fine, start: 'top 92%', once: true },
    });
  });

  return () => mm.revert();
}

export function ThemeMotion() {
  useSectionMotion('theme', setup);
  return null;
}
