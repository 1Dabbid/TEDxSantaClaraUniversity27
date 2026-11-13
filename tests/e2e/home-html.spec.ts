import { expect, test } from '@playwright/test';
import { eventFacts } from './helpers';

/** What the server HTML must say on its own: no JavaScript at all. */
test.describe('home page without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('states the event facts and the TEDx license line', async ({ page }) => {
    await page.goto('/');
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    // This year's facts come from content/ (Event basics, Venue), so re-theming needs no test edit.
    const facts = eventFacts();
    expect(text).toContain('TEDxSantaClaraUniversity');
    expect(text).toContain(facts.themeName);
    expect(text).toContain(facts.dateText);
    expect(text).toContain(facts.venueName);
    expect(text).toContain('This independent TEDx event is operated under license from TED.');
    await expect(page.getByRole('link', { name: /^Tickets/ }).first()).toBeVisible();
  });

  test('shows no sponsor logos', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    expect(html).not.toMatch(/\/images\/sponsors\//);
    expect(html).not.toMatch(/%2Fimages%2Fsponsors%2F/);
  });

  test('header nav anchors point at ids that exist', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page
      .locator('header nav a[href], footer nav a[href], #main a[href^="#"], #main a[href^="/#"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    const anchors = [...new Set(hrefs.filter((h) => h.includes('#')))];
    expect(anchors.length).toBeGreaterThan(3);
    const missing = await page.evaluate(
      (list) => list.filter((h) => !document.getElementById(decodeURIComponent(h.split('#')[1] ?? ''))),
      anchors,
    );
    expect(missing).toEqual([]);
  });
});
