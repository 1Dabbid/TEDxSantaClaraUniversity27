import type { Settings } from './content';

/** This edition's address, used when the SITE_URL environment variable is not set. */
export const DEFAULT_SITE_URL = 'https://fineprint.tedxscu.com';

/**
 * The canonical origin (canonical links, share previews, robots.txt, sitemap,
 * structured data). Set SITE_URL at build time (Vercel > Settings > Environment
 * Variables, e.g. `https://seconddraft.tedxscu.com`) to change it without editing
 * code; anything that is not a plain https:// origin falls back to DEFAULT_SITE_URL.
 */
export function siteUrlFrom(value: string | undefined): string {
  const v = (value ?? '').trim().replace(/\/+$/, '');
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' && u.origin === v) return v;
  } catch {
    // not a URL: use the default
  }
  return DEFAULT_SITE_URL;
}

export const SITE_URL = siteUrlFrom(process.env.SITE_URL);
/**
 * The licensed event name, exactly as TED issued it. It is a constant, not
 * content: TEDx rules require the full name, never shortened or restyled, and it
 * can only change with a new licence. Every page reads `settings.eventName`,
 * which is always this value. The admin shows it read-only (Event basics).
 */
export const SITE_NAME = 'TEDxSantaClaraUniversity';
/** The year-round club site. Fallback destination for partner enquiries. */
export const CLUB_URL = 'https://tedxscu.com';
/** TED's page about the TEDx program (linked from the footer). */
export const TEDX_PROGRAM_URL = 'https://www.ted.com/about/programs-initiatives/tedx-program';
/** TED's home page (linked from the footer's "About TED" block). */
export const TED_URL = 'https://www.ted.com';
/**
 * TEDx rules cap a standard licence at 100 attendees. Upper bound and default of
 * the "Seat capacity" field (Event basics); the site always reads the field
 * (`settings.capacity`), never this constant.
 */
export const TEDX_MAX_CAPACITY = 100;

/** Schedule item kinds: the admin's options and the labels on the site are the same words. */
export const SCHEDULE_KIND_LABEL = { talk: 'Talk', break: 'Break', doors: 'Doors', other: 'Program' } as const;

/**
 * Headings of the partner benefits table (/partners), in this order. The admin's
 * "Heading" options use the same words; the site writes the event one with the
 * date ("At the April 23 event").
 */
export const BENEFIT_GROUP_LABEL = {
  web: 'On the website and in video',
  event: 'At the event',
  year: 'During the year',
} as const;
export type BenefitGroup = keyof typeof BENEFIT_GROUP_LABEL;

/**
 * TED's required "About TEDx" / "About TED" texts, as pasted from the TEDx
 * organizer guide. The footer must always carry them, so the loader falls back to
 * these when the admin fields are blank or too short to be the real text.
 */
export const TED_LANGUAGE_DEFAULTS = {
  aboutTedx:
    'In the spirit of ideas worth spreading, TEDx is a program of local, self-organized events that bring people together to share a TED-like experience. At a TEDx event, TEDTalks video and live speakers combine to spark deep discussion and connection in a small group. These local, self-organized events are branded TEDx, where x = independently organized TED event. The TED Conference provides general guidance for the TEDx program, but individual TEDx events are self-organized (subject to certain rules and regulations).',
  aboutTed:
    "TED is a nonprofit organization devoted to Ideas Worth Spreading. Started as a four-day conference in California 30 years ago, TED has grown to support its mission with multiple initiatives. The two annual TED Conferences invite the world's leading thinkers and doers to speak for 18 minutes or less. Many of these talks are then made available, free, at TED.com.",
} as const;
/** Shorter than this, a TED text cannot be the official wording (both are several sentences). */
export const TED_TEXT_MIN_LENGTH = 100;

/**
 * A plain email address, or blank. Used by the admin's email fields and again by
 * the content loader. No whitespace, `?`, `&` or `#` anywhere, so a value can never
 * add headers to the `mailto:` links built from it (e.g. `a@b.co?bcc=x@evil.com`).
 */
export const EMAIL_PATTERN = /^$|^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/;

/**
 * Whether search engines may index this build. Vercel sets `VERCEL_ENV` to
 * `production`, `preview` or `development`; only `production` is indexable, so
 * preview URLs never compete with the real site. Builds outside Vercel (no
 * `VERCEL_ENV`, e.g. `npm run build && npm run start` locally or in CI) count as
 * production. Read at build time. See docs/DEPLOY.md.
 */
export function isIndexable(env: string | undefined = process.env.VERCEL_ENV): boolean {
  return env === undefined || env === '' || env === 'production';
}

/** Cuts text to at most `max` characters at a word boundary, adding "…" when shortened. */
export function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

type Place =Pick<Settings, 'venueName' | 'venueCampus'>;

/** "Locatelli Student Activity Center, Santa Clara University" (campus omitted when blank). */
export function venueLine(s: Place): string {
  return [s.venueName, s.venueCampus].filter(Boolean).join(', ');
}

/** "100 seats" */
export function seatsLabel(capacity: number): string {
  return `${capacity} ${capacity === 1 ? 'seat' : 'seats'}`;
}

/**
 * The fact lines engraved on the 3D microphone, built from content in the same
 * capitals as src/scene/engraving.ts (THEME, DATE_LINE, VENUE_LINE, SEATS_LINE):
 * "FINE PRINT", "FRIDAY · APRIL 23 · 2027", "LOCATELLI STUDENT ACTIVITY CENTER",
 * "100 SEATS". Not used by the scene yet: see docs/NEXT-YEAR.md ("3D engraving").
 */
export function engravingLines(s: Pick<Settings, 'themeName' | 'dateLong' | 'venueName' | 'capacity'>) {
  const upper = (t: string) => t.toLocaleUpperCase('en-US');
  return {
    theme: upper(s.themeName),
    dateLine: upper(s.dateLong.split(/,\s*/).join(' · ')),
    venueLine: upper(s.venueName),
    seatsLine: upper(seatsLabel(s.capacity)),
  };
}

/**
 * Alt text for the shared Open Graph image, built from Event basics and Venue:
 * "TEDxSantaClaraUniversity: Fine Print. Friday, April 23, 2027, Locatelli
 * Student Activity Center, Santa Clara University."
 */
export function ogAlt(s: Pick<Settings, 'eventName' | 'themeName' | 'dateLong'> & Place): string {
  return `${s.eventName}: ${s.themeName}. ${s.dateLong}, ${venueLine(s)}.`;
}
