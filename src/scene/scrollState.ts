/**
 * Shared scroll/pointer state.
 *
 * A plain mutable singleton: no React state, no subscriptions. It is written
 * once per frame by `src/motion/SmoothScroll.tsx` and is safe to read inside
 * R3F `useFrame` callbacks or GSAP tickers without causing re-renders.
 *
 * Never replace the objects (`scrollState.sections = ...`); mutate fields.
 */

export const SECTION_IDS = [
  'hero',
  'theme',
  'speakers',
  'schedule',
  'venue',
  'tickets',
  'team',
  'faq',
  'newsletter',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export type ScrollState = {
  /** Whole-document scroll progress, 0 at the top, 1 at the bottom. */
  progress: number;
  /**
   * Per-section progress, each 0..1:
   * 0 when the section's top edge reaches the bottom of the viewport,
   * 1 when the section's bottom edge reaches the top of the viewport.
   * Sections that are not on the current route stay at 0.
   */
  sections: Record<SectionId, number>;
  /**
   * Pointer position in normalised device coordinates, -1..1.
   * x: -1 left, +1 right. y: -1 bottom, +1 top (same convention as three.js NDC).
   * Stays at 0,0 on touch-only devices.
   */
  pointer: { x: number; y: number };
  /**
   * Signed scroll velocity in CSS pixels per frame (Lenis' `velocity` when
   * smooth scrolling is active, an estimate from native scroll otherwise).
   * Positive = scrolling down. Decays to 0 at rest.
   */
  velocity: number;
};

export const scrollState: ScrollState = {
  progress: 0,
  sections: Object.fromEntries(SECTION_IDS.map((id) => [id, 0])) as Record<SectionId, number>,
  pointer: { x: 0, y: 0 },
  velocity: 0,
};
