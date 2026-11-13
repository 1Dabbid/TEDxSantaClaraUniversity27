/**
 * Date and time helpers. Everything is computed in one fixed timezone (the
 * venue's), never the build machine's, so a build in UTC or in Auckland writes
 * exactly the same dates as one in California.
 */

/** The venue's timezone. */
export const EVENT_TIME_ZONE = 'America/Los_Angeles';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats a "YYYY-MM-DD" calendar date. The date is read at noon UTC and
 * formatted in UTC, so it is the same calendar day on every machine.
 */
export function formatCalendarDate(iso: string, style: 'long' | 'medium' | 'short'): string {
  if (!ISO_DATE.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }, // Friday, April 23, 2027
    medium: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }, // Fri, Apr 23, 2027
    short: { month: 'short', day: 'numeric', year: 'numeric' }, // Apr 23, 2027
  };
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options[style] }).format(d);
}

/** "5:30 PM" -> { h: 17, m: 30 }; null for blank or malformed input. */
export function parseTime(time: string): { h: number; m: number } | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const m = Number(match[2]);
  if (hour < 1 || hour > 12 || m > 59) return null;
  const pm = match[3].toUpperCase() === 'PM';
  return { h: (hour % 12) + (pm ? 12 : 0), m };
}

/** UTC offset of `timeZone` at the instant `utcMs`, in minutes (e.g. -420 for PDT). */
function offsetMinutes(utcMs: number, timeZone: string): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(utcMs))
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = part?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0; // "GMT" alone means UTC+0
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatOffset(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/**
 * ISO 8601 date-time for a wall-clock time on a calendar date in the venue's
 * timezone, with the UTC offset that applies on that date (daylight saving
 * included): ("2027-04-23", 17, 30) -> "2027-04-23T17:30:00-07:00".
 * `addDays` moves the calendar date (for an end time after midnight).
 */
export function zonedDateTime(iso: string, h: number, m: number, addDays = 0, timeZone = EVENT_TIME_ZONE): string | null {
  const match = iso.match(ISO_DATE);
  if (!match) return null;
  // The wall-clock time read as if it were UTC, then corrected by the zone's offset.
  const wallAsUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + addDays, h, m);
  if (Number.isNaN(wallAsUtc)) return null;
  // Two passes so an offset change between the guess and the real instant is picked up.
  const first = offsetMinutes(wallAsUtc, timeZone);
  const offset = offsetMinutes(wallAsUtc - first * 60_000, timeZone);
  const day = new Date(wallAsUtc); // still the wall-clock fields, in UTC terms
  const date = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
  return `${date}T${pad(h)}:${pad(m)}:00${formatOffset(offset)}`;
}

/**
 * Start and end of the event for structured data. With a start time, ISO
 * date-times with the venue's offset; the end only when an end time is set (an
 * end time at or before the start is read as after midnight). Without a start
 * time, the plain date for both.
 */
export function eventDateTimes(iso: string, startTime: string, endTime: string): { startDate: string; endDate?: string } {
  const start = parseTime(startTime);
  if (!start) return { startDate: iso, endDate: iso };
  const startDate = zonedDateTime(iso, start.h, start.m) ?? iso;
  const end = parseTime(endTime);
  if (!end) return { startDate };
  const nextDay = end.h * 60 + end.m <= start.h * 60 + start.m ? 1 : 0;
  const endDate = zonedDateTime(iso, end.h, end.m, nextDay);
  return endDate ? { startDate, endDate } : { startDate };
}
