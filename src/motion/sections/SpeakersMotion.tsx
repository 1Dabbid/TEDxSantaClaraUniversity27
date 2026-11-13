'use client';

import { lenisRef } from '../lenisRef';
import { useSectionMotion, type MotionKit } from '../useSectionMotion';

/** Keep in sync with the stage media block in globals.css (Speakers). */
const STAGE = '(min-width: 1024px) and (min-height: 44rem)';

/* Timeline positions (0..1 over the pinned runway). The camera lands on the rug
   at about 0.46 of the runway (section progress 0.5), so the strip only rises
   once the stage moment has had its hold. */
const STRIP_IN = 0.42;
const STRIP_IN_END = 0.5;
const TRAVEL_START = 0.5;
const TRAVEL_END = 0.96;

/**
 * Speakers stage (desktop): the section is a tall runway with a sticky stage
 * (CSS, globals.css), so it needs no pin spacer and works with Lenis.
 *   1. on approach the heading scales up from small, anchored bottom left;
 *   2. hold: heading, badge and caption top left, the lit rug alone mid-frame;
 *   3. the strip of glass cards rises into the lower edge and travels sideways
 *      with the scroll (x only), the rug still in view above it; on short
 *      screens the heading block moves up just enough to make room.
 * Keyboard: focusing a card scrolls the page to the runway position where that
 * card is fully in view, so every card is reachable and visible by Tab alone.
 *
 * Phones and tablets: CSS only (a short sticky hold, then the list).
 */
function setup({ gsap, root }: MotionKit) {
  const title = root.querySelector<HTMLElement>('[data-speakers-title]');
  const meta = root.querySelector<HTMLElement>('[data-speakers-meta]');
  const strip = root.querySelector<HTMLElement>('[data-speakers-strip]');
  const head = root.querySelector<HTMLElement>('[data-speakers-head]');
  const track = root.querySelector<HTMLElement>('[data-speakers-track]');
  if (!title || !strip || !track) return;

  const mm = gsap.matchMedia();
  mm.add(STAGE, () => {
    // Approach: small to large while the stage slides up into place.
    gsap.fromTo(
      title,
      { scale: 0.58 },
      {
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: root, start: 'top 90%', end: 'top top', scrub: 0.6 },
      },
    );
    // Never leave a focused link inside it invisible: Tab can land on the
    // applications link before (or while) the entrance plays.
    let showMeta = () => {};
    if (meta) {
      const enter = gsap.from(meta, {
        opacity: 0,
        y: 18,
        duration: 1.1,
        delay: 0.35,
        ease: 'expo.out',
        scrollTrigger: { trigger: root, start: 'top 45%', once: true },
      });
      showMeta = () => {
        enter.scrollTrigger?.kill();
        enter.progress(1);
      };
      meta.addEventListener('focusin', showMeta);
    }

    const pad = () => {
      const cs = getComputedStyle(strip);
      return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
    };
    const endX = () => {
      const p = pad();
      return Math.min(0, strip.clientWidth - p.l - p.r - track.scrollWidth);
    };

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true },
    });
    // Short screens: the heading block gives way (moves up) just enough for the strip.
    if (head) {
      const lift = () => -Math.max(0, head.offsetTop + head.offsetHeight + 24 - strip.offsetTop);
      tl.fromTo(head, { y: 0 }, { y: () => lift(), duration: STRIP_IN_END - STRIP_IN, ease: 'power2.inOut' }, STRIP_IN);
    }
    tl.fromTo(strip, { y: 90, opacity: 0 }, { y: 0, opacity: 1, duration: STRIP_IN_END - STRIP_IN, ease: 'power2.out' }, STRIP_IN);
    tl.fromTo(track, { x: 0 }, { x: () => endX(), duration: TRAVEL_END - TRAVEL_START }, TRAVEL_START);
    tl.to({}, { duration: 0.001 }, 1);

    // Keyboard: bring the focused card into view by scrolling the runway.
    const onFocusIn = (e: FocusEvent) => {
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.speaker-card');
      const st = tl.scrollTrigger;
      if (!card || !st) return;
      const ex = endX();
      const curX = Number(gsap.getProperty(track, 'x')) || 0;
      const r = card.getBoundingClientRect();
      const natural = r.left - curX; // left edge at x = 0
      const p = pad();
      const sr = strip.getBoundingClientRect();
      const minLeft = sr.left + p.l;
      const maxLeft = Math.min(window.innerWidth, sr.right) - p.r - r.width;
      // Smallest move that shows the whole card, within the travel range.
      let x = Math.min(Math.max(curX, maxLeft - natural), minLeft - natural);
      x = Math.min(0, Math.max(ex, x));
      let t = ex === 0 ? TRAVEL_START : TRAVEL_START + (x / ex) * (TRAVEL_END - TRAVEL_START);
      t = Math.max(t, STRIP_IN_END);
      if (Math.abs(t - tl.progress()) < 0.002) return;
      const y = st.start + t * (st.end - st.start);
      const lenis = lenisRef.current;
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      tl.progress(t);
      st.getTween()?.progress(1);
    };
    track.addEventListener('focusin', onFocusIn);

    // Scrolling the track's own box (focus inside an overflow box) must never happen.
    const onScroll = () => {
      if (strip.scrollLeft) strip.scrollLeft = 0;
    };
    strip.addEventListener('scroll', onScroll);

    return () => {
      meta?.removeEventListener('focusin', showMeta);
      track.removeEventListener('focusin', onFocusIn);
      strip.removeEventListener('scroll', onScroll);
    };
  });

  return () => mm.revert();
}

export function SpeakersMotion() {
  useSectionMotion('speakers', setup);
  return null;
}
