'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import type { Quality } from '@/lib/quality';
import Experience from './Experience';

/**
 * The single persistent WebGL canvas. Fixed, full viewport, behind content,
 * decorative only (aria-hidden, no pointer events; pointer input comes from
 * scrollState.pointer).
 *
 * Never import this file statically. It is loaded by SceneLoader via
 * next/dynamic (ssr: false) after first paint, so three.js stays out of the
 * initial bundle.
 */
export default function SceneCanvas({ quality }: { quality: Exclude<Quality, 'static'> }) {
  return (
    <div className="scene-canvas" aria-hidden="true">
      <Canvas
        dpr={quality === 'high' ? [1, 2] : [1, 1.5]}
        gl={{ antialias: quality === 'high', alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 6], fov: 35, near: 0.1, far: 100 }}
        style={{ pointerEvents: 'none' }}
      >
        <color attach="background" args={['#000000']} />
        <Suspense fallback={null}>
          <Experience quality={quality} />
        </Suspense>
      </Canvas>
    </div>
  );
}
