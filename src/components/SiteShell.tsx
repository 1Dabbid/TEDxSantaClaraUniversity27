import type { ReactNode } from 'react';
import '@/app/globals.css';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import { getSettings } from '@/lib/content';
import {
  NO_WEBGL_KEY,
  REDUCE_MOTION_CLASS,
  REDUCE_MOTION_KEY,
  SCENE_LIKELY_CLASS,
  SCENE_SLOW_KEY,
} from '@/lib/motion-pref';
import { engravingLines } from '@/lib/site';
import MotionRoot from '@/motion/MotionRoot';
import SmoothScroll from '@/motion/SmoothScroll';
import SceneGate from '@/motion/SceneGate';

/**
 * Runs before first paint (it is the first thing in <body>, ahead of every element
 * it affects). It decides, as far as it can without creating a WebGL context,
 * whether the motion design will run, and adds `html.motion` only then. The rules
 * are those of compute() in src/lib/quality.ts, in the same order:
 *
 * - the site's own "Reduce motion" switch (footer; localStorage): no motion, and
 *   `html.reduce-motion` instead, which the CSS treats like the media query;
 * - `?quality=high|low` forces motion on, `?quality=static` off;
 * - prefers-reduced-motion, Save-Data, a 2G-class connection: off;
 * - no WebGL: off (no WebGL API at all, or the GPU probe of an earlier visit
 *   found none and left a note in localStorage).
 *
 * Without `html.motion` (and without JS) the server HTML is the complete, fully
 * visible design, and the motion engine is never downloaded. Deciding it here
 * matters: the motion layout is taller (pinned runways), so a late change of mind
 * moves the page under a deep link. MotionRoot still follows the tier afterwards
 * (a first visit without WebGL is only known after the probe) and keeps the
 * reader's place when it has to switch.
 *
 * On the home page with motion on (and not 2G, not forced colours) it also adds
 * `html.scene-likely`: the live scene will probably run, so the still frames stay
 * hidden from the first paint and the page shows black until the canvas fades in.
 * The GPU probe clears the class if the scene cannot run (src/lib/quality.ts), and
 * the stills then fade in. Not added when the scene was already found too slow
 * during this visit (sessionStorage; ignored when the URL carries `quality=` or
 * `perf=`, the same test as wasSlow() in src/motion/SceneGate.tsx: keep the two
 * in step, or the stills show first and the canvas then fades in over them).
 */
const MOTION_BOOT = `try{var d=document.documentElement,c=navigator.connection,q=new URLSearchParams(location.search).get('quality'),f=q==='high'||q==='low',e=c&&c.effectiveType,g=e==='2g'||e==='slow-2g',u=0,n=0,s=0;try{u=localStorage.getItem('${REDUCE_MOTION_KEY}')==='1';n=localStorage.getItem('${NO_WEBGL_KEY}')==='1'}catch(x){}try{s=!/[?&](quality|perf)=/.test(location.search)&&sessionStorage.getItem('${SCENE_SLOW_KEY}')==='1'}catch(x){}if(u)d.classList.add('${REDUCE_MOTION_CLASS}');else if(f||(q!=='static'&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!(c&&c.saveData)&&!g&&window.WebGLRenderingContext&&!n)){d.classList.add('motion');if(location.pathname==='/'&&!g&&!s&&!matchMedia('(forced-colors: active)').matches)d.classList.add('${SCENE_LIKELY_CLASS}')}}catch(x){}`;

/**
 * The public site's chrome: site CSS, motion boot, skip link, header, the WebGL
 * scene gate, smooth scroll, the content layer and the footer. Used by the
 * (site) route group's layout and by the root not-found page (an unknown URL is
 * rendered by the root layout only, outside every route group).
 *
 * The Keystatic admin (/keystatic) lives outside the group and gets none of
 * this: its popovers portal into <body> and must not sit under the content
 * layer's stacking context.
 *
 * Google Analytics (src/components/Analytics.tsx) is added only when the build has
 * a Measurement ID; without one the HTML and the scripts carry no trace of it.
 */
export async function SiteShell({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  const shell = (
    <>
      <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      {/* The accent comes from Event basics; the loader guarantees a 6-digit hex value. */}
      <style dangerouslySetInnerHTML={{ __html: `:root{--accent:${settings.accentColor}}` }} />
      <SkipLink />
      <Header settings={settings} />
      <SceneGate engraving={engravingLines(settings)} />
      <SmoothScroll>
        <div className="relative z-[var(--z-content)]">
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Footer settings={settings} />
        </div>
      </SmoothScroll>
      <MotionRoot caption={settings.copy.transitionCaption} />
    </>
  );
  // Google Analytics, only in a build that has a Measurement ID. next.config.ts inlines
  // GA_MEASUREMENT_ID ('' when off), so without one this branch, the import in it and the
  // analytics code itself are left out of the build, and the page is exactly `shell`.
  if (process.env.GA_MEASUREMENT_ID) {
    const { default: Analytics } = await import('@/components/Analytics');
    return (
      <>
        {shell}
        <Analytics
          id={process.env.GA_MEASUREMENT_ID}
          ticketState={settings.ticketState}
          links={{ ticket: settings.ticketUrl, interest: settings.interestUrl, newsletter: settings.newsletterUrl }}
        />
      </>
    );
  }
  return shell;
}
