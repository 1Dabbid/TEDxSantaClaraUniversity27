import 'server-only';
import { cache } from 'react';
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';

/**
 * Typed content loader. Components never import Keystatic directly; they get
 * plain objects from here. Everything is read from /content at build time.
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

export type Settings = {
  eventName: string;
  themeName: string;
  themeTagline: string;
  themeStory: string;
  dateISO: string;
  /** "Friday, April 23, 2027" */
  dateLong: string;
  /** "Apr 23, 2027" */
  dateShort: string;
  doorsTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  mapUrl: string;
  directionsNotes: string;
  ticketState: TicketState;
  ticketUrl: string;
  ticketEmbedUrl: string;
  ticketPriceNote: string;
  speakerApplicationsState: ApplicationsState;
  speakerApplicationsUrl: string;
  newsletterUrl: string;
  contactEmail: string;
  partnershipsEmail: string;
  livestreamUrl: string;
  socials: Socials;
  accentColor: string;
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

export const PLACEHOLDER_SPEAKER_NAME = 'Speaker to be announced';

const ACCENT_FALLBACK = '#EB0028';

function formatDate(iso: string, style: 'long' | 'short'): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    ...(style === 'long'
      ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }),
  }).format(d);
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export const getSettings = cache(async (): Promise<Settings> => {
  const s = await reader.singletons.settings.readOrThrow();
  const dateISO = s.dateISO || '2027-04-23';
  return {
    ...s,
    dateISO,
    dateLong: formatDate(dateISO, 'long'),
    dateShort: formatDate(dateISO, 'short'),
    accentColor: /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : ACCENT_FALLBACK,
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

export const getFaq = cache(async (): Promise<FaqItem[]> => {
  const f = await reader.singletons.faq.read();
  return [...(f?.items ?? [])];
});

export const getTeam = cache(async (): Promise<TeamMember[]> => {
  const entries = await reader.collections.team.all();
  return entries
    .map(({ slug, entry }) => ({
      slug,
      role: entry.role,
      name: entry.showName && entry.name ? entry.name : null,
      photo: entry.showName ? entry.photo : null,
      order: entry.order ?? 0,
    }))
    .sort(byOrder);
});

export const getTiers = cache(async (): Promise<Tier[]> => {
  const entries = await reader.collections.tiers.all();
  return entries
    .map(({ slug, entry }) => ({
      slug,
      name: entry.name,
      description: entry.description,
      amount: entry.amount,
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
      url: entry.url,
    }));
});

/** Splits multi-paragraph plain text (blank-line separated) into paragraphs. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
