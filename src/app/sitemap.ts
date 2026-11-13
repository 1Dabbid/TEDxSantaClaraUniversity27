import type { MetadataRoute } from 'next';
import { getSpeakers } from '@/lib/content';
import { SITE_URL } from '@/lib/site';

/** Public, indexable pages only. Unannounced speaker pages are noindex and left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const speakers = await getSpeakers();
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/partners`, changeFrequency: 'monthly', priority: 0.7 },
    ...speakers
      .filter((s) => s.announced)
      .map((s) => ({ url: `${SITE_URL}/speakers/${s.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
