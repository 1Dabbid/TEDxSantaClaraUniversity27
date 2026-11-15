'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQuality } from '@/lib/quality';
import { SECTION_IDS, scrollState, type SectionId } from '@/scene/scrollState';
import { anchorScroll, pickAnchor, type Anchor } from './anchor';
import { lenisRef } from './lenisRef';

/**
 * Smooth scrolling + scroll state writer.
 *
 * quality 'high' | 'low': Lenis drives the scroll, synced to the GSAP ticker,
 *   and feeds ScrollTrigger. gsap + lenis are dynamically imported here so they
 *   are not part of the initial route bundle.
 * quality 'static': native scrolling, no Lenis, no ticker. A passive scroll
 *   listener still keeps `scrollState` roughly up to date.
 *
 * Every frame (or scroll event) it writes scrollState.progress, .sections,
 * .velocity; pointer moves write scrollState.pointer.
 *
 * Smooth mode also keeps the reader's place when the window is resized or a
 * phone is rotated: section heights are in viewport units, so the same scroll
 * offset would be another section afterwards. The section and the fraction
 * through it are noted at the first resize event (from the last measurement,
 * i.e. the old layout) and scrolled back to after ScrollTrigger has refreshed.
 * Rotating there and back therefore returns to the same spot. Native mode
 * leaves this to the browser's own scroll anchoring.
 */

type Measured = { id: SectionId; top: number; height: number };

let measured: Measured[] = [];
let maxScroll = 0;
// The viewport height `measured` was taken at (the reader's place is worked out from both).
let measuredVh = 0;

// `?perf` on the first URL of a visit exposes the live instances for performance and leak audits
// (refresh counts, ScrollTrigger.getAll().length). Read once; costs nothing otherwise.
const PERF_DEBUG = typeof window !== 'undefined' && /[?&]perf\b/.test(window.location.search);
type PerfHook = { gsap: unknown; ScrollTrigger: unknown; lenis: unknown; refreshes: number };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function measure() {
  const y = window.scrollY;
  measured = [];
  for (const id of SECTION_IDS) {
    scrollState.sections[id] = 0;
    const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    measured.push({ id, top: r.top + y, height: r.height });
  }
  maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  measuredVh = window.innerHeight;
}

function write(scrollY: number, velocity: number) {
  const vh = window.innerHeight;
  scrollState.progress = maxScroll > 0 ? clamp01(scrollY / maxScroll) : 0;
  scrollState.velocity = velocity;
  for (const m of measured) {
    // 0 when section top hits viewport bottom, 1 when section bottom hits viewport top
    scrollState.sections[m.id] = clamp01((scrollY + vh - m.top) / (m.height + vh));
  }
}

export default function SmoothScroll({ children }: { children?: ReactNode }) {
  const quality = useQuality();
  const pathname = usePathname();
  const enabled = quality !== 'static' && !pathname.startsWith('/keystatic');

  // Pointer (all modes; cheap). Mouse/pen only so touch does not jump the camera.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      scrollState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      scrollState.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    // The pointer leaving the window (onto the browser chrome or another screen) or the window
    // losing focus re-centres it; the scene eases back (rig.ts smooths the pointer).
    const centre = () => {
      scrollState.pointer.x = 0;
      scrollState.pointer.y = 0;
    };
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) centre();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
    document.documentElement.addEventListener('pointerleave', centre, { passive: true });
    window.addEventListener('blur', centre);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseout', onOut);
      document.documentElement.removeEventListener('pointerleave', centre);
      window.removeEventListener('blur', centre);
    };
  }, []);

  // Measurement: on mount, route change, resize and document size changes.
  useEffect(() => {
    let raf = 0;
    const remeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        measure();
        write(lenisRef.current?.scroll ?? window.scrollY, scrollState.velocity);
      });
    };
    remeasure();
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);
    window.addEventListener('resize', remeasure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', remeasure);
    };
  }, [pathname]);

  // Native mode.
  useEffect(() => {
    if (enabled) return;
    let last = window.scrollY;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const y = window.scrollY;
      write(y, y - last);
      last = y;
      clearTimeout(idle);
      idle = setTimeout(() => write(window.scrollY, 0), 120);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(idle);
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled]);

  // Smooth mode: Lenis + GSAP ticker + ScrollTrigger.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let teardown: (() => void) | undefined;

    Promise.all([import('./gsap'), import('lenis')]).then(([{ gsap, ScrollTrigger }, { default: Lenis }]) => {
      if (cancelled) return;
      // Mobile URL-bar show/hide changes the viewport height on every direction change:
      // never let that refresh every trigger (layout uses svh, so nothing needs it).
      ScrollTrigger.config({ ignoreMobileResize: true });
      // Anchor links are handled by the motion engine (header offset + focus).
      const lenis = new Lenis({
        autoRaf: false,
        lerp: 0.085,
        smoothWheel: true,
      });
      lenisRef.current = lenis;
      document.documentElement.dataset.smoothScroll = 'true';

      lenis.on('scroll', ScrollTrigger.update);
      const tick = (time: number) => {
        lenis.raf(time * 1000);
        write(lenis.scroll, lenis.velocity);
      };
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      // Pins, splits and layout changes all end in a ScrollTrigger refresh: re-measure sections then.
      const perf = PERF_DEBUG ? ((window as unknown as { __fpPerf: PerfHook }).__fpPerf = { gsap, ScrollTrigger, lenis, refreshes: 0 }) : null;
      const onRefresh = () => {
        if (perf) perf.refreshes++;
        measure();
        write(lenis.scroll, lenis.velocity);
      };
      ScrollTrigger.addEventListener('refresh', onRefresh);
      measure();
      ScrollTrigger.refresh();

      // The reader's place across a resize or rotation (see the note at the top).
      let hold: Anchor | null = null;
      let holdTimer: ReturnType<typeof setTimeout> | undefined;
      let holdRaf = 0;
      let lastW = window.innerWidth;
      let lastH = window.innerHeight;
      const INPUTS = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
      const release = () => {
        hold = null;
        clearTimeout(holdTimer);
        cancelAnimationFrame(holdRaf);
        for (const t of INPUTS) window.removeEventListener(t, release, true);
      };
      // `measured` must describe the new layout when this runs.
      const restore = () => {
        if (!hold) return;
        lenis.resize();
        const y = anchorScroll(hold, measured, window.innerHeight);
        if (y === null || Math.abs(y - lenis.scroll) < 1) return;
        lenis.scrollTo(y, { immediate: true, force: true });
        write(lenis.scroll, 0);
      };
      const remeasureAndRestore = () => {
        if (!hold) return;
        measure();
        restore();
      };
      const onResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const sameW = w === lastW;
        const dH = Math.abs(h - lastH);
        if (sameW && dH === 0) return;
        // A phone's URL bar sliding in or out resizes the viewport on every change of
        // direction: nothing is laid out again for that (svh units; ScrollTrigger ignores
        // it too), so the page must not be moved either.
        if (sameW && ScrollTrigger.isTouch === 1 && dH <= h * 0.25) return;
        lastW = w;
        lastH = h;
        if (!hold) {
          hold = pickAnchor(measured, lenis.scroll, measuredVh || h);
          if (!hold) return;
          for (const t of INPUTS) window.addEventListener(t, release, { passive: true, capture: true });
        }
        // Soon, so the wrong section is not on screen until the (debounced) refresh; then
        // after every refresh while the layout settles; released once it has.
        cancelAnimationFrame(holdRaf);
        holdRaf = requestAnimationFrame(() => (holdRaf = requestAnimationFrame(remeasureAndRestore)));
        clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
          remeasureAndRestore();
          release();
        }, 1200);
      };
      ScrollTrigger.addEventListener('refresh', restore);
      window.addEventListener('resize', onResize);

      teardown = () => {
        window.removeEventListener('resize', onResize);
        ScrollTrigger.removeEventListener('refresh', restore);
        release();
        ScrollTrigger.removeEventListener('refresh', onRefresh);
        gsap.ticker.remove(tick);
        lenis.destroy();
        lenisRef.current = null;
        delete document.documentElement.dataset.smoothScroll;
      };
    }).catch(() => {
      // gsap or Lenis failed to load: native scrolling stays.
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [enabled]);

  // Route changes: scroll position (top, hash target, or restored on back/forward) and the
  // ScrollTrigger refresh are owned by the motion engine (src/motion/engine/navigation.ts).

  return <>{children}</>;
}
