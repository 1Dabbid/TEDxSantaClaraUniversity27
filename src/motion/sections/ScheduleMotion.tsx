'use client';

import { useSectionMotion, type MotionKit } from '../useSectionMotion';

/** The timeline hairline draws itself top to bottom with scroll (scaleY, scrubbed). */
function setup({ gsap, root }: MotionKit) {
  const timeline = root.querySelector<HTMLElement>('[data-timeline]');
  const line = root.querySelector<HTMLElement>('[data-timeline-line]');
  if (!timeline || !line) return;
  gsap.fromTo(
    line,
    { scaleY: 0 },
    {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: timeline, start: 'top 80%', end: 'bottom 55%', scrub: 0.8 },
    },
  );
}

export function ScheduleMotion() {
  useSectionMotion('schedule', setup);
  return null;
}
