import type { MetadataRoute } from 'next';
import { isIndexable, SITE_URL } from '@/lib/site';

/** Production: everything but the admin. Vercel preview/development builds: nothing (see isIndexable). */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/keystatic', '/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
