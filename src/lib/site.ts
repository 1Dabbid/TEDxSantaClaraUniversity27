import type { Settings } from './content';

export const SITE_URL = 'https://fineprint.tedxscu.com';
export const SITE_NAME = 'TEDxSantaClaraUniversity';
/** The year-round club site. Fallback destination for partner enquiries. */
export const CLUB_URL = 'https://tedxscu.com';
/** TED's page about the TEDx program (linked from the footer). */
export const TEDX_PROGRAM_URL = 'https://www.ted.com/about/programs-initiatives/tedx-program';
/**
 * TEDx rules cap a standard licence at 100 attendees. Upper bound and default of
 * the "Seat capacity" field (Event basics); the site always reads the field
 * (`settings.capacity`), never this constant.
 */
export const TEDX_MAX_CAPACITY = 100;

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
 * Alt text for the shared Open Graph image, built from Event basics and Venue:
 * "TEDxSantaClaraUniversity: Fine Print. Friday, April 23, 2027, Locatelli
 * Student Activity Center, Santa Clara University."
 */
export function ogAlt(s: Pick<Settings, 'eventName' | 'themeName' | 'dateLong'> & Place): string {
  return `${s.eventName}: ${s.themeName}. ${s.dateLong}, ${venueLine(s)}.`;
}
