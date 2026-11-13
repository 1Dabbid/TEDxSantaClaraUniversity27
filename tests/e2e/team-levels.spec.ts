import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { groupTeam, levelFromRole, resolveLevel } from '../../src/lib/team';

/**
 * How the board is grouped (src/lib/team.ts). Pure functions: no page needed.
 * Next year's editors only rename roles, so the automatic level must follow
 * the role's wording, and a hand-picked Level must win.
 */

test.describe('team levels', () => {
  test('the automatic level reads the role, as the editing guide describes it', () => {
    expect(levelFromRole('President')).toBe('president');
    expect(levelFromRole('Co-President')).toBe('president');
    expect(levelFromRole('  president ')).toBe('president');
    expect(levelFromRole('VP of Production')).toBe('executive');
    expect(levelFromRole('VP, Operations')).toBe('executive');
    expect(levelFromRole('Vice President of Finance')).toBe('executive');
    expect(levelFromRole('Vice-President, Operations')).toBe('executive');
    expect(levelFromRole('Director of Partnerships')).toBe('operations');
    expect(levelFromRole('Curator')).toBe('operations');
    // Only the start of the role counts: these need the Level field.
    expect(levelFromRole('Past President')).toBe('operations');
    expect(levelFromRole('Executive Assistant')).toBe('operations');
    expect(levelFromRole('Director of Executive Relations')).toBe('operations');
    expect(levelFromRole('VPN Administrator')).toBe('operations');
  });

  test('a chosen level wins, typed forgivingly; Automatic, blank or unknown falls back to the role', () => {
    expect(resolveLevel('executive', 'Treasurer')).toEqual({ level: 'executive', unknown: false });
    expect(resolveLevel(' Executive  Board ', 'Treasurer')).toEqual({ level: 'executive', unknown: false });
    expect(resolveLevel('OPERATIONS', 'VP of Finance')).toEqual({ level: 'operations', unknown: false });
    expect(resolveLevel('auto', 'VP of Finance')).toEqual({ level: 'executive', unknown: false });
    expect(resolveLevel(undefined, 'President')).toEqual({ level: 'president', unknown: false });
    expect(resolveLevel('', 'President')).toEqual({ level: 'president', unknown: false });
    expect(resolveLevel('chairperson', 'Director of Creative')).toEqual({ level: 'operations', unknown: true });
  });

  test('the real loader: an unknown hand-typed Level warns and follows the role, it never stops the build', () => {
    test.setTimeout(60_000);
    const root = process.cwd();
    const dir = mkdtempSync(join(tmpdir(), 'team-level-'));
    try {
      cpSync(join(root, 'content'), join(dir, 'content'), { recursive: true });
      cpSync(join(root, 'public/images/team'), join(dir, 'public/images/team'), { recursive: true });
      const file = join(dir, 'content/team/vp-of-finance.yaml');
      writeFileSync(file, `${readFileSync(file, 'utf8')}level: Executive\n`);
      const typo = join(dir, 'content/team/director-of-creative.yaml');
      writeFileSync(typo, `${readFileSync(typo, 'utf8')}level: chairperson\n`);
      const run = spawnSync(
        process.execPath,
        ['--conditions=react-server', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', join(root, 'scripts/check-content.mjs'), '--errors-only'],
        { cwd: dir, encoding: 'utf8' },
      );
      const out = `${run.stdout}${run.stderr}`;
      expect(out, out).not.toContain('ERROR');
      expect(run.status, out).toBe(0);
      // "Executive" is read as the executive board, silently; the typo is named, and the role decides.
      expect(out).not.toContain('vp-of-finance.yaml › Level');
      expect(out).toContain('director-of-creative.yaml › Level: "chairperson" is not a level, so the role decides (operations)');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
