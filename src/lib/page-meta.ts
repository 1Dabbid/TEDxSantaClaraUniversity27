import type { Metadata } from 'next';
import { isIndexable, SITE_NAME } from './site';

/**
 * Metadata for a topic page (/venue, /schedule, /team, /faq). The root layout's
 * template puts the title after the event name ("TEDxSantaClaraUniversity ·
 * Venue"), the share title says the same, the canonical is the page itself and
 * the share image is the root opengraph-image.tsx (file convention, never set
 * here). `index: false` keeps a page out of search results.
 */
export function topicPageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const shareTitle = `${SITE_NAME} · ${title}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, title: shareTitle, description, url: path, locale: 'en_US' },
    twitter: { card: 'summary_large_image', title: shareTitle, description },
    ...(index && isIndexable() ? {} : { robots: { index: false, follow: true } }),
  };
}
