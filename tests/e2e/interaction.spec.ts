import { expect, test, type Page } from '@playwright/test';
import { horizontalOverflow, settle, watchProblems } from './helpers';

const canvas = (page: Page) => page.locator('canvas');
const motionOn = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('motion'));
const smoothScroll = (page: Page) => page.evaluate(() => document.documentElement.dataset.smoothScroll ?? null);

test.describe('mobile menu', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens, traps focus, closes on Escape', async ({ page }) => {
    await page.goto('/');
    await settle(page, 100);
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();

    const close = page.getByRole('button', { name: 'Close menu' });
    await expect(close).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator('[data-menu-panel]');
    await expect(panel).toBeVisible();
    const links = panel.locator('a[href]');
    const count = await links.count();
    expect(count).toBeGreaterThan(2);
    // Focus starts on the first link.
    await expect(links.first()).toBeFocused();

    // Tab around the ring (toggle + links) twice: focus never leaves it.
    const inRing = () =>
      page.evaluate(() => {
        const a = document.activeElement;
        return Boolean(a && (a.closest('[data-menu-panel]') || a.getAttribute('aria-controls')));
      });
    for (let i = 0; i < (count + 1) * 2; i++) {
      await page.keyboard.press('Tab');
      expect(await inRing(), `focus after ${i + 1} Tab presses`).toBe(true);
    }
    for (let i = 0; i < count + 1; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await inRing(), `focus after ${i + 1} Shift+Tab presses`).toBe(true);
    }
    // The page behind is inert while the menu is open.
    expect(await page.locator('#main').evaluate((m) => m.parentElement?.hasAttribute('inert'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    expect(await page.locator('#main').evaluate((m) => m.parentElement?.hasAttribute('inert'))).toBe(false);
  });

  test.describe('viewport crosses the lg breakpoint while it is open', () => {
    // A tablet in portrait, then rotated to landscape (the toggle is lg:hidden).
    test.use({ viewport: { width: 820, height: 1180 } });

    test('the menu closes and the page is usable again', async ({ page }) => {
      await page.goto('/');
      await settle(page, 300);
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.locator('[data-menu-panel]')).toBeVisible();
      const locked = () =>
        page.evaluate(() => ({
          inert: Boolean(document.getElementById('main')?.parentElement?.hasAttribute('inert')),
          overflow: document.documentElement.style.overflow,
          menuOpen: document.documentElement.hasAttribute('data-menu-open'),
          lenisStopped: document.documentElement.classList.contains('lenis-stopped'),
        }));
      expect((await locked()).inert).toBe(true);

      await page.setViewportSize({ width: 1180, height: 820 });
      await expect.poll(locked).toEqual({ inert: false, overflow: '', menuOpen: false, lenisStopped: false });

      // Wheel scrolling works again, and so do clicks on the page.
      await page.mouse.move(600, 400);
      await page.mouse.wheel(0, 1200);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
      await page.locator('main a[href]').first().click({ trial: true, timeout: 2_000 });
    });
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no canvas, nothing hidden for motion, native scroll', async ({ page }) => {
    await page.goto('/');
    await settle(page, 800);
    expect(await motionOn(page)).toBe(false);
    await expect(canvas(page)).toHaveCount(0);
    expect(await smoothScroll(page)).toBeNull();
    // Every reveal target is fully visible as rendered.
    const hidden = await page.locator('[data-reveal], [data-hero-seq], .hero-word').evaluateAll((els) =>
      els
        .filter((el) => {
          const s = getComputedStyle(el);
          return s.visibility === 'hidden' || Number(s.opacity) < 0.99;
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(hidden).toEqual([]);
    // Native scroll: a scroll lands immediately, no smoothing.
    await page.evaluate(() => window.scrollTo(0, 900));
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(900);
  });

  test('FAQ clauses toggle from the keyboard', async ({ page }) => {
    await page.goto('/');
    const details = page.locator('#faq details').first();
    const summary = details.locator('summary');
    await summary.focus();
    await expect(details).not.toHaveAttribute('open');
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator('.faq-answer')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(details).not.toHaveAttribute('open');
  });
});

test.describe('motion on', () => {
  test('default: smooth scroll and motion, no scene on a software GPU', async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto('/');
    await settle(page, 1500);
    expect(await motionOn(page)).toBe(true);
    expect(await smoothScroll(page)).toBe('true');
    // Headless Chromium renders WebGL with SwiftShader: sceneEnabled() keeps three.js away.
    await expect(canvas(page)).toHaveCount(0);
    expect(problems.console).toEqual([]);
  });

  test('?quality=static: no canvas, no motion', async ({ page }) => {
    await page.goto('/?quality=static');
    await settle(page, 1500);
    expect(await motionOn(page)).toBe(false);
    expect(await smoothScroll(page)).toBeNull();
    await expect(canvas(page)).toHaveCount(0);
  });

  test('?quality=low: the canvas mounts without console errors', async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto('/?quality=low');
    await expect(canvas(page)).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('.scene-canvas')).toHaveAttribute('aria-hidden', 'true');
    // Let it render a few frames on the software rasterizer.
    await page.waitForTimeout(1500);
    expect(problems.console).toEqual([]);
    expect(problems.failed).toEqual([]);
  });
});

/**
 * The click is dispatched with HTMLElement.click(): a Playwright pointer click
 * would first scroll the (sticky, possibly slid-away) header link into view and
 * change the very position under test.
 */
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`page transition / -> /partners -> back restores scroll (${reducedMotion === 'reduce' ? 'reduced motion' : 'motion on'})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    await settle(page, 300);
    const target = 1800;
    await page.evaluate((y) => window.scrollTo(0, y), target);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(target);
    await page.waitForTimeout(300);

    await page.evaluate(() => document.querySelector<HTMLAnchorElement>('header a[href="/partners"]')?.click());
    await page.waitForURL('**/partners');
    await expect(page.locator('h1')).toContainText(/./);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5_000 }).toBeLessThan(5);
    await page.waitForTimeout(800);

    await page.goBack();
    await page.waitForURL((u) => u.pathname === '/');
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5_000 })
      .toBeGreaterThan(target - 40);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(target + 40);
  });
}

test('back pressed while the transition curtain covers the page: scroll restoration keeps working', async ({ page }) => {
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
  const scrollTo = async (y: number) => {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await expect.poll(scrollY).toBe(y);
    await page.waitForTimeout(300);
  };
  await page.goto('/partners');
  await settle(page, 300);
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>('header a[href="/"]')?.click());
  await page.waitForURL((u) => u.pathname === '/');
  await page.waitForTimeout(1500);
  await scrollTo(2400);

  // Start a transition back to /partners, then press Back while the curtain is coming down.
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>('header a[href="/partners"]')?.click());
  await page.waitForTimeout(150);
  await page.goBack();
  await page.waitForURL('**/partners');
  // The curtain lifts and nothing is left pending.
  await expect
    .poll(() =>
      page.evaluate(() => ({
        curtain: getComputedStyle(document.querySelector('.curtain')!).visibility,
        pending: document.documentElement.classList.contains('nav-pending'),
        stopped: document.documentElement.classList.contains('lenis-stopped'),
      })),
    )
    .toEqual({ curtain: 'hidden', pending: false, stopped: false });
  // The route the visitor went back from is not pushed afterwards.
  await page.waitForTimeout(1200);
  expect(new URL(page.url()).pathname).toBe('/partners');

  // Positions are recorded again on this page, and restored on the next traversal.
  await scrollTo(1500);
  await page.goForward();
  await page.waitForURL((u) => u.pathname === '/');
  await expect.poll(scrollY, { timeout: 5_000 }).toBeGreaterThan(2400 - 40);
  await page.goBack();
  await page.waitForURL('**/partners');
  await expect.poll(scrollY, { timeout: 5_000 }).toBeGreaterThan(1500 - 40);
  expect(await scrollY()).toBeLessThan(1500 + 40);
});

test.describe('no horizontal overflow', () => {
  for (const width of [320, 390, 768, 1440]) {
    for (const route of ['/', '/partners']) {
      test(`${route} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await settle(page, 600);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await horizontalOverflow(page)).toEqual([]);
      });
    }
  }
});
