import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { publishedSpeakers } from './helpers';

/*
 * The home page follows content state: what is not announced is said once,
 * briefly, and never linked to. These checks read the same YAML the editors
 * write, so they hold before and after announcements.
 */

const yaml = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const flag = (text: string, key: string) => new RegExp(`^${key}:\\s*true\\s*$`, 'm').test(text);

const schedulePublished = () => flag(yaml('content/schedule.yaml'), 'published');
const anyTeamName = () =>
  readdirSync(join(process.cwd(), 'content/team'))
    .filter((f) => f.endsWith('.yaml'))
    .some((f) => {
      const t = yaml(`content/team/${f}`);
      return flag(t, 'showName') && /^name:[ \t]*(?!''|""|$)\S/m.test(t);
    });

test.describe('home page follows content state (no JavaScript)', () => {
  test.use({ javaScriptEnabled: false });

  test('unannounced speakers are never linked; the lineup is said once', async ({ page }) => {
    await page.goto('/');
    const speakers = page.locator('[data-section="speakers"]');
    for (const s of publishedSpeakers().filter((x) => !x.announced)) {
      await expect(page.locator(`a[href="/speakers/${s.slug}"]`)).toHaveCount(0);
    }
    if (!publishedSpeakers().some((s) => s.announced)) {
      await expect(speakers.getByRole('heading', { level: 2 })).toHaveText(/to be announced/i);
      await expect(speakers.locator('.speaker-card')).toHaveCount(0);
      await expect(speakers.getByRole('link', { name: /mailing list/i })).toHaveCount(1);
    }
  });

  test('Schedule and Team appear in the nav only when they have content', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav[aria-label="Primary"]');
    await expect(nav.getByRole('link', { name: 'Schedule' })).toHaveCount(schedulePublished() ? 1 : 0);
    await expect(nav.getByRole('link', { name: 'Team' })).toHaveCount(anyTeamName() ? 1 : 0);
    await expect(page.locator('[data-section="team"]')).toHaveCount(anyTeamName() ? 1 : 0);
    // The schedule section always exists (the 3D journey keys off it).
    await expect(page.locator('[data-section="schedule"]')).toHaveCount(1);
  });

  test('the home page invites partners in text and links to /partners', async ({ page }) => {
    await page.goto('/');
    const band = page.locator('section[aria-labelledby="partner-band-title"]');
    await expect(band).toHaveCount(1);
    await expect(band.locator('a[href="/partners"]')).toHaveCount(1);
    await expect(band.locator('img')).toHaveCount(0);
  });
});
