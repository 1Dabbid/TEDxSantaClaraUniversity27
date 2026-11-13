import type { Settings, Speaker } from './content';
import { SITE_NAME, SITE_URL } from './site';

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
    location: {
      '@type': 'Place',
      name: s.venueName,
      // Venue postal address (Santa Clara University main campus).
      address: {
        '@type': 'PostalAddress',
        streetAddress: '500 El Camino Real',
        addressLocality: 'Santa Clara',
        addressRegion: 'CA',
        postalCode: '95053',
        addressCountry: 'US',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: 'https://tedxscu.com',
    },
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
      ? { performer: announced.map((sp) => ({ '@type': 'Person', name: sp.name })) }
      : {}),
  };
}
