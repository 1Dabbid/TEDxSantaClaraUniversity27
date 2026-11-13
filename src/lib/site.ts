import type { Settings } from './content';

export const SITE_URL = 'https://fineprint.tedxscu.com';
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

type Place = Pick<Settings, 'venueName' | 'venueCampus'>;

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
