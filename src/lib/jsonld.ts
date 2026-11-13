import type { FaqItem, Settings, Speaker } from './content';
import { CLUB_URL, SITE_NAME, SITE_URL } from './site';

/** Serialises JSON-LD for a <script> tag, escaping `<` so content cannot close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** schema.org Place, built only from the Venue content (single source of truth). */
function placeJsonLd(s: Settings) {
  const a = s.venuePostalAddress;
  const hasAddress = Boolean(a.street || a.city || a.postalCode);
  return {
    '@type': 'Place',
    name: [s.venueName, s.venueCampus].filter(Boolean).join(', '),
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
  };
}

const organizer = { '@type': 'Organization', name: SITE_NAME, url: CLUB_URL } as const;

/** schema.org Event for the home page. */
export function eventJsonLd(s: Settings, speakers: Speaker[]) {
  const announced = speakers.filter((sp) => sp.announced);
  const offerAvailability: Record<Settings['ticketState'], string | null> = {
    'coming-soon': 'https://schema.org/PreOrder',
    'on-sale': 'https://schema.org/InStock',
    'sold-out': 'https://schema.org/SoldOut',
    closed: null,
  };
  const availability = offerAvailability[s.ticketState];
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${SITE_NAME}: ${s.themeName}`,
    description: s.themeTagline,
    startDate: s.dateISO,
    endDate: s.dateISO,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    maximumAttendeeCapacity: 100,
    url: SITE_URL,
    image: [`${SITE_URL}/opengraph-image`],
    location: placeJsonLd(s),
    organizer,
    ...(availability
      ? {
          offers: {
            '@type': 'Offer',
            url: s.ticketState === 'on-sale' && s.ticketUrl ? s.ticketUrl : `${SITE_URL}/#tickets`,
            availability,
            priceCurrency: 'USD',
          },
        }
      : {}),
    ...(announced.length
      ? {
          performer: announced.map((sp) => ({
            '@type': 'Person',
            name: sp.name,
            url: `${SITE_URL}/speakers/${sp.slug}`,
          })),
        }
      : {}),
  };
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

/** Person + Event graph for an announced speaker's page. Never call it for unannounced speakers. */
export function speakerJsonLd(sp: Speaker, s: Settings) {
  const url = `${SITE_URL}/speakers/${sp.slug}`;
  const person = {
    '@type': 'Person',
    '@id': `${url}#person`,
    name: sp.name,
    url,
    ...(sp.role ? { jobTitle: sp.role } : {}),
    ...(sp.shortBio ? { description: sp.shortBio } : {}),
    ...(sp.photo ? { image: `${SITE_URL}${sp.photo}` } : {}),
    ...(sp.link ? { sameAs: [sp.link] } : {}),
  };
  const event = {
    '@type': 'Event',
    name: `${SITE_NAME}: ${s.themeName}`,
    ...(sp.talkTitle ? { about: sp.talkTitle } : {}),
    startDate: s.dateISO,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: SITE_URL,
    location: placeJsonLd(s),
    organizer,
    performer: { '@id': `${url}#person` },
  };
  return { '@context': 'https://schema.org', '@graph': [person, event] };
}
