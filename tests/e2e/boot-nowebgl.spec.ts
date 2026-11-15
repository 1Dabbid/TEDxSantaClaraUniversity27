import { expect, test, type Page } from '@playwright/test';

/*
 * A browser without WebGL (its own browser instance: the flags are launch options).
 * The boot script cannot know on the first visit, so the page starts in the motion
 * layout and falls back to static after the GPU probe; the deep link must still be
 * where the visitor lands. The probe leaves a note, and later visits start static.
 */

test.use({
  launchOptions: {
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--disable-3d-apis', '--disable-webgl'],
  },
});

const HASHES = ['speakers', 'venue', 'tickets', 'faq', 'newsletter'];

/** Distance of the target's top below the header's bottom edge, in px. */
const offset = (page: Page, id: string) =>
  page.evaluate((id) => {
    const top = document.getElementById(id)!.getBoundingClientRect().top;
    return Math.round(top - document.querySelector('[data-site-header]')!.getBoundingClientRect().bottom);
  }, id);

/** The <html> classes the boot script left, read before any other script has run. */
async function bootClasses(page: Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForSelector('body', { state: 'attached' });
  return page.evaluate(() => document.documentElement.className);
}

const gsapLoaded = (page: Page) =>
  page.evaluate(() => Array.isArray((window as unknown as { gsapVersions?: string[] }).gsapVersions));

test.describe('boot: no WebGL', () => {
  test('first visit: the page falls back to static and still lands on the deep link; later visits start static', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const id of HASHES) {
      await page.goto('about:blank');
      await page.goto(`/#${id}`);
      await expect(page.locator('html')).not.toHaveClass(/\bmotion\b/);
      await page.waitForTimeout(1200);
      expect(Math.abs(await offset(page, id)), `#${id}`).toBeLessThanOrEqual(100);
      // Start each deep link as a first visit again.
      if (id !== HASHES[HASHES.length - 1]) await page.evaluate(() => localStorage.clear());
    }
    // The probe left a note: the next page view never gets html.motion.
    expect(await page.evaluate(() => localStorage.getItem('fp:no-webgl'))).toBe('1');
    await page.goto('about:blank');
    expect(await bootClasses(page, '/#tickets')).not.toMatch(/\bmotion\b|scene-likely/);
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
    expect(Math.abs(await offset(page, 'tickets'))).toBeLessThanOrEqual(100);
    expect(await gsapLoaded(page)).toBe(false);
  });
});
