import type { ReactNode } from 'react';
import '@/app/globals.css';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import { getSettings } from '@/lib/content';
import { REDUCE_MOTION_CLASS, REDUCE_MOTION_KEY, SCENE_LIKELY_CLASS } from '@/lib/motion-pref';
import { engravingLines } from '@/lib/site';
import MotionRoot from '@/motion/MotionRoot';
import SmoothScroll from '@/motion/SmoothScroll';
import SceneGate from '@/motion/SceneGate';

/**
 * Runs before first paint (it is the first thing in <body>, ahead of every element
 * it affects). Adds `html.motion` only when JS runs, the visitor has no
 * reduced-motion preference, has not turned on the site's own "Reduce motion"
 * switch (footer; stored in localStorage, see src/lib/quality.ts) and has no
 * Save-Data. With the switch on it adds `html.reduce-motion` instead, which the
 * CSS treats like the reduced-motion media query. Without `html.motion` (no JS,
 * reduced motion) the server HTML is the complete, fully visible design.
 * MotionRoot removes the class again if the quality tier resolves to `static`.
 *
 * On the home page with motion on (and not 2G, not forced colours, not
 * `?quality=static`) it also adds `html.scene-likely`: the live scene will
 * probably run, so the still frames stay hidden from the first paint and the
 * page shows black until the canvas fades in. The GPU probe clears the class if
 * the scene cannot run (src/lib/quality.ts), and the stills then fade in.
 */
const MOTION_BOOT = `try{var d=document.documentElement,c=navigator.connection,u=0;try{u=localStorage.getItem('${REDUCE_MOTION_KEY}')==='1'}catch(e){}if(u)d.classList.add('${REDUCE_MOTION_CLASS}');else if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!(c&&c.saveData)){d.classList.add('motion');var e=c&&c.effectiveType;if(location.pathname==='/'&&e!=='2g'&&e!=='slow-2g'&&!matchMedia('(forced-colors: active)').matches&&new URLSearchParams(location.search).get('quality')!=='static')d.classList.add('${SCENE_LIKELY_CLASS}')}}catch(e){}`;

/**
 * The public site's chrome: site CSS, motion boot, skip link, header, the WebGL
 * scene gate, smooth scroll, the content layer and the footer. Used by the
 * (site) route group's layout and by the root not-found page (an unknown URL is
 * rendered by the root layout only, outside every route group).
 *
 * The Keystatic admin (/keystatic) lives outside the group and gets none of
 * this: its popovers portal into <body> and must not sit under the content
 * layer's stacking context.
 */
export async function SiteShell({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
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
}
