import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { getSettings } from '@/lib/content';
import { isIndexable, SITE_NAME, SITE_URL, venueLine } from '@/lib/site';

// Inter variable, self-hosted from @fontsource-variable/inter (no network at build or runtime).
const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = `${SITE_NAME}: ${s.themeName} · ${s.dateShort}`;
  const description = `${SITE_NAME}: ${s.themeName}. ${s.themeTagline} ${s.dateLong}, ${venueLine(s)}.`;
  return {
    metadataBase: new URL(SITE_URL),
    // Every title leads with the full event name.
    title: { default: title, template: `${SITE_NAME} · %s` },
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
    other: {
      'twitter:label1': 'Date',
      'twitter:data1': s.dateLong,
      'twitter:label2': 'Venue',
      'twitter:data2': venueLine(s),
    },
    // Vercel preview/development builds are never indexed (see isIndexable and robots.ts).
    ...(isIndexable() ? {} : { robots: { index: false, follow: false } }),
    formatDetection: { telephone: false, address: false, email: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  // Edge to edge on notched phones; the header, shell and menu pad with safe-area insets.
  viewportFit: 'cover',
};

/**
 * Minimal root layout shared by the public site and the Keystatic admin: the
 * document, the font and the site-wide metadata only. The public site's chrome
 * (header, footer, motion, scene, site CSS) is in src/components/SiteShell.tsx,
 * used by app/(site)/layout.tsx and app/not-found.tsx; /keystatic and /api are
 * outside that route group, so Keystatic's popovers (portalled into <body>) are
 * never painted under the site's content layer.
 * suppressHydrationWarning: SiteShell's boot script adds `html.motion` before hydration.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
