'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQuality } from '@/lib/quality';
import { SECTION_IDS, scrollState, type SectionId } from '@/scene/scrollState';
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
 */

type Measured = { id: SectionId; top: number; height: number };

let measured: Measured[] = [];
let maxScroll = 0;

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
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
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

      teardown = () => {
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
