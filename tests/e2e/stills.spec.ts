import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers';

/**
 * Still frames of the 3D scene (src/components/SceneStills.tsx) for visitors
 * without the live canvas, and their hand-over to the canvas when it runs.
 */

const stack = (page: Page) => page.locator('[data-scene-stills]');
const layer = (page: Page, name: string) => page.locator(`[data-scene-stills] [data-still="${name}"]`);
const stillRequests = (page: Page) => {
  const urls: string[] = [];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/stills/')) urls.push(u.pathname);
  });
  return urls;
};
const display = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).display);
const plate = (page: Page, section: string) =>
  page.locator(`[data-section="${section}"]`).evaluate((el) => {
    const s = getComputedStyle(el, '::before');
    return { display: s.display, image: s.backgroundImage };
  });
/** Scroll so the section's top sits at a fraction of the viewport height. */
const scrollToSection = (page: Page, id: string, at = 0.2) =>
  page.evaluate(
    ([id, at]) => {
      const el = document.querySelector(`[data-section="${id}"]`)!;
      const y = el.getBoundingClientRect().top + window.scrollY - innerHeight * Number(at);
      const lenis = (window as unknown as { __fpPerf?: { lenis?: { scrollTo: (y: number, o: object) => void } } }).__fpPerf?.lenis;
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    },
    [id, at] as const,
  );

test.describe('scene stills', () => {
  test('default (software WebGL, motion on): the stack shows each section’s still, lazily', async ({ page }) => {
    const requested = stillRequests(page);
    await page.goto('/');
    await settle(page, 600);
    await expect(stack(page)).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/scene-(live|pending)/);
    // Decorative, no layout box of its own, under the content.
    await expect(stack(page)).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator('[data-scene-stills] img').evaluateAll((imgs) => imgs.every((i) => i.getAttribute('alt') === ''))).toBe(true);
    // Only the hero still is requested up front.
    expect(requested).toEqual(['/stills/hero-landscape.avif']);
    expect(await layer(page, 'hero').locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    // The next still is not rendered yet (content-visibility keeps its lazy image unrequested).
    expect(await layer(page, 'theme').evaluate((el) => getComputedStyle(el).contentVisibility)).toBe('hidden');

    await scrollToSection(page, 'theme', 0.2);
    await expect(layer(page, 'theme')).toHaveCSS('opacity', '1');
    await expect.poll(() => requested).toContain('/stills/theme-landscape.avif');
    await expect
      .poll(() => layer(page, 'theme').locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
      .toBe(true);
    // Stills further down are still untouched.
    expect(requested).not.toContain('/stills/venue-landscape.avif');
  });

  test('phones get the portrait frames', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const requested = stillRequests(page);
    await page.goto('/');
    await settle(page, 300);
    expect(requested).toEqual(['/stills/hero-portrait.avif']);
    await context.close();
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('no fixed stack: each section carries its still as a plate', async ({ page }) => {
      await page.goto('/');
      await settle(page, 300);
      expect(await display(page, '[data-scene-stills]')).toBe('none');
      for (const id of ['hero', 'theme', 'speakers', 'schedule', 'venue']) {
        const p = await plate(page, id);
        expect(p.display, id).toBe('block');
        expect(p.image, id).toContain(`/stills/${id}-landscape`);
      }
      expect((await plate(page, 'tickets')).display).toBe('none');
    });
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('the stills are in the server HTML and the hero still loads', async ({ page }) => {
      const requested = stillRequests(page);
      await page.goto('/');
      await page.waitForLoadState('load');
      await expect(stack(page)).toBeVisible();
      await expect(layer(page, 'hero')).toBeVisible();
      expect(requested).toContain('/stills/hero-landscape.avif');
    });
  });

  test('print: hidden', async ({ page }) => {
    await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
    await page.goto('/');
    expect(await display(page, '[data-scene-stills]')).toBe('none');
    expect((await plate(page, 'hero')).display).toBe('none');
  });

  test('only on the home page', async ({ page }) => {
    await page.goto('/partners');
    await expect(stack(page)).toHaveCount(0);
  });

  test('a scene that fails to load leaves the page and the stills intact', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let blocked = 0;
    // Abort the chunk that carries three.js, as a flaky network or a redeploy would.
    await page.route('**/_next/static/chunks/**', async (route) => {
      const res = await route.fetch();
      if ((await res.text()).includes('WebGLRenderer')) {
        blocked++;
        await route.abort('failed');
      } else {
        await route.fulfill({ response: res });
      }
    });
    await page.goto('/?quality=low');
    await expect.poll(() => blocked, { timeout: 20_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveTitle(/Something went wrong/);
    await expect(page.locator('#main')).toHaveCount(1);
    await expect(page.locator('header.site-header')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(stack(page)).toBeVisible();
    await expect(layer(page, 'hero')).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/scene-(live|pending)/);
    expect(errors.filter((e) => !/chunk|Loading|fetch/i.test(e))).toEqual([]);
  });

  test('live scene (?quality=high): the stills fade out once the canvas has drawn, the rest are never requested', async ({ page }) => {
    test.setTimeout(120_000);
    const requested = stillRequests(page);
    await page.goto('/?quality=high');
    await expect(page.locator('html')).toHaveClass(/scene-pending/, { timeout: 10_000 });
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
    // SwiftShader draws slowly: the hand-over waits for the canvas to fade up.
    await expect(page.locator('html')).toHaveClass(/scene-live/, { timeout: 60_000 });
    await expect(page.locator('html')).not.toHaveClass(/scene-pending/);
    await expect.poll(() => display(page, '[data-scene-stills]'), { timeout: 5000 }).toBe('none');
    // Scroll the whole stack's range: nothing below the hero is fetched.
    for (const id of ['theme', 'speakers', 'schedule', 'venue', 'team']) {
      await scrollToSection(page, id, 0.2);
      await page.waitForTimeout(200);
    }
    expect(requested.filter((u) => !u.startsWith('/stills/hero-'))).toEqual([]);
  });
});
