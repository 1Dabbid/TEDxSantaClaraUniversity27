import type { MetadataRoute } from 'next';
import { getFaq, getSettings, getSpeakers } from '@/lib/content';
import { SITE_URL } from '@/lib/site';

/** Public, indexable pages only. Unannounced speaker pages are noindex and left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [speakers, settings, faq] = await Promise.all([getSpeakers(), getSettings(), getFaq()]);
  const announced = speakers.filter((s) => s.announced);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    // Topic pages. /schedule is listed before the running order is published: it states the date.
    { url: `${SITE_URL}/venue`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/schedule`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/partners`, changeFrequency: 'monthly', priority: 0.7 },
    // /team and /faq exist only while their switches are on (and the FAQ has questions).
    ...(settings.sections.showFaq && faq.length ? [{ url: `${SITE_URL}/faq`, changeFrequency: 'monthly' as const, priority: 0.6 }] : []),
    ...(settings.sections.showTeam ? [{ url: `${SITE_URL}/team`, changeFrequency: 'monthly' as const, priority: 0.5 }] : []),
    // /speakers is noindex until a speaker is announced.
    ...(announced.length ? [{ url: `${SITE_URL}/speakers`, changeFrequency: 'weekly' as const, priority: 0.8 }] : []),
    ...announced.map((s) => ({ url: `${SITE_URL}/speakers/${s.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
