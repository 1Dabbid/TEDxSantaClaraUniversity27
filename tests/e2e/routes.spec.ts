import { expect, test } from '@playwright/test';
import { SITE_URL, publicRoutes, publishedSpeakers, settle, watchProblems } from './helpers';

test.describe('every public route', () => {
  for (const route of publicRoutes()) {
    test(`${route}: 200, one h1, title, description, no console errors or failed requests`, async ({ page }) => {
      const problems = watchProblems(page);
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      expect((await page.title()).trim()).not.toBe('');
      const description = await page.locator('head meta[name="description"]').getAttribute('content');
      expect(description?.trim()).toBeTruthy();
      await settle(page);
      expect(problems.console, 'console errors').toEqual([]);
      expect(problems.failed, 'failed requests').toEqual([]);
    });
  }
});

test('unknown routes return the 404 page', async ({ request }) => {
  const res = await request.get('/this-clause-does-not-exist');
  expect(res.status()).toBe(404);
});

test('robots.txt disallows the admin', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toMatch(/^Disallow: \/keystatic$/m);
  expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});

test('sitemap lists the home page and /partners, and no unannounced speaker', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
  expect(xml).toContain(`<loc>${SITE_URL}/partners</loc>`);
  for (const s of publishedSpeakers()) {
    const listed = xml.includes(`<loc>${SITE_URL}/speakers/${s.slug}</loc>`);
    expect(listed, `/speakers/${s.slug} in sitemap`).toBe(s.announced);
  }
});

test.describe('speaker pages', () => {
  for (const s of publishedSpeakers()) {
    test(`/speakers/${s.slug} is ${s.announced ? 'indexable' : 'noindex'}`, async ({ request }) => {
      const html = await (await request.get(`/speakers/${s.slug}`)).text();
      const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';
      if (s.announced) expect(robots).not.toContain('noindex');
      else expect(robots).toContain('noindex');
    });
  }
});

test('/keystatic loads the admin app shell', async ({ page }) => {
  const res = await page.goto('/keystatic');
  expect(res?.status()).toBe(200);
  // Headers: the admin is never cached or indexed.
  expect(res?.headers()['x-robots-tag']).toContain('noindex');
  // No site chrome on the admin.
  await expect(page.locator('[data-site-header]')).toHaveCount(0);
  // The Keystatic UI renders its navigation with the configured brand and the singletons.
  await expect(page.getByText('TEDxSantaClaraUniversity').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Event basics' }).first()).toBeVisible();
});
