'use client';

import { Canvas } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { NeutralToneMapping } from 'three';
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
  const pathname = usePathname();
  return (
    <div className="scene-canvas" aria-hidden="true">
      <Canvas
        dpr={quality === 'high' ? [1, 2] : [1, 1.5]}
        gl={{
          // High renders through its own multisampled target, so the default framebuffer needs no MSAA.
          antialias: quality !== 'high',
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        camera={{ position: [2, 1.5, 1.6], fov: 30, near: 0.01, far: 90 }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
          gl.toneMappingExposure = 0;
        }}
        style={{ pointerEvents: 'none' }}
      >
        <color attach="background" args={['#000000']} />
        <Suspense fallback={null}>
          <Experience quality={quality} pathname={pathname} />
        </Suspense>
      </Canvas>
    </div>
  );
}
