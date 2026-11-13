'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { getQuality, useQuality } from '@/lib/quality';
import type { Engine } from './engine';

/**
 * Mounts the global motion system from the root layout.
 *
 * - Keeps `html.motion` in sync with the quality tier (the inline boot script in
 *   the layout sets it before first paint; this removes it if quality resolves
 *   to `static`).
 * - Lazily loads the engine (gsap, reveals, cursor, magnetic, header, page
 *   transitions) and re-scans on every route change.
 * - Renders the curtain and cursor layers (aria-hidden, inert, pointer-events none).
 * - In static mode it still moves focus to #main after client-side navigations.
 */

let enginePromise: Promise<typeof import('./engine')> | null = null;
const loadEngine = () => (enginePromise ??= import('./engine'));

// Start fetching the engine chunk during hydration when motion is likely on.
if (typeof window !== 'undefined' && document.documentElement.classList.contains('motion')) {
  void loadEngine();
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function MotionRoot() {
  const quality = useQuality();
  const pathname = usePathname();
  const router = useRouter();
  const engineRef = useRef<Engine | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const firstPath = useRef(true);
  const routerRef = useRef(router);
  const admin = pathname.startsWith('/keystatic');
  const active = quality !== 'static' && !admin;

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Never trust the hydration-time 'static' snapshot here: read the live tier.
  useIsoLayoutEffect(() => {
    const on = getQuality() !== 'static' && !admin;
    document.documentElement.classList.toggle('motion', on);
  }, [quality, admin]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadEngine().then(({ startEngine }) => {
      if (cancelled) return;
      engineRef.current = startEngine({
        push: (href) => routerRef.current.push(href, { scroll: false }),
        prefetch: (href) => routerRef.current.prefetch(href),
        cursorRoot: cursorRef.current,
        curtain: curtainRef.current,
      });
      engineRef.current.route(true);
    });
    return () => {
      cancelled = true;
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (engineRef.current) {
      engineRef.current.route(false);
    } else if (!window.location.hash) {
      document.getElementById('main')?.focus({ preventScroll: true });
    }
  }, [pathname]);

  if (admin) return null;

  return (
    <>
      <div ref={curtainRef} className="curtain" aria-hidden="true" inert>
        <div className="shell flex h-full flex-col justify-end pb-10 sm:pb-14">
          <p data-curtain-caption className="fine-print text-mute">
            <span className="text-white">§</span>&nbsp;continuing<span className="text-accent">…</span>
          </p>
          <span aria-hidden="true" className="curtain-rule mt-4 block h-px w-full max-w-md bg-accent" />
        </div>
      </div>
      <div ref={cursorRef} className="cursor" data-state="default" aria-hidden="true" inert>
        <div className="cursor-lens">
          <div>
            <div className="cursor-lens-content" />
            <span className="cursor-lens-glass" />
            <span className="cursor-lens-label">×2.4</span>
          </div>
        </div>
        <div className="cursor-ring">
          <span />
        </div>
        <div className="cursor-dot">
          <span />
        </div>
      </div>
    </>
  );
}
