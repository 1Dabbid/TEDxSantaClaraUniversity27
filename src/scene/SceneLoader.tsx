'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuality } from '@/lib/quality';
import type { EngravingFacts } from './engraving';

const SceneCanvas = dynamic(() => import('./SceneCanvas'), { ssr: false, loading: () => null });

/**
 * Mounts the WebGL canvas only when quality !== 'static', and only after the
 * page has painted and the main thread is idle. Lives in the root layout so
 * the canvas persists across client-side route changes.
 */
export default function SceneLoader({ engraving }: { engraving?: Partial<EngravingFacts> } = {}) {
  const quality = useQuality();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (quality === 'static' || ready) return;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const go = () => setReady(true);
    const schedule = () => {
      if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(go, { timeout: 2500 });
      else timeoutId = setTimeout(go, 600);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      window.removeEventListener('load', schedule);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      clearTimeout(timeoutId);
    };
  }, [quality, ready]);

  if (quality === 'static' || !ready || pathname.startsWith('/keystatic')) return null;
  return <SceneCanvas quality={quality} engraving={engraving} />;
}
