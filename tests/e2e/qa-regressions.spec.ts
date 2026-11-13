import { expect, test } from '@playwright/test';
import { settle } from './helpers';

/*
 * Regressions found in the pre-launch QA pass. Each test states the behaviour
 * that must hold.
 */

test.describe('first screen on a small phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test('name, theme, date, venue and both hero actions are visible without scrolling', async ({ page }) => {
    await page.goto('/');
    await settle(page, 1500);
    const hero = page.locator('[data-section="hero"]');
    const inView = async (sel: string) => {
      const box = await hero.locator(sel).first().boundingBox();
      expect(box, sel).not.toBeNull();
      expect(box!.y + box!.height, `${sel} bottom`).toBeLessThanOrEqual(740);
    };
    await inView('h1');
    await inView('time');
    await inView('a.btn[href="#speakers"]');
    await inView('a.btn:not([href="#speakers"])');
    await expect(hero.getByText('Locatelli Student Activity Center')).toBeInViewport();
  });
});

test('mailto links to the event inboxes carry a subject', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('a[href^="mailto:"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(h, h).toMatch(/[?&]subject=/);
});

test('print: no scene, no header controls, content visible', async ({ page }) => {
  await page.goto('/');
  await settle(page, 800);
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('nav[aria-label="Primary"]').evaluate((n) => getComputedStyle(n).display)).toBe('none');
  expect(await page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgb(255, 255, 255)');
  const h1 = page.locator('h1');
  expect(await h1.evaluate((e) => getComputedStyle(e).color)).toBe('rgb(0, 0, 0)');
  // The tall pinned runways collapse to their content.
  const runway = await page.locator('[data-section="theme"]').evaluate((s) => s.getBoundingClientRect().height);
  expect(runway).toBeLessThan(page.viewportSize()!.height * 2);
});

test.describe('speakers stage (desktop, motion)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the card strip ignores the pointer until it has risen into view', async ({ page }) => {
    await page.goto('/');
    await settle(page, 1500);
    const ok = await page.evaluate(() => document.documentElement.classList.contains('motion'));
    test.skip(!ok, 'motion is off in this browser');
    await page.evaluate(() => {
      const s = document.querySelector<HTMLElement>('[data-section="speakers"]')!;
      window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY + 10);
    });
    const strip = page.locator('[data-speakers-strip]');
    await expect.poll(() => strip.evaluate((e) => getComputedStyle(e).pointerEvents), { timeout: 5000 }).toBe('none');
    await page.evaluate(() => {
      const s = document.querySelector<HTMLElement>('[data-section="speakers"]')!;
      const r = s.getBoundingClientRect();
      window.scrollTo(0, r.top + window.scrollY + 0.8 * (r.height - window.innerHeight));
    });
    await expect.poll(() => strip.evaluate((e) => getComputedStyle(e).pointerEvents), { timeout: 5000 }).toBe('auto');
  });
});
