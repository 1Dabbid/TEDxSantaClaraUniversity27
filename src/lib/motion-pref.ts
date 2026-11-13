/**
 * The visitor's "Reduce motion" switch (footer, src/components/ui/MotionToggle.tsx).
 * Plain constants in their own module so the server-rendered boot script in
 * SiteShell and the client-side tier logic in quality.ts read the same names.
 */

/** localStorage key: '1' while the switch is on. */
export const REDUCE_MOTION_KEY = 'fp:reduce-motion';

/** Class on <html> while the switch is on (set before first paint by the boot script). */
export const REDUCE_MOTION_CLASS = 'reduce-motion';
