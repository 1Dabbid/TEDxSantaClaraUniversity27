import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { CSSProperties, ReactNode } from 'react';
import './globals.css';
import { ChromeGate } from '@/components/ChromeGate';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import { getSettings } from '@/lib/content';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import MotionRoot from '@/motion/MotionRoot';
import SmoothScroll from '@/motion/SmoothScroll';
import SceneLoader from '@/scene/SceneLoader';

// Inter variable, self-hosted from @fontsource-variable/inter (no network at build or runtime).
const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = `${s.themeName} · ${SITE_NAME}`;
  const description = `${SITE_NAME} presents ${s.themeName}: ${s.themeTagline} ${s.dateLong}, ${s.venueName}, Santa Clara University. Limited to 100 seats.`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${SITE_NAME}` },
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      url: '/',
      locale: 'en_US',
    },
    twitter: { card: 'summary_large_image', title, description },
    formatDetection: { telephone: false, address: false, email: false },
  };
}

/**
 * Runs before first paint. Adds `html.motion` only when JS runs, the visitor has
 * no reduced-motion preference and no Save-Data. Without it (no JS, reduced
 * motion) the server HTML is the complete, fully visible design. MotionRoot
 * removes the class again if the quality tier resolves to `static`.
 */
const MOTION_BOOT = `try{var d=document.documentElement,c=navigator.connection;if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!(c&&c.saveData)&&location.pathname.indexOf('/keystatic')!==0)d.classList.add('motion')}catch(e){}`;

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <html
      lang="en"
      className={inter.variable}
      style={{ '--accent': settings.accentColor } as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      </head>
      <body>
        <ChromeGate>
          <SkipLink />
          <Header settings={settings} />
        </ChromeGate>
        <SceneLoader />
        <SmoothScroll>
          <div className="relative z-[var(--z-content)]">
            <main id="main" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <ChromeGate>
              <Footer settings={settings} />
            </ChromeGate>
          </div>
        </SmoothScroll>
        <MotionRoot />
      </body>
    </html>
  );
}
