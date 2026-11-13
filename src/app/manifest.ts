import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/content';
import { SITE_NAME } from '@/lib/site';

/** Web app manifest (home-screen name and icons). Icons: scripts/generate-icons.mjs. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    name: `${SITE_NAME}: ${s.themeName}`,
    short_name: s.themeName,
    description: s.themeTagline,
    start_url: '/',
    display: 'browser',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
