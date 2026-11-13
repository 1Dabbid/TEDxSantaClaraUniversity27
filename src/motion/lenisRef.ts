import type Lenis from 'lenis';

/**
 * The active Lenis instance, or null when smooth scrolling is off
 * (quality === 'static', or before SmoothScroll has initialised).
 *
 * Use it for programmatic scrolling, e.g. `lenisRef.current?.scrollTo('#tickets')`,
 * and fall back to native `element.scrollIntoView()` when it is null.
 */
export const lenisRef: { current: Lenis | null } = { current: null };
