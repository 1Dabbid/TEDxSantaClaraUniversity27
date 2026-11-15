import type { Metadata } from 'next';
import { getSettings } from './content';
import { isIndexable, ogAlt, shareImagePath, SITE_NAME } from './site';

/** The size the root share image is drawn at (src/app/opengraph-image.tsx). */
const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * The share image as Open Graph / Twitter metadata: the card at its versioned
 * address (shareImagePath), with its size, type and alt text. Used by the root
 * layout (the home page), every topic page and the 404 page, so they all name one address.
 */
export const shareImageMeta = (s: Parameters<typeof shareImagePath>[0] & Parameters<typeof ogAlt>[0]) => ({
  url: shareImagePath(s),
  ...SHARE_IMAGE_SIZE,
  type: 'image/png',
  alt: ogAlt(s),
});

/**
 * The 404 page's metadata (src/app/not-found.tsx). Also returned by a route
 * that exists only to answer 404 (the switched-off admin, /keystatic), so the
 * tab title does not change to that route's own once the page has loaded.
 *
 * Its own `openGraph` / `twitter` block replaces the root layout's, image
 * included, so the share image is named here too: the 404 page carries the same
 * versioned address as every other page.
 */
export async function notFoundMetadata(): Promise<Metadata> {
  const image = shareImageMeta(await getSettings());
  const shareTitle = `${SITE_NAME} · Page not found (404)`;
  const description = 'This page does not exist.';
  return {
    // Plain wording, on the page and in the tab.
    title: 'Page not found (404)',
    description,
    robots: { index: false, follow: true },
    // No canonical (the layout's would point at the home page) and a plain share title.
    alternates: { canonical: null },
    openGraph: { title: shareTitle, description, url: null, images: [image] },
    twitter: { title: shareTitle, description, images: [image] },
  };
}

/**
 * Metadata for a topic page (/speakers, /schedule, /venue, /partners, /team,
 * /faq). The root layout's template puts the title after the event name
 * ("TEDxSantaClaraUniversity · Venue"), the share title says the same and the
 * canonical is the page itself. `index: false` keeps a page out of search results.
 *
 * Share image: a page that sets its own `openGraph` / `twitter` block replaces
 * the root layout's whole block, including the image the root
 * opengraph-image.tsx adds by file convention. So the image is named here, by
 * its route (/opengraph-image, the same card and the same address as the home
 * page), with a version query made from what is drawn on the card
 * (shareImageVersion): when the theme, date, place or the card's design changes,
 * the address changes too and share platforms that keep a picture by its
 * address fetch the new card.
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
  const s = await getSettings();
  const image = shareImageMeta(s);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, title: shareTitle, description, url: path, locale: 'en_US', images: [image] },
    twitter: { card: 'summary_large_image', title: shareTitle, description, images: [image] },
    ...(index && isIndexable() ? {} : { robots: { index: false, follow: true } }),
  };
}
