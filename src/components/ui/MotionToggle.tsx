'use client';

import { useRef, useSyncExternalStore } from 'react';
import { setReduceMotion, useReduceMotion } from '@/lib/quality';

const REDUCE_MQ = '(prefers-reduced-motion: reduce)';
const subscribeMq = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE_MQ);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const getMq = () => window.matchMedia(REDUCE_MQ).matches;
const noop = () => () => {};

/**
 * "Reduce motion" switch (WCAG 2.2.2, 2.3.3): a toggle button that moves the
 * whole site to the static mode used for prefers-reduced-motion (no WebGL
 * canvas, no smooth scroll, no scroll-driven or idle animation, stills as
 * plates) and back. The choice is stored in localStorage and applied before
 * first paint on every later page load (src/lib/quality.ts, SiteShell boot
 * script). Its name stays "Reduce motion"; `aria-pressed` carries the state.
 *
 * When the device itself asks for reduced motion the site is already static:
 * the switch then shows as on and says so, and cannot turn motion back on.
 *
 * Rendered only after hydration (it needs JavaScript to do anything, and
 * without JavaScript the site is static anyway).
 */
export function MotionToggle({ className = '' }: { className?: string }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const user = useReduceMotion();
  const device = useSyncExternalStore(subscribeMq, getMq, () => false);
  const ref = useRef<HTMLButtonElement>(null);
  if (!mounted) return null;

  const on = user || device;
  const locked = device && !user;

  const toggle = () => {
    if (locked) return;
    setReduceMotion(!user);
    // Pinned sections appear or disappear and the page height changes: keep the
    // switch (and keyboard focus) where the visitor can see it.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })),
    );
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={on}
      aria-disabled={locked || undefined}
      onClick={toggle}
      data-motion-toggle
      data-cursor="link"
      className={`group inline-flex min-h-11 items-center gap-3 rounded-sm pr-1 text-sm text-mute transition-colors duration-300 hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white aria-disabled:cursor-default ${className}`}
    >
      {/* The switch: the knob moves right and turns red when on (shape and position, not colour alone). */}
      <span aria-hidden="true" className="relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-current">
        <span className="ml-[3px] size-2 rounded-full bg-current transition-[translate,background-color] duration-300 group-aria-pressed:translate-x-3 group-aria-pressed:bg-accent" />
      </span>
      <span>Reduce motion</span>
      <span aria-hidden="true" className="fine-print text-mute">
        {on ? 'On' : 'Off'}
      </span>
      {locked ? (
        <span className="fine-print text-mute">
          (set by your device)
        </span>
      ) : null}
    </button>
  );
}
