/**
 * Board levels: how the team is grouped on the home page and /team, top to
 * bottom like the club's own org chart. No server code here, so the admin
 * (keystatic.config.ts), the content loader and the pages can all import it.
 *
 * An entry's Level in the admin is "Automatic" unless an editor picks one;
 * Automatic reads the role: "President" (or "Co-President") is the president,
 * "VP of …", "Vice President …" or "Executive …" is the executive board, and
 * every other role (the directors) is operations. Renaming a role, adding one
 * or removing one never needs a code change.
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
  const r = role.trim().toLowerCase();
  const vice = /\b(vp|vice[\s-]*president|executive)\b/.test(r);
  if (/\bpresident\b/.test(r) && !vice) return 'president';
  if (vice) return 'executive';
  return 'operations';
}

/** A stored Level, forgiving: anything that is not one of the three levels counts as Automatic. */
export function resolveLevel(stored: unknown, role: string): TeamLevel {
  return typeof stored === 'string' && (TEAM_LEVELS as readonly string[]).includes(stored)
    ? (stored as TeamLevel)
    : levelFromRole(role);
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
