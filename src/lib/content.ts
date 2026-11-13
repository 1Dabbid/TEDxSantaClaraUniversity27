import 'server-only';
import { cache } from 'react';
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import {
  contentWarning,
  fillPlaceholders,
  isRealDate,
  isValidSlug,
  normalizeLink,
  requiredText,
  resolveThemeCopy,
  SLUG_MESSAGE,
  TIME_PATTERN,
} from './content-checks';
import { checkImage, findTeamPhoto } from './content-images';
import { formatCalendarDate } from './dates';
import {
  BENEFIT_GROUP_LABEL,
  CLASS_YEAR_MAX,
  CLASS_YEAR_MIN,
  type BenefitGroup,
  EMAIL_PATTERN,
  SITE_NAME,
  TED_LANGUAGE_DEFAULTS,
  TED_TEXT_MIN_LENGTH,
  TEDX_MAX_CAPACITY,
} from './site';
import type { ThemeCopy } from './theme-copy';

/**
 * Typed content loader. Components never import Keystatic directly; they get
 * plain objects from here. Everything is read from /content at build time.
 *
 * In the admin, "settings" is split into several smaller singletons (Event
 * basics, Venue, Tickets, Contact, Sections) so editors are not faced with one
 * giant form. `getSettings()` merges them back into the single `Settings`
 * object that every component receives.
 *
 * Editor mistakes never break the build or a page: bad links, images, slugs,
 * dates and times are dropped (or fixed when the intent is obvious) with a
 * warning naming the file and field; see src/lib/content-checks.ts. What still
 * stops the build (a file that is not valid YAML, a value the admin cannot
 * produce) is reported with the file, the field's admin label and the allowed
 * values (describeContentError below).
 */

/**
 * Fields whose value the loader below checks and repairs itself (links, times,
 * the event date, TED's texts, emails), so the lenient reader stays quiet about them.
 */
const LOADER_CHECKED = new Set([
  'mapUrl', 'ticketUrl', 'ticketEmbedUrl', 'speakerApplicationsUrl', 'newsletterUrl', 'livestreamUrl',
  'instagram', 'linkedin', 'youtube', 'tiktok', 'link', 'url',
  'doorsTime', 'talksTime', 'endTime', 'dateISO', 'aboutTedx', 'aboutTed', 'contactEmail', 'partnershipsEmail', 'classYear',
]);

type FieldNode = {
  kind?: string;
  formKind?: string;
  label?: string;
  options?: unknown;
  fields?: Record<string, FieldNode>;
  element?: FieldNode;
  reader?: { parse: (value: unknown) => unknown };
};

/**
 * A copy of an admin schema whose text, number and date fields do not throw when
 * a value fails the admin's own checks (a pattern, a length, a min/max). Keystatic's
 * reader enforces those at build time too, so a hand-edited value such as
 * "www.example.com" in a link field would otherwise stop the whole deploy. The raw
 * value is passed on instead, with a warning, and the loader repairs or drops it.
 * Select fields stay strict: an option the admin cannot produce is reported by
 * describeContentError.
 */
function lenientSchema(schema: Record<string, FieldNode>, file: string, labels: string[] = []): Record<string, FieldNode> {
  const wrap = (node: FieldNode, key: string, path: string[]): FieldNode => {
    if (node.kind === 'object' && node.fields) return { ...node, fields: lenientSchema(node.fields, file, path) };
    if (node.kind === 'array' && node.element) return { ...node, element: wrap(node.element, key, [...path, 'item']) };
    // Text fields report formKind 'slug'; uploads and rich content keep Keystatic's own handling.
    if (node.kind !== 'form' || node.options || !node.reader || (node.formKind && node.formKind !== 'slug')) return node;
    const parse = node.reader.parse;
    return {
      ...node,
      reader: {
        ...node.reader,
        parse(value: unknown) {
          try {
            return parse(value);
          } catch (err) {
            if (!(err instanceof Error) || err.name !== 'FieldDataError') throw err;
            const kept = typeof value === 'string' || typeof value === 'number' ? value : null;
            if (!LOADER_CHECKED.has(key)) {
              contentWarning(file, path.join(' › '), `${err.message.replace(/\.$/, '')}. The site uses the value as it is (or its built-in default); please fix it in the admin.`);
            }
            return kept;
          }
        },
      },
    };
  };
  return Object.fromEntries(
    Object.entries(schema).map(([key, node]) => [key, wrap(node, key, [...labels, node.label ?? key])]),
  );
}

const lenientConfig = {
  ...keystaticConfig,
  singletons: Object.fromEntries(
    Object.entries(keystaticConfig.singletons).map(([key, s]) => [
      key,
      { ...s, schema: lenientSchema(s.schema as unknown as Record<string, FieldNode>, `${s.path ?? `content/${key}`}.yaml`) },
    ]),
  ),
  collections: Object.fromEntries(
    Object.entries(keystaticConfig.collections).map(([key, c]) => [
      key,
      { ...c, schema: lenientSchema(c.schema as unknown as Record<string, FieldNode>, `${c.path ?? `content/${key}/*`}.yaml`) },
    ]),
  ),
} as unknown as typeof keystaticConfig;

const reader = createReader(process.cwd(), lenientConfig);

type SingletonKey = keyof typeof keystaticConfig.singletons;
type CollectionKey = keyof typeof keystaticConfig.collections;

/** content/<file>.yaml for a singleton. */
function singletonFile(key: SingletonKey): string {
  return `${keystaticConfig.singletons[key].path ?? `content/${key}`}.yaml`;
}
/** content/<dir>/<slug>.yaml for a collection entry. */
function entryFile(key: CollectionKey, slug: string): string {
  return `${(keystaticConfig.collections[key].path ?? `content/${key}/*`).replace(/\*$/, '')}${slug}.yaml`;
}

type SchemaNode = {
  kind?: string;
  label?: string;
  fields?: Record<string, SchemaNode>;
  element?: SchemaNode;
  options?: readonly { label: string; value: string }[];
};

/** "items.2.kind" -> the field's admin label (with the item number) and its select options, if any. */
function describeField(schema: Record<string, SchemaNode>, path: string): { label: string; options?: SchemaNode['options'] } {
  const labels: string[] = [];
  let node: SchemaNode | undefined = { kind: 'object', fields: schema };
  for (const part of path.split('.')) {
    if (node?.kind === 'array' && /^\d+$/.test(part)) {
      labels.push(`item ${Number(part) + 1}`);
      node = node.element;
    } else if (node?.kind === 'object' && node.fields) {
      node = node.fields[part];
      labels.push(node?.label ?? part);
    } else {
      labels.push(part);
      node = undefined;
    }
  }
  return { label: labels.join(' › ') || path, options: node?.options };
}

/**
 * Rewrites a Keystatic reader error so an editor can act on it: which file,
 * which form in the admin, which field (by its label), what values are allowed,
 * and where the undo instructions are.
 */
function describeContentError(err: unknown, file: string, adminLabel: string, schema: Record<string, SchemaNode>): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const lines: string[] = [`Content error in ${file} (in the admin: “${adminLabel}”).`];
  if (err instanceof Error && err.name === 'YAMLException') {
    lines.push(
      'This file is not valid YAML, usually after a hand edit on GitHub (a missing space after a colon, wrong indentation or an unclosed quote). The line and column are in brackets below:',
      raw,
    );
  } else if (raw.startsWith('Invalid data for')) {
    for (const line of raw.split('\n').slice(1)) {
      const m = /^([^:]+): (.*)$/.exec(line.trim());
      if (!m) {
        lines.push(`- ${line.trim()}`);
        continue;
      }
      const { label, options } = describeField(schema, m[1]);
      const allowed = options?.length ? ` Allowed values: ${options.map((o) => `${o.value} (“${o.label}”)`).join(', ')}.` : '';
      lines.push(`- ${label} (${m[1]}): ${m[2]}.${allowed}`);
    }
  } else {
    lines.push(raw);
  }
  const undo = 'undo the last edit of this file on GitHub: see docs/EDITING.md, “If the site fails to build after an edit”.';
  lines.push(err instanceof Error && err.name === 'YAMLException' ? `The admin cannot open this file until it is fixed: ${undo}` : `Fix the field in the admin and save, or ${undo}`);
  const out = new Error(lines.join('\n'));
  out.name = 'ContentError';
  return out;
}

async function readSingleton<K extends SingletonKey>(key: K) {
  const def = keystaticConfig.singletons[key];
  try {
    return await reader.singletons[key].read();
  } catch (err) {
    throw describeContentError(err, singletonFile(key), def.label, def.schema as unknown as Record<string, SchemaNode>);
  }
}

/**
 * Every entry of a collection whose slug is a valid page address. Entries with an
 * invalid slug (e.g. "Jane Doe!") are skipped with a warning, so routes and the
 * sitemap can never contain them. A broken entry names its own file.
 */
async function readCollection<K extends CollectionKey>(key: K) {
  const def = keystaticConfig.collections[key];
  const slugs = await reader.collections[key].list();
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      if (!isValidSlug(slug)) {
        contentWarning(
          entryFile(key, slug),
          'Slug',
          `"${slug}" is not a valid page address, so this entry is left out. ${SLUG_MESSAGE} Click Regenerate next to the slug in the admin.`,
        );
        return null;
      }
      try {
        const entry = await reader.collections[key].read(slug);
        return entry ? { slug, entry } : null;
      } catch (err) {
        throw describeContentError(err, entryFile(key, slug), `${def.label} › ${slug}`, def.schema as unknown as Record<string, SchemaNode>);
      }
    }),
  );
  return entries.filter((e) => e !== null);
}

/** A link field: normalised to an absolute https:// URL, or '' (hidden) with a warning. */
function link(value: string | null | undefined, file: string, field: string, kind: 'web' | 'instagram' = 'web'): string {
  const { url, note } = normalizeLink(value, kind);
  if (note) contentWarning(file, field, url ? `${note}. Please paste the full address in the admin.` : `${note}.`);
  return url;
}

/** A time such as "5:30 PM", or '' (shown as to be announced) with a warning. */
function time(value: string | null | undefined, field: string): string {
  const t = str(value);
  if (!t || TIME_PATTERN.test(t)) return t;
  contentWarning('content/settings.yaml', field, `"${t}" is not a time like 5:30 PM, so it is shown as to be announced.`);
  return '';
}

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
  /** Theme copy (The event > Theme copy): short theme-specific lines, defaults in src/lib/theme-copy.ts. */
  copy: ThemeCopy;
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
  /** null while the person has not agreed to be named; the fields below are then empty too. */
  name: string | null;
  /** "Mechanical Engineering", '' when not given. */
  major: string;
  /** 2029 (shown as "Class of 2029"), or null. */
  classYear: number | null;
  /** Their LinkedIn profile (https), '' when not given. */
  linkedin: string;
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

/**
 * A row of the partner benefits comparison. `tiers`: the slugs of the tiers that
 * include it; `details`: what each of those tiers gets, by slug ('' = a plain
 * "included"). `group` is the heading it sits under (BENEFIT_GROUP_LABEL).
 */
export type PartnerBenefit = {
  benefit: string;
  group: BenefitGroup;
  tiers: string[];
  details: Record<string, string>;
  toBeConfirmed: boolean;
};

export const PLACEHOLDER_SPEAKER_NAME = 'Speaker to be announced';

const ACCENT_FALLBACK = '#EB0028';
/** The last known event date, used only when the Event date field is not a real date. */
const DEFAULT_DATE = '2027-04-23';
function capacityOf(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? Math.min(v, TEDX_MAX_CAPACITY) : TEDX_MAX_CAPACITY;
}

function priceOf(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, 100) : null;
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

const str = (v: string | null | undefined) => (v ?? '').trim();

/**
 * An email address for `mailto:` links, or '' (the link is then hidden). The admin
 * already validates the field; this also covers hand-edited YAML, so a value such as
 * `a@b.co?bcc=x@evil.com` can never reach a link.
 */
function email(v: string | null | undefined, field: string): string {
  const e = str(v);
  if (EMAIL_PATTERN.test(e)) return e;
  console.warn(`content/contact.yaml: ignoring ${field} "${e}": not a plain email address.`);
  return '';
}

function coordinates(lat: string, lng: string, note: string) {
  const la = Number.parseFloat(lat);
  const lo = Number.parseFloat(lng);
  if (!lat || !lng || Number.isNaN(la) || Number.isNaN(lo)) return null;
  return { lat: la, lng: lo, note: str(note) };
}

export const getSettings = cache(async (): Promise<Settings> => {
  const [s, venue, tickets, contact, sections, themeCopy] = await Promise.all([
    readSingleton('settings'),
    readSingleton('venue'),
    readSingleton('tickets'),
    readSingleton('contact'),
    readSingleton('sections'),
    readSingleton('themeCopy'),
  ]);
  if (!s) throw new Error('content/settings.yaml is missing (Event basics in the admin). Restore it from the GitHub history.');
  const rawDate = str(s.dateISO);
  const dateISO = isRealDate(rawDate) ? rawDate : DEFAULT_DATE;
  if (rawDate !== dateISO) {
    contentWarning(
      'content/settings.yaml',
      'Event date',
      `"${rawDate}" is not a real calendar date, so the site shows ${DEFAULT_DATE} instead. Pick the date again in Event basics.`,
    );
  }
  const T = 'content/tickets.yaml';
  const C = 'content/contact.yaml';

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
    eventName: SITE_NAME,
    themeName: s.themeName,
    themeTagline: s.themeTagline,
    themeStory: s.themeStory,
    dateISO,
    dateLong: formatCalendarDate(dateISO, 'long'),
    dateMedium: formatCalendarDate(dateISO, 'medium'),
    dateShort: formatCalendarDate(dateISO, 'short'),
    doorsTime: time(s.doorsTime, 'Doors open at'),
    talksTime: time(s.talksTime, 'Talks start at'),
    endTime: time(s.endTime, 'Event ends at'),
    capacity: capacityOf(s.capacity),
    accentColor: /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : ACCENT_FALLBACK,

    venueName,
    venueCampus,
    venueAddress: [venueCampus, postal.street, cityLine].filter(Boolean).join('\n'),
    venuePostalAddress: postal,
    venueAddressLabel: str(venue?.addressLabel),
    venueCoordinates: coordinates(str(venue?.latitude), str(venue?.longitude), str(venue?.coordinatesNote)),
    mapUrl: link(venue?.mapUrl, 'content/venue.yaml', 'Map link'),
    venueNotes,

    // Theme copy (content/theme-copy.yaml); blank lines get the defaults in src/lib/theme-copy.ts.
    copy: resolveThemeCopy(themeCopy, {
      capacity: String(capacityOf(s.capacity)),
      date: formatCalendarDate(dateISO, 'long'),
      venue: venueName,
      campus: venueCampus || venueName,
      eventName: SITE_NAME,
    }),

    ticketState: tickets?.ticketState ?? 'coming-soon',
    ticketUrl: link(tickets?.ticketUrl, T, 'Ticket link'),
    ticketEmbedUrl: link(tickets?.ticketEmbedUrl, T, 'Ticket checkout embed link'),
    ticketPriceNote: str(tickets?.ticketPriceNote),
    ticketPrice: priceOf(tickets?.ticketPrice),
    ticketSaleStart: str(tickets?.ticketSaleStart),
    speakerApplicationsState: tickets?.speakerApplicationsState ?? 'coming-soon',
    speakerApplicationsUrl: link(tickets?.speakerApplicationsUrl, T, 'Speaker application link'),
    speakerApplicationsDeadline: str(tickets?.speakerApplicationsDeadline),

    newsletterUrl: link(contact?.newsletterUrl, C, 'Newsletter sign-up link'),
    contactEmail: email(contact?.contactEmail, 'contactEmail'),
    partnershipsEmail: email(contact?.partnershipsEmail, 'partnershipsEmail'),
    livestreamUrl: link(contact?.livestreamUrl, C, 'Livestream link'),
    socials: {
      instagram: link(contact?.socials.instagram, C, 'Social links › Instagram', 'instagram'),
      linkedin: link(contact?.socials.linkedin, C, 'Social links › LinkedIn'),
      youtube: link(contact?.socials.youtube, C, 'Social links › YouTube'),
      tiktok: link(contact?.socials.tiktok, C, 'Social links › TikTok'),
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
  const entries = await readCollection('speakers');
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
      photo: entry.announced ? checkImage(entry.photo, { file: entryFile('speakers', slug), field: 'Portrait' }) : null,
      link: entry.announced ? link(entry.link, entryFile('speakers', slug), 'Personal link') : '',
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
  const s = await readSingleton('schedule');
  return { published: s?.published ?? false, items: [...(s?.items ?? [])] };
});

/**
 * FAQ questions and answers may write {capacity}, {date}, {venue}, {campus} and
 * {eventName}; they are filled in from Event basics and Venue, so answers never go
 * stale when those change. An unknown {placeholder} is left as typed, with a warning.
 */
export const getFaq = cache(async (): Promise<FaqItem[]> => {
  const [f, s] = await Promise.all([readSingleton('faq'), getSettings()]);
  const values = {
    capacity: String(s.capacity),
    date: s.dateLong,
    venue: s.venueName,
    campus: s.venueCampus || s.venueName,
    eventName: s.eventName,
  };
  const fill = (text: string, n: number) => {
    const r = fillPlaceholders(text, values);
    for (const u of r.unknown) {
      contentWarning(
        'content/faq.yaml',
        `Questions › item ${n}`,
        `${u} is not a known placeholder (use {capacity}, {date}, {venue}, {campus} or {eventName}); it is shown as typed.`,
      );
    }
    return r.text;
  };
  return (f?.items ?? [])
    .filter((i) => str(i.question) && str(i.answer))
    .map((i, n) => ({ question: fill(i.question, n + 1), answer: fill(i.answer, n + 1) }));
});

/** A class year such as 2029, or null (hidden) with a warning when it is not a plausible year. */
function classYearOf(v: number | null | undefined, file: string): number | null {
  if (v === null || v === undefined) return null;
  if (Number.isInteger(v) && v >= CLASS_YEAR_MIN && v <= CLASS_YEAR_MAX) return v;
  contentWarning(file, 'Class year', `"${v}" is not a four-digit year like 2029, so the class year is hidden.`);
  return null;
}

/**
 * The board. Name, details and photo only for people who agreed to be named
 * (Show name publicly + a name); everyone else is just their role. No email
 * address or phone number is ever part of a team member.
 *
 * Photo: the uploaded Photo field, or, when it is empty, a file dropped in at
 * the path the admin itself would use: public/images/team/<slug>/photo.jpg (or
 * .jpeg, .png, .webp). Either way it goes through the same image checks.
 */
export const getTeam = cache(async (): Promise<TeamMember[]> => {
  const entries = await readCollection('team');
  return entries
    .map(({ slug, entry }) => {
      const visible = entry.showName && Boolean(str(entry.name));
      const file = entryFile('team', slug);
      const photo = str(entry.photo) || findTeamPhoto(slug);
      return {
        slug,
        role: entry.role,
        name: visible ? str(entry.name) : null,
        major: visible ? str(entry.major) : '',
        classYear: visible ? classYearOf(entry.classYear, file) : null,
        linkedin: visible ? link(entry.linkedin, file, 'LinkedIn profile') : '',
        photo: visible ? checkImage(photo, { file, field: 'Photo' }) : null,
        order: entry.order ?? 0,
      };
    })
    .sort(byOrder);
});

export const getTiers = cache(async (): Promise<Tier[]> => {
  const entries = await readCollection('tiers');
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
  const entries = await readCollection('sponsors');
  return entries
    .filter((e) => e.entry.published)
    .map(({ slug, entry }) => ({
      slug,
      name: entry.name,
      tier: entry.tier && isValidSlug(entry.tier) ? entry.tier : null,
      logo: checkImage(entry.logo, { file: entryFile('sponsors', slug), field: 'Logo', allowSvg: true }),
      url: link(entry.url, entryFile('sponsors', slug), 'Website'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const BENEFIT_GROUPS = Object.keys(BENEFIT_GROUP_LABEL) as BenefitGroup[];

/**
 * Partner benefits, grouped by heading (web, event, year) and in list order within
 * each. A tier picked twice for the same benefit keeps its first detail, with a warning.
 */
export const getPartnerBenefits = cache(async (): Promise<PartnerBenefit[]> => {
  const b = await readSingleton('benefits');
  const rows = (b?.items ?? []).map((i, n) => {
    const details: Record<string, string> = {};
    for (const inc of i.included ?? []) {
      const tier = inc.tier ?? '';
      if (!isValidSlug(tier)) continue;
      if (tier in details) {
        contentWarning(
          'content/benefits.yaml',
          `Benefits comparison › item ${n + 1} › Tiers that include it`,
          `${tier} is listed twice; the site uses the first one.`,
        );
        continue;
      }
      details[tier] = str(inc.detail);
    }
    const group: BenefitGroup = BENEFIT_GROUPS.includes(i.group as BenefitGroup) ? (i.group as BenefitGroup) : 'event';
    return { benefit: str(i.benefit), group, tiers: Object.keys(details), details, toBeConfirmed: Boolean(i.toBeConfirmed) };
  });
  return BENEFIT_GROUPS.flatMap((g) => rows.filter((r) => r.benefit && r.group === g));
});

/** The small print under the tiers on /partners (Partner benefits > Small print under the tiers). */
export const getPartnerNotes = cache(async (): Promise<string[]> => {
  const b = await readSingleton('benefits');
  return (b?.notes ?? []).map((t) => str(t)).filter(Boolean);
});

export const getTedLanguage = cache(async (): Promise<TedLanguage> => {
  const t = await readSingleton('tedLanguage');
  const pick = (value: string | undefined, key: keyof TedLanguage, label: string) => {
    const r = requiredText(value, TED_LANGUAGE_DEFAULTS[key], TED_TEXT_MIN_LENGTH);
    if (r.usedFallback) {
      contentWarning(
        'content/ted-language.yaml',
        label,
        'The text is empty or too short to be TED’s official text, so the footer shows the built-in copy. Paste the official text in the admin.',
      );
    }
    return r.text;
  };
  return { aboutTedx: pick(t?.aboutTedx, 'aboutTedx', 'About TEDx'), aboutTed: pick(t?.aboutTed, 'aboutTed', 'About TED') };
});

/** Splits multi-paragraph plain text (blank-line separated) into paragraphs. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
