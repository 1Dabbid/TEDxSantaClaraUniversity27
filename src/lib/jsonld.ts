import type { FaqItem, Settings, Speaker } from './content';
import { paragraphs } from './content';
import { eventDateTimes, zonedDateTime } from './dates';
import { CLUB_URL, SITE_NAME, SITE_URL, venueLine } from './site';

/** Stable node ids, so pages point at one Event and one Organization instead of repeating them. */
export const EVENT_ID = `${SITE_URL}/#event`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const ORG_ID = `${CLUB_URL}/#org`;

/** Serialises JSON-LD for a <script> tag, escaping `<` so content cannot close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Full event name, e.g. "TEDxSantaClaraUniversity: Fine Print". */
export const fullEventName = (s: Pick<Settings, 'themeName'>) => `${SITE_NAME}: ${s.themeName}`;

/** schema.org Place, built only from the Venue content (single source of truth). */
function placeJsonLd(s: Settings) {
  const a = s.venuePostalAddress;
  const hasAddress = Boolean(a.street || a.city || a.postalCode);
  return {
    '@type': 'Place',
    name: venueLine(s),
    ...(hasAddress
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(a.street ? { streetAddress: a.street } : {}),
            ...(a.city ? { addressLocality: a.city } : {}),
            ...(a.region ? { addressRegion: a.region } : {}),
            ...(a.postalCode ? { postalCode: a.postalCode } : {}),
            addressCountry: a.country,
          },
        }
      : {}),
    ...(s.venueCoordinates
      ? { geo: { '@type': 'GeoCoordinates', latitude: s.venueCoordinates.lat, longitude: s.venueCoordinates.lng } }
      : {}),
  };
}

/** In person only, or in person plus the livestream (when a livestream link is set). */
function attendanceJsonLd(s: Settings) {
  return s.livestreamUrl
    ? {
        eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
        location: [placeJsonLd(s), { '@type': 'VirtualLocation', url: s.livestreamUrl }],
      }
    : { eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: placeJsonLd(s) };
}

/** The club that organizes the event; sameAs: its filled-in social profiles (Contact > Social links). */
function organizerJsonLd(s: Settings) {
  const sameAs = [s.socials.instagram, s.socials.linkedin, s.socials.youtube, s.socials.tiktok].filter(Boolean);
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: CLUB_URL,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/**
 * The ticket offer, only once tickets are (or were) on sale: nothing while
 * "coming soon" or "closed", so search engines never see a price-less or
 * invented offer. Price, sale start and ticket link only when they are filled in.
 */
function offersJsonLd(s: Settings) {
  if (s.ticketState !== 'on-sale' && s.ticketState !== 'sold-out') return {};
  const validFrom = s.ticketSaleStart ? zonedDateTime(s.ticketSaleStart, 0, 0) : null;
  return {
    offers: {
      '@type': 'Offer',
      ...(s.ticketPrice !== null ? { price: s.ticketPrice, priceCurrency: 'USD' } : {}),
      availability: s.ticketState === 'on-sale' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      ...(validFrom ? { validFrom } : {}),
      ...(s.ticketUrl ? { url: s.ticketUrl } : {}),
    },
  };
}

/** schema.org Event (plus the WebSite it lives on) for the home page. */
/** schema.org doorTime with the venue's offset, or nothing when the time cannot be read. */
function doorTime(dateISO: string, time: string): { doorTime?: string } {
  const { startDate } = eventDateTimes(dateISO, time, '');
  return startDate !== dateISO ? { doorTime: startDate } : {};
}

export function eventJsonLd(s: Settings, speakers: Speaker[]) {
  const announced = speakers.filter((sp) => sp.announced);
  const description = paragraphs(s.themeStory)[0] || s.themeTagline;
  const event = {
    '@type': 'Event',
    '@id': EVENT_ID,
    name: fullEventName(s),
    ...(description ? { description } : {}),
    // Talks start time (falls back to doors), with the venue's UTC offset; the plain date while no time is set.
    ...eventDateTimes(s.dateISO, s.talksTime || s.doorsTime, s.endTime),
    // Doors, when they open before the talks start.
    ...(s.talksTime && s.doorsTime ? doorTime(s.dateISO, s.doorsTime) : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    ...attendanceJsonLd(s),
    maximumAttendeeCapacity: s.capacity,
    url: SITE_URL,
    image: [`${SITE_URL}/opengraph-image`],
    organizer: organizerJsonLd(s),
    ...offersJsonLd(s),
    ...(announced.length
      ? {
          performer: announced.map((sp) => ({
            '@type': 'Person',
            '@id': `${SITE_URL}/speakers/${sp.slug}#person`,
            name: sp.name,
            url: `${SITE_URL}/speakers/${sp.slug}`,
          })),
        }
      : {}),
  };
  const website = {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: fullEventName(s),
    url: SITE_URL,
    publisher: { '@id': ORG_ID },
  };
  return { '@context': 'https://schema.org', '@graph': [event, website] };
}

/** schema.org FAQPage for the FAQ section. */
export function faqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}

/**
 * Person + breadcrumb graph for an announced speaker's page. The event itself is
 * described once, on the home page (`EVENT_ID`); the speaker points at it by id.
 * Never call it for unannounced speakers.
 */
export function speakerJsonLd(sp: Speaker) {
  const url = `${SITE_URL}/speakers/${sp.slug}`;
  const personId = `${url}#person`;
  const person = {
    '@type': 'Person',
    '@id': personId,
    name: sp.name,
    url,
    ...(sp.role ? { jobTitle: sp.role } : {}),
    ...(sp.shortBio ? { description: sp.shortBio } : {}),
    ...(sp.photo ? { image: `${SITE_URL}${sp.photo}` } : {}),
    ...(sp.link ? { sameAs: [sp.link] } : {}),
    performerIn: { '@id': EVENT_ID },
    ...(sp.talkTitle
      ? { subjectOf: { '@type': 'CreativeWork', name: sp.talkTitle, author: { '@id': personId }, isPartOf: { '@id': EVENT_ID } } }
      : {}),
  };
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Speakers', item: `${SITE_URL}/speakers` },
      { '@type': 'ListItem', position: 3, name: sp.name, item: url },
    ],
  };
  return { '@context': 'https://schema.org', '@graph': [person, breadcrumb] };
}

/** One step of a page's trail: its name and its path ('/' for home). */
export type Crumb = { name: string; path: string };

/** schema.org BreadcrumbList for a topic page, e.g. Home > Venue. */
export function breadcrumbJsonLd(trail: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

/** A topic page's own graph: any page-specific nodes, then its breadcrumb. */
export function pageJsonLd(trail: Crumb[], ...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': [...nodes, breadcrumbJsonLd(trail)] };
}

/**
 * schema.org Place for /venue, built from the same Venue content as the Event's
 * location (placeJsonLd), plus the page's own address and the map link.
 */
export function venuePlaceJsonLd(s: Settings) {
  return {
    ...placeJsonLd(s),
    '@id': `${SITE_URL}/venue#place`,
    url: `${SITE_URL}/venue`,
    ...(s.mapUrl ? { hasMap: s.mapUrl } : {}),
    maximumAttendeeCapacity: s.capacity,
  };
}

/** schema.org FAQPage for /faq: each question also carries its own address (`/faq#<id>`). */
export function faqPageJsonLd(items: FaqItem[], ids: string[]) {
  // The node sits inside the page's @graph, which carries the @context once.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { '@context': _context, ...base } = faqJsonLd(items);
  return {
    ...base,
    '@id': `${SITE_URL}/faq#faqpage`,
    url: `${SITE_URL}/faq`,
    mainEntity: base.mainEntity.map((q, i) => ({ ...q, url: `${SITE_URL}/faq#${ids[i]}` })),
  };
}
