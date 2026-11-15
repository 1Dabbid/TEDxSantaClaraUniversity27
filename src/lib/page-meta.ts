import type { Metadata } from 'next';
import { getSettings } from './content';
import { isIndexable, ogAlt, SITE_NAME } from './site';

/**
 * The 404 page's metadata (src/app/not-found.tsx). Also returned by a route
 * that exists only to answer 404 (the switched-off admin, /keystatic), so the
 * tab title does not change to that route's own once the page has loaded.
 */
export const NOT_FOUND_METADATA: Metadata = {
  // Plain wording, on the page and in the tab.
  title: 'Page not found (404)',
  description: 'This page does not exist.',
  robots: { index: false, follow: true },
  // No canonical (the layout's would point at the home page) and a plain share title.
  alternates: { canonical: null },
  openGraph: { title: `${SITE_NAME} · Page not found (404)`, description: 'This page does not exist.', url: null },
  twitter: { title: `${SITE_NAME} · Page not found (404)`, description: 'This page does not exist.' },
};

/** The size the root share image is drawn at (src/app/opengraph-image.tsx). */
const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * Metadata for a topic page (/speakers, /schedule, /venue, /partners, /team,
 * /faq). The root layout's template puts the title after the event name
 * ("TEDxSantaClaraUniversity · Venue"), the share title says the same and the
 * canonical is the page itself. `index: false` keeps a page out of search results.
 *
 * Share image: a page that sets its own `openGraph` / `twitter` block replaces
 * the root layout's whole block, including the image the root
 * opengraph-image.tsx adds by file convention. So the image is named here, by
 * its route (/opengraph-image, the same card as the home page).
 */
export async function topicPageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Promise<Metadata> {
  const shareTitle = `${SITE_NAME} · ${title}`;
  const image = { url: '/opengraph-image', ...SHARE_IMAGE_SIZE, type: 'image/png', alt: ogAlt(await getSettings()) };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, title: shareTitle, description, url: path, locale: 'en_US', images: [image] },
    twitter: { card: 'summary_large_image', title: shareTitle, description, images: [image] },
    ...(index && isIndexable() ? {} : { robots: { index: false, follow: true } }),
  };
}
