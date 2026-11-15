import { expect, test, type Page } from '@playwright/test';

/*
 * The tier is decided before first paint where it can be (boot script in
 * SiteShell), the reader's place survives the cases where it cannot (first visit
 * without WebGL) and a resize or rotation, and a scene that stays slow hands
 * over to the still frames.
 */

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

/** Section under the viewport centre and the fraction through it. */
const place = (page: Page) =>
  page.evaluate(() => {
    const c = innerHeight / 2;
    let out = { id: '', frac: -1 };
    document.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top <= c && r.bottom > c) out = { id: el.dataset.section!, frac: (c - r.top) / r.height };
    });
    return out;
  });

test.describe('boot: static tier decided before first paint', () => {
  test('?quality=static never gets html.motion, and deep links land on their section', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await bootClasses(page, '/?quality=static#tickets')).not.toMatch(/\bmotion\b|scene-likely/);
    for (const id of HASHES) {
      await page.goto('about:blank');
      await page.goto(`/?quality=static#${id}`);
      await page.waitForTimeout(1200);
      expect(Math.abs(await offset(page, id)), `#${id}`).toBeLessThanOrEqual(100);
      await expect(page.locator('html')).not.toHaveClass(/\bmotion\b/);
    }
  });

  test('a 2G connection or Save-Data: no html.motion, no layout shift, the motion engine is not downloaded', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { effectiveType: '2g', saveData: false, addEventListener() {} },
      });
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!e.hadRecentInput) w.__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    expect(await bootClasses(page, '/')).not.toMatch(/\bmotion\b|scene-likely/);
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);
    await expect(page.locator('html')).not.toHaveClass(/\bmotion\b/);
    expect(await gsapLoaded(page)).toBe(false);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });

  test('control: the default visit gets html.motion at boot and loads the engine', async ({ page }) => {
    expect(await bootClasses(page, '/')).toMatch(/\bmotion\b/);
    await expect.poll(() => gsapLoaded(page)).toBe(true);
  });

  test('?quality=low wins over reduced motion at boot, as it does in the tier', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await bootClasses(page, '/?quality=low&perf=off')).toMatch(/\bmotion\b/);
  });
});

test.describe('scroll engine: the reader keeps their place', () => {
  const park = (page: Page, id: string, frac: number) =>
    page.evaluate(
      ([id, frac]) => {
        const r = document.querySelector(`[data-section="${id}"]`)!.getBoundingClientRect();
        const y = r.top + window.scrollY + r.height * Number(frac) - innerHeight / 2;
        const lenis = (window as unknown as { __fpPerf?: { lenis?: { scrollTo: (y: number, o: object) => void } } }).__fpPerf?.lenis;
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo(0, y);
      },
      [id, frac] as const,
    );

  async function expectPlace(page: Page, id: string, frac: number, label: string) {
    await expect.poll(async () => (await place(page)).id, { message: label }).toBe(id);
    await expect
      .poll(async () => Math.abs((await place(page)).frac - frac), { message: label })
      .toBeLessThan(0.06);
  }

  test('window resize mid-page (motion tier): same section, same fraction, and back', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?perf');
    await expect(page.locator('html')).toHaveClass(/lenis/);
    await page.waitForTimeout(1500);
    await park(page, 'schedule', 0.5);
    await expectPlace(page, 'schedule', 0.5, 'parked');
    const y0 = await page.evaluate(() => Math.round(scrollY));
    for (const [width, height] of [[1280, 720], [1920, 1080], [1000, 900]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(1600);
      await expectPlace(page, 'schedule', 0.5, `${width}x${height}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1600);
    await expectPlace(page, 'schedule', 0.5, 'back at 1440x900');
    expect(Math.abs((await page.evaluate(() => Math.round(scrollY))) - y0)).toBeLessThanOrEqual(4);
  });

  test('phone rotation mid-page (motion tier): rotate and rotate back returns to the same spot', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto('/?perf');
    await expect(page.locator('html')).toHaveClass(/lenis/);
    await page.waitForTimeout(1500);
    await park(page, 'venue', 0.4);
    await expectPlace(page, 'venue', 0.4, 'parked');
    const y0 = await page.evaluate(() => Math.round(scrollY));
    for (let i = 0; i < 2; i++) {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(1600);
      await expectPlace(page, 'venue', 0.4, 'landscape');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(1600);
      await expectPlace(page, 'venue', 0.4, 'portrait again');
      expect(Math.abs((await page.evaluate(() => Math.round(scrollY))) - y0)).toBeLessThanOrEqual(4);
    }
    await context.close();
  });

  test('a resize at the top of the page stays at the top', async ({ page }) => {
    await page.goto('/?perf');
    await expect(page.locator('html')).toHaveClass(/lenis/);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.waitForTimeout(1600);
    expect(await page.evaluate(() => Math.round(scrollY))).toBe(0);
  });
});

test.describe('scene: perf governor', () => {
  test('?perf=slow: a scene that stays slow at the last step hands over to the still frames', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?quality=low&perf=slow&scene-debug=1');
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 40_000 });
    // Steps down first, then gives up.
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem('fp:scene-slow')), { timeout: 60_000 })
      .toBe('1');
    expect(await page.evaluate(() => (window as unknown as { __scene: { step: number } }).__scene.step)).toBe(4);
    await expect(page.locator('.scene-gate')).toHaveAttribute('data-hidden', '');
    await expect(page.locator('html')).not.toHaveClass(/scene-(live|pending|likely)/);
    await expect(page.locator('[data-scene-stills]')).toBeVisible();
    await expect(page.locator('[data-scene-stills] [data-still="hero"]')).toBeVisible();
    // The scene has stopped drawing, and scrolling does not wake it.
    const frame = () => page.evaluate(() => (window as unknown as { __scene: { frame: number } }).__scene.frame);
    await page.waitForTimeout(500);
    const f0 = await frame();
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(1200);
    expect(await frame()).toBe(f0);
    // The motion tier itself stays on.
    await expect(page.locator('html')).toHaveClass(/\bmotion\b/);
    expect(errors).toEqual([]);
  });
});
