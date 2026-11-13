'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { Quality } from '@/lib/quality';
import { scrollState } from './scrollState';

/**
 * PLACEHOLDER scene. Replace wholesale with the real microphone / stage / seats
 * experience. Contract: default export, receives `quality`, reads scroll and
 * pointer from `scrollState` inside useFrame (never React state).
 */
export default function Experience({ quality }: { quality: Exclude<Quality, 'static'> }) {
  const mesh = useRef<Mesh>(null);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    m.rotation.y += delta * 0.15;
    m.rotation.x = 0.25 + scrollState.pointer.y * 0.05;
    m.position.y = -scrollState.progress * 2.5;
    m.position.x = 1.6 + scrollState.pointer.x * 0.1;
  });

  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <pointLight position={[-4, 1, 2]} intensity={6} color="#EB0028" distance={12} />
      <mesh ref={mesh} position={[1.6, 0, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 2.4, quality === 'high' ? 64 : 32]} />
        <meshStandardMaterial color="#8a8a8a" metalness={1} roughness={0.35} />
      </mesh>
    </>
  );
}
