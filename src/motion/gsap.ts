'use client';

/**
 * Single place GSAP plugins are registered. Always import gsap from here:
 *
 *   import { gsap, ScrollTrigger, SplitText } from '@/motion/gsap';
 *
 * Registration is idempotent and only runs in the browser.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

let registered = false;

export function registerGsap() {
  if (registered || typeof window === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  registered = true;
}

registerGsap();

export { gsap, ScrollTrigger, SplitText };
