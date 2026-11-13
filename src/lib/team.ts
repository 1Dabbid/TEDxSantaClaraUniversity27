/**
 * Board levels: how the team is grouped on the home page and /team, top to
 * bottom like the club's own org chart. No server code here, so the admin
 * (keystatic.config.ts), the content loader and the pages can all import it.
 *
 * An entry's Level in the admin is "Automatic" unless an editor picks one;
 * Automatic reads the role, exactly as docs/EDITING.md and the admin's help
 * text describe it: a role that is just "President" (or "Co-President") is the
 * president, a role starting "VP" or "Vice President" is the executive board,
 * and every other role (the directors) is operations. Anything else (a
 * "Treasurer" on the executive board, say) is what the Level field is for.
 * Renaming a role, adding one or removing one never needs a code change.
 */

export const TEAM_LEVELS = ['president', 'executive', 'operations'] as const;
export type TeamLevel = (typeof TEAM_LEVELS)[number];

/** The admin's Level options, in the order they appear there. */
export const TEAM_LEVEL_OPTIONS = [
  { label: 'Automatic (from the role)', value: 'auto' },
  { label: 'President', value: 'president' },
  { label: 'Executive board', value: 'executive' },
  { label: 'Operations', value: 'operations' },
] as const;

/** The level a role falls under when Level is Automatic. */
export function levelFromRole(role: string): TeamLevel {
  const r = role.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^(co[\s-]*)?presidents?$/.test(r)) return 'president';
  if (/^(vp|vice[\s-]*president)\b/.test(r)) return 'executive';
  return 'operations';
}

/** Words an editor might type by hand for each level (lower case, spaces collapsed). */
const LEVEL_WORDS: Record<string, TeamLevel | 'auto'> = {
  auto: 'auto',
  automatic: 'auto',
  'automatic (from the role)': 'auto',
  president: 'president',
  presidents: 'president',
  executive: 'executive',
  'executive board': 'executive',
  exec: 'executive',
  operations: 'operations',
  ops: 'operations',
};

/**
 * A stored Level, forgiving: case, spaces and the admin's own labels are
 * accepted ("Executive board" means executive). Blank or Automatic follows the
 * role. Anything else also follows the role, and `unknown` is true so the
 * loader can warn about it instead of stopping the build.
 */
export function resolveLevel(stored: unknown, role: string): { level: TeamLevel; unknown: boolean } {
  const key = typeof stored === 'string' ? stored.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  const word = key ? LEVEL_WORDS[key] : 'auto';
  if (word && word !== 'auto') return { level: word, unknown: false };
  return { level: levelFromRole(role), unknown: !word };
}

export type TeamGroup<T> = { level: TeamLevel; label: string; members: T[] };

/**
 * People split into their levels, top level first, each keeping the order it
 * came in (the admin's Order field). Levels with nobody in them are left out.
 */
export function groupTeam<T extends { level: TeamLevel }>(members: T[]): TeamGroup<T>[] {
  return TEAM_LEVELS.map((level) => {
    const inLevel = members.filter((m) => m.level === level);
    const label =
      level === 'president' ? (inLevel.length > 1 ? 'Presidents' : 'President') : level === 'executive' ? 'Executive board' : 'Operations';
    return { level, label, members: inLevel };
  }).filter((g) => g.members.length > 0);
}
