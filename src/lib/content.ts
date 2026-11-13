import 'server-only';
import { cache } from 'react';
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import { formatCalendarDate } from './dates';
import { TEDX_MAX_CAPACITY } from './site';

/**
 * Typed content loader. Components never import Keystatic directly; they get
 * plain objects from here. Everything is read from /content at build time.
 *
 * In the admin, "settings" is split into several smaller singletons (Event
 * basics, Venue, Tickets, Contact, Sections) so editors are not faced with one
 * giant form. `getSettings()` merges them back into the single `Settings`
 * object that every component receives.
 */

const reader = createReader(process.cwd(), keystaticConfig);

export type TicketState = 'coming-soon' | 'on-sale' | 'sold-out' | 'closed';
export type ApplicationsState = 'coming-soon' | 'open' | 'closed';

export type Socials = {
  instagram: string;
  linkedin: string;
  youtube: string;
  tiktok: string;
};

/** A "Getting there" clause in the Venue section. `body` is '' while unknown. */
export type VenueNote = { title: string; body: string };

export type VenuePostalAddress = {
  street: string;
  city: string;
  region: string;
  postalCode: string;
  /** ISO country code, always 'US'. */
  country: string;
};

/** Which optional home-page sections are switched on. */
export type SectionVisibility = {
  showTeam: boolean;
  showFaq: boolean;
  showSpeakerApplications: boolean;
  /** Partners page "All year, not one night" card. Off unless TED confirmed year-round use of the name. */
  showYearRound: boolean;
};

export type Settings = {
  eventName: string;
  themeName: string;
  themeTagline: string;
  themeStory: string;
  dateISO: string;
  /** "Friday, April 23, 2027" */
  dateLong: string;
  /** "Fri, Apr 23, 2027" */
  dateMedium: string;
  /** "Apr 23, 2027" */
  dateShort: string;
  doorsTime: string;
  /** When the talks begin ("6:00 PM"), '' while unknown. Structured data falls back to doorsTime. */
  talksTime: string;
  endTime: string;
  /** Seat capacity, 1..100 (TEDx licence cap). The single source for every seat count on the site. */
  capacity: number;
  venueName: string;
  /** "Santa Clara University" */
  venueCampus: string;
  /** Multi-line: campus, street, "City, ST 00000". Derived from the structured fields. */
  venueAddress: string;
  /** Structured postal address, the single source for the page and JSON-LD. */
  venuePostalAddress: VenuePostalAddress;
  /** What the address is, e.g. "University main address". */
  venueAddressLabel: string;
  /** Decimal degrees, or null when not set. */
  venueCoordinates: { lat: number; lng: number; note: string } | null;
  mapUrl: string;
  venueNotes: VenueNote[];
  ticketState: TicketState;
  ticketUrl: string;
  ticketEmbedUrl: string;
  ticketPriceNote: string;
  /** Ticket price in USD (0..100, TEDx cap), or null while not set. */
  ticketPrice: number | null;
  /** First day of ticket sales, "YYYY-MM-DD", or '' while not set. */
  ticketSaleStart: string;
  speakerApplicationsState: ApplicationsState;
  speakerApplicationsUrl: string;
  speakerApplicationsDeadline: string;
  newsletterUrl: string;
  contactEmail: string;
  partnershipsEmail: string;
  /** Livestream page ('' when the event is not streamed). Rendered by WatchLive. */
  livestreamUrl: string;
  socials: Socials;
  accentColor: string;
  sections: SectionVisibility;
};

export type Speaker = {
  slug: string;
  announced: boolean;
  name: string;
  role: string;
  talkTitle: string;
  shortBio: string;
  bio: string;
  photo: string | null;
  /** Optional personal link ('' when none) and its label. */
  link: string;
  linkLabel: string;
  order: number;
};

export type ScheduleItem = {
  time: string;
  title: string;
  description: string;
  kind: 'talk' | 'break' | 'doors' | 'other';
};

export type Schedule = { published: boolean; items: ScheduleItem[] };

export type FaqItem = { question: string; answer: string };

export type TeamMember = {
  slug: string;
  role: string;
  name: string | null;
  photo: string | null;
  order: number;
};

export type Tier = {
  slug: string;
  name: string;
  description: string;
  amount: string;
  slots: number | null;
  order: number;
};

export type Sponsor = {
  slug: string;
  name: string;
  tier: string | null;
  logo: string | null;
  url: string;
};

/** TED's required "About TEDx" / "About TED" texts, pasted verbatim by Compliance. */
export type TedLanguage = { aboutTedx: string; aboutTed: string };

/** A row of the partner benefits comparison: which tier slugs include it. */
export type PartnerBenefit = { benefit: string; tiers: string[] };

export const PLACEHOLDER_SPEAKER_NAME = 'Speaker to be announced';

const ACCENT_FALLBACK = '#EB0028';
function capacityOf(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? Math.min(v, TEDX_MAX_CAPACITY) : TEDX_MAX_CAPACITY;
}

function priceOf(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, 100) : null;
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
const str = (v: string | null | undefined) => (v ?? '').trim();

function coordinates(lat: string, lng: string, note: string) {
  const la = Number.parseFloat(lat);
  const lo = Number.parseFloat(lng);
  if (!lat || !lng || Number.isNaN(la) || Number.isNaN(lo)) return null;
  return { lat: la, lng: lo, note: str(note) };
}

export const getSettings = cache(async (): Promise<Settings> => {
  const [s, venue, tickets, contact, sections] = await Promise.all([
    reader.singletons.settings.readOrThrow(),
    reader.singletons.venue.read(),
    reader.singletons.tickets.read(),
    reader.singletons.contact.read(),
    reader.singletons.sections.read(),
  ]);
  const dateISO = s.dateISO || '2027-04-23';

  const venueName = str(venue?.venueName) || 'Locatelli Student Activity Center';
  const venueCampus = str(venue?.campus);
  const postal: VenuePostalAddress = {
    street: str(venue?.street),
    city: str(venue?.city),
    region: str(venue?.region),
    postalCode: str(venue?.postalCode),
    country: 'US',
  };
  const cityLine = [postal.city, [postal.region, postal.postalCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const venueNotes = (venue?.notes ?? [])
    .map((n) => ({ title: str(n.title), body: str(n.body) }))
    .filter((n) => n.title || n.body);

  return {
    eventName: s.eventName || 'TEDxSantaClaraUniversity',
    themeName: s.themeName,
    themeTagline: s.themeTagline,
    themeStory: s.themeStory,
    dateISO,
    dateLong: formatCalendarDate(dateISO, 'long'),
    dateMedium: formatCalendarDate(dateISO, 'medium'),
    dateShort: formatCalendarDate(dateISO, 'short'),
    doorsTime: str(s.doorsTime),
    talksTime: str(s.talksTime),
    endTime: str(s.endTime),
    capacity: capacityOf(s.capacity),
    accentColor: /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : ACCENT_FALLBACK,

    venueName,
    venueCampus,
    venueAddress: [venueCampus, postal.street, cityLine].filter(Boolean).join('\n'),
    venuePostalAddress: postal,
    venueAddressLabel: str(venue?.addressLabel),
    venueCoordinates: coordinates(str(venue?.latitude), str(venue?.longitude), str(venue?.coordinatesNote)),
    mapUrl: str(venue?.mapUrl),
    venueNotes,

    ticketState: tickets?.ticketState ?? 'coming-soon',
    ticketUrl: str(tickets?.ticketUrl),
    ticketEmbedUrl: str(tickets?.ticketEmbedUrl),
    ticketPriceNote: str(tickets?.ticketPriceNote),
    ticketPrice: priceOf(tickets?.ticketPrice),
    ticketSaleStart: str(tickets?.ticketSaleStart),
    speakerApplicationsState: tickets?.speakerApplicationsState ?? 'coming-soon',
    speakerApplicationsUrl: str(tickets?.speakerApplicationsUrl),
    speakerApplicationsDeadline: str(tickets?.speakerApplicationsDeadline),

    newsletterUrl: str(contact?.newsletterUrl),
    contactEmail: str(contact?.contactEmail),
    partnershipsEmail: str(contact?.partnershipsEmail),
    livestreamUrl: str(contact?.livestreamUrl),
    socials: {
      instagram: str(contact?.socials.instagram),
      linkedin: str(contact?.socials.linkedin),
      youtube: str(contact?.socials.youtube),
      tiktok: str(contact?.socials.tiktok),
    },

    sections: {
      showTeam: sections?.showTeam ?? true,
      showFaq: sections?.showFaq ?? true,
      showSpeakerApplications: sections?.showSpeakerApplications ?? true,
      showYearRound: sections?.showYearRound ?? false,
    },
  };
});

export const getSpeakers = cache(async (): Promise<Speaker[]> => {
  const entries = await reader.collections.speakers.all();
  return entries
    .filter((e) => e.entry.published)
    .map(({ slug, entry }) => ({
      slug,
      announced: entry.announced,
      name: entry.announced ? entry.name : PLACEHOLDER_SPEAKER_NAME,
      role: entry.announced ? entry.role : '',
      talkTitle: entry.announced ? entry.talkTitle : '',
      shortBio: entry.announced ? entry.shortBio : '',
      bio: entry.announced ? entry.bio : '',
      photo: entry.announced ? entry.photo : null,
      link: entry.announced ? str(entry.link) : '',
      linkLabel: entry.announced ? str(entry.linkLabel) || 'Website' : '',
      order: entry.order ?? 0,
    }))
    .sort(byOrder);
});

export const getSpeaker = cache(async (slug: string): Promise<Speaker | null> => {
  const all = await getSpeakers();
  return all.find((s) => s.slug === slug) ?? null;
});

export const getSchedule = cache(async (): Promise<Schedule> => {
  const s = await reader.singletons.schedule.read();
  return { published: s?.published ?? false, items: [...(s?.items ?? [])] };
});

/** FAQ answers may write {capacity}; it is replaced with the seat capacity from Event basics. */
export const getFaq = cache(async (): Promise<FaqItem[]> => {
  const [f, s] = await Promise.all([reader.singletons.faq.read(), getSettings()]);
  return (f?.items ?? [])
    .filter((i) => i.question && i.answer)
    .map((i) => ({
      question: i.question.replaceAll('{capacity}', String(s.capacity)),
      answer: i.answer.replaceAll('{capacity}', String(s.capacity)),
    }));
});

export const getTeam = cache(async (): Promise<TeamMember[]> => {
  const entries = await reader.collections.team.all();
  return entries
    .map(({ slug, entry }) => {
      const visible = entry.showName && Boolean(str(entry.name));
      return {
        slug,
        role: entry.role,
        name: visible ? str(entry.name) : null,
        photo: visible ? entry.photo : null,
        order: entry.order ?? 0,
      };
    })
    .sort(byOrder);
});

export const getTiers = cache(async (): Promise<Tier[]> => {
  const entries = await reader.collections.tiers.all();
  return entries
    .map(({ slug, entry }) => ({
      slug,
      name: entry.name,
      description: entry.description,
      amount: str(entry.amount),
      slots: entry.slots,
      order: entry.order ?? 0,
    }))
    .sort(byOrder);
});

export const getSponsors = cache(async (): Promise<Sponsor[]> => {
  const entries = await reader.collections.sponsors.all();
  return entries
    .filter((e) => e.entry.published)
    .map(({ slug, entry }) => ({
      slug,
      name: entry.name,
      tier: entry.tier,
      logo: entry.logo,
      url: str(entry.url),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

export const getPartnerBenefits = cache(async (): Promise<PartnerBenefit[]> => {
  const b = await reader.singletons.benefits.read();
  return (b?.items ?? [])
    .map((i) => ({ benefit: str(i.benefit), tiers: [...i.tiers] }))
    .filter((i) => i.benefit);
});

export const getTedLanguage = cache(async (): Promise<TedLanguage> => {
  const t = await reader.singletons.tedLanguage.read();
  return { aboutTedx: str(t?.aboutTedx), aboutTed: str(t?.aboutTed) };
});

/** Splits multi-paragraph plain text (blank-line separated) into paragraphs. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
