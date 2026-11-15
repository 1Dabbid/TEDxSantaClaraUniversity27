import { expect, test } from '@playwright/test';

/**
 * Layout and component details that sit over the scene: touch targets, the
 * footer's current-page link, the menu without JavaScript, the numbers a screen
 * reader hears, and the page-edge scrims.
 */

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } as const;

test.describe('touch targets on a phone', () => {
  test('footer links are 44px tall and stack 44px apart; the mouse layout stays compact', async ({ browser }) => {
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    await page.goto('/venue');
    const boxes = await page.locator('footer a:not([aria-label])').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { text: e.textContent?.trim() ?? '', h: Math.round(r.height), y: Math.round(r.y + scrollY) };
      }),
    );
    expect(boxes.length).toBeGreaterThan(8);
    for (const b of boxes) expect(b.h, b.text).toBeGreaterThanOrEqual(44);
    const site = await page.locator('footer nav a').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().y)));
    for (let i = 1; i < site.length; i++) expect(site[i] - site[i - 1]).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await ctx.close();
  });

  test('with a mouse the footer list keeps its 28px rows', async ({ page }) => {
    await page.goto('/venue');
    const h = await page.locator('footer nav a').first().evaluate((e) => Math.round(e.getBoundingClientRect().height));
    expect(h).toBe(28);
  });

  test('the home bands and the speaker breadcrumb offer 44px targets', async ({ browser }) => {
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    await page.goto('/');
    const home = await page
      .locator('main a.link-draw')
      .evaluateAll((els) => els.map((e) => ({ text: e.textContent?.trim() ?? '', h: Math.round(e.getBoundingClientRect().height) })));
    expect(home.length).toBeGreaterThan(1);
    for (const b of home) expect(b.h, b.text).toBeGreaterThanOrEqual(44);
    await page.goto('/speakers/speaker-01');
    for (const a of await page.locator('nav[aria-label="Breadcrumb"] a').all()) {
      expect((await a.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await ctx.close();
  });
});

test.describe('footer: the page you are on', () => {
  test('its link carries aria-current="page", the others none', async ({ page }) => {
    await page.goto('/schedule');
    const links = page.locator('footer nav a');
    await expect(links.filter({ hasText: 'Schedule' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('footer nav a[aria-current]')).toHaveCount(1);
    await page.goto('/');
    await expect(page.locator('footer nav a[aria-current]')).toHaveCount(0);
  });

  test('clicking it goes back to the top, also with reduced motion', async ({ browser }) => {
    for (const reducedMotion of ['reduce', 'no-preference'] as const) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion });
      const page = await ctx.newPage();
      await page.goto('/venue');
      const link = page.locator('footer nav a', { hasText: 'Venue' });
      await link.scrollIntoViewIfNeeded();
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
      await link.click();
      await expect.poll(() => page.evaluate(() => scrollY), { timeout: 7000 }).toBe(0);
      expect(new URL(page.url()).pathname).toBe('/venue');
      await ctx.close();
    }
  });
});

test.describe('mobile menu', () => {
  test('without JavaScript the dead toggle is replaced by a link to the footer list', async ({ browser }) => {
    const ctx = await browser.newContext({ ...phone, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/faq');
    await expect(page.locator('[data-menu-toggle]')).toBeHidden();
    const fallback = page.locator('[data-menu-nojs]');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('href', '#footer-site');
    await expect(page.locator('#footer-site')).toHaveCount(1);
    await fallback.click();
    await expect(page.locator('footer nav a').first()).toBeInViewport();
    await ctx.close();
  });

  test('with JavaScript only the toggle shows, and the links carry no section numbers', async ({ browser }) => {
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('[data-menu-nojs]')).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();
    const panel = page.locator('[data-menu-panel]');
    await expect(panel).toBeVisible();
    // The home page numbers its own sections (§ 02 Speakers); the menu must not number them differently.
    expect(await panel.locator('ul').innerText()).not.toMatch(/§|\d/);
    await ctx.close();
  });
});

test('speaker pages: "Nº" is hidden from screen readers, who get the plain number', async ({ page }) => {
  await page.goto('/speakers/speaker-01');
  const tree = await page.locator('main').ariaSnapshot();
  expect(tree).not.toContain('Nº');
  expect(tree).toContain('Speaker 1 ·');
});

test('partners on a phone: the figures never run into their headings', async ({ browser }) => {
  for (const width of [320, 360, 390, 430]) {
    const ctx = await browser.newContext({ ...phone, viewport: { width, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('/partners');
    const rows = await page.locator('#why-title ~ ol > li').evaluateAll((els) =>
      els.map((li) => {
        const range = document.createRange();
        range.selectNodeContents(li.querySelector('span')!);
        return { right: range.getBoundingClientRect().right, title: li.querySelector('h3')!.getBoundingClientRect().left };
      }),
    );
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) expect(r.title - r.right, `at ${width}px`).toBeGreaterThanOrEqual(8);
    // Every heading starts on the same line down the list.
    expect(new Set(rows.map((r) => Math.round(r.title))).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await ctx.close();
  }
});

test.describe('scrims over the scene (motion layout)', () => {
  test('touch tablets read the theme clauses at 13px, not 9px, and the stage still fits', async ({ browser }) => {
    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
    ]) {
      const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      await page.goto('/?quality=low');
      const info = await page.evaluate(() => {
        const fine = document.querySelector<HTMLElement>('[data-theme-fine]')!;
        const stage = document.querySelector<HTMLElement>('[data-theme-stage]')!;
        const inner = document.querySelector<HTMLElement>('.theme-stage-inner')!;
        return {
          coarse: matchMedia('(pointer: coarse)').matches,
          sticky: getComputedStyle(stage).position,
          sizes: [...fine.querySelectorAll('li')].map((li) => parseFloat(getComputedStyle(li).fontSize)),
          foot: parseFloat(getComputedStyle(fine.querySelector('[data-theme-foot]') ?? fine).fontSize),
          overflows: inner.scrollHeight > inner.clientHeight + 1,
          fineBottom: fine.offsetTop + fine.offsetHeight,
          innerHeight: inner.clientHeight,
          title: document.querySelector<HTMLElement>('#theme-title')!.offsetTop + document.querySelector<HTMLElement>('#theme-title')!.offsetHeight,
          fineTop: fine.offsetTop,
        };
      });
      expect(info.coarse).toBe(true);
      expect(info.sticky).toBe('sticky');
      for (const s of info.sizes) expect(s).toBeGreaterThanOrEqual(13);
      expect(info.foot).toBeGreaterThanOrEqual(11);
      expect(info.overflows).toBe(false);
      expect(info.fineBottom).toBeLessThanOrEqual(info.innerHeight);
      expect(info.fineTop).toBeGreaterThan(info.title);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await ctx.close();
    }
  });

  test('desktop: the hero floor leaves the microphone side open and the caption scrim hugs the caption', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?quality=low');
    const info = await page.evaluate(() => {
      const floor = getComputedStyle(document.querySelector('.hero-floor')!);
      const meta = document.querySelector<HTMLElement>('[data-speakers-meta]')!;
      const before = getComputedStyle(meta, '::before');
      return {
        mask: floor.maskImage,
        metaWidth: meta.getBoundingClientRect().width,
        scrimRight: meta.getBoundingClientRect().right - parseFloat(before.right),
        head: getComputedStyle(document.querySelector('.theme-head')!).display,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    // Fades out before the right third, where the microphone is.
    expect(info.mask).toContain('rgba(0, 0, 0, 0) 72%');
    expect(info.head).toBe('block');
    // The caption scrim is as wide as the caption, not the page: it ends left of the centre.
    expect(info.metaWidth).toBeLessThan(600);
    expect(info.scrimRight).toBeLessThan(720);
    expect(info.scrollWidth).toBeLessThanOrEqual(1440);
  });
});
