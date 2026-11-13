import { expect, test } from '@playwright/test';
import { groupTeam, levelFromRole, resolveLevel } from '../../src/lib/team';

/**
 * How the board is grouped (src/lib/team.ts). Pure functions: no page needed.
 * Next year's editors only rename roles, so the automatic level must follow
 * the role's wording, and a hand-picked Level must win.
 */

test.describe('team levels', () => {
  test('the automatic level reads the role', () => {
    expect(levelFromRole('President')).toBe('president');
    expect(levelFromRole('Co-President')).toBe('president');
    expect(levelFromRole('VP of Production')).toBe('executive');
    expect(levelFromRole('Vice President of Finance')).toBe('executive');
    expect(levelFromRole('Vice-President, Operations')).toBe('executive');
    expect(levelFromRole('Executive Producer')).toBe('executive');
    expect(levelFromRole('Director of Partnerships')).toBe('operations');
    expect(levelFromRole('Curator')).toBe('operations');
  });

  test('a chosen level wins; Automatic, a missing or an unknown value falls back to the role', () => {
    expect(resolveLevel('executive', 'Treasurer')).toBe('executive');
    expect(resolveLevel('auto', 'VP of Finance')).toBe('executive');
    expect(resolveLevel(undefined, 'President')).toBe('president');
    expect(resolveLevel('board', 'Director of Creative')).toBe('operations');
  });

  test('groups come top level first, keep their order and skip empty levels', () => {
    const people = [
      { n: 'a', level: 'operations' as const },
      { n: 'b', level: 'president' as const },
      { n: 'c', level: 'operations' as const },
    ];
    const groups = groupTeam(people);
    expect(groups.map((g) => g.label)).toEqual(['President', 'Operations']);
    expect(groups[1].members.map((m) => m.n)).toEqual(['a', 'c']);
    expect(groupTeam([{ level: 'president' as const }, { level: 'president' as const }])[0].label).toBe('Presidents');
  });
});
