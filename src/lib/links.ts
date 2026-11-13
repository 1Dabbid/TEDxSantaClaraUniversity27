import type { Settings } from './content';
import { CLUB_URL } from './site';

const PARTNER_SUBJECT = encodeURIComponent('Partnering with TEDxSantaClaraUniversity');

/** Where every "Become a partner" button points: the partnerships inbox, else tedxscu.com. */
export function partnerCta(s: Pick<Settings, 'partnershipsEmail'>) {
  if (s.partnershipsEmail) {
    return {
      href: `mailto:${s.partnershipsEmail}?subject=${PARTNER_SUBJECT}`,
      kind: 'email' as const,
      display: s.partnershipsEmail,
    };
  }
  return { href: CLUB_URL, kind: 'site' as const, display: 'tedxscu.com' };
}

/** Formats decimal degrees as 37.3496° N / 121.9390° W. */
export function formatCoordinate(value: number, axis: 'lat' | 'lng'): string {
  const hemi = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${Math.abs(value).toFixed(4)}° ${hemi}`;
}
