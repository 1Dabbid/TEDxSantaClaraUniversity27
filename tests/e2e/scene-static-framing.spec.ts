import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers';

/*
 * The static tier (src/components/SceneStills.tsx and the "Scene stills" block
 * in globals.css) chooses portrait or landscape frames by the same rule as the
 * live scene (src/scene/choreography.ts, portraitFraming). And on phones the
 * Theme clauses carry a soft scrim of their own, so the engraved lettering
 * does not show through the body copy.
 */

const stillRequests = (page: Page) => {
  const urls: string[] = [];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/stills/')) urls.push(u.pathname);
  });
  return urls;
};
const scrollToSection = (page: Page, id: string) =>
  page.evaluate((id) => {
    const el = document.querySelector(`[data-section="${id}"]`)!;
    const y = el.getBoundingClientRect().top + window.scrollY - innerHeight * 0.2;
    const lenis = (window as unknown as { __fpPerf?: { lenis?: { scrollTo: (y: number, o: object) => void } } }).__fpPerf?.lenis;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, id);
const plateImage = (page: Page, section: string) =>
  page.locator(`[data-section="${section}"]`).evaluate((el) => getComputedStyle(el, '::before').backgroundImage);

/** hero/theme frame and stage (speakers, schedule, venue) frame per window, as the live scene frames them. */
const WINDOWS = [
  // Desktop layout, and a phone on its side: the landscape move.
  { width: 1440, height: 900, opening: 'landscape', stage: 'landscape' },
  { width: 1024, height: 768, opening: 'landscape', stage: 'landscape' },
  { width: 844, height: 390, opening: 'landscape', stage: 'landscape' },
  // Narrower than the desktop layout, not taller than wide: the portrait move with the wide opening
  // (the microphone at the right beside the hero copy), so landscape hero and theme, portrait stage.
  { width: 1000, height: 900, opening: 'landscape', stage: 'portrait' },
  { width: 900, height: 600, opening: 'landscape', stage: 'portrait' },
  { width: 1023, height: 768, opening: 'landscape', stage: 'portrait' },
  // Taller than wide: the portrait move throughout.
  { width: 768, height: 1024, opening: 'portrait', stage: 'portrait' },
  { width: 390, height: 844, opening: 'portrait', stage: 'portrait' },
] as const;

test.describe('static tier: the stills follow the live scene’s framing rule', () => {
  for (const w of WINDOWS) {
    test(`${w.width}x${w.height}: ${w.opening} hero and theme, ${w.stage} stage frames`, async ({ page }) => {
      await page.setViewportSize({ width: w.width, height: w.height });
      const requested = stillRequests(page);
      await page.goto('/');
      await settle(page, 400);
      // The live scene agrees (the rule itself, as the page computes it).
      expect(requested).toEqual([`/stills/hero-${w.opening}.avif`]);
      await scrollToSection(page, 'schedule');
      await expect.poll(() => requested).toContain(`/stills/schedule-${w.stage}.avif`);
      expect(requested.filter((u) => u.includes('schedule-'))).toEqual([`/stills/schedule-${w.stage}.avif`]);
    });
  }

  test.describe('reduced motion (plates)', () => {
    test.use({ reducedMotion: 'reduce' });
    for (const w of WINDOWS) {
      test(`${w.width}x${w.height}: the plates are chosen the same way`, async ({ page }) => {
        await page.setViewportSize({ width: w.width, height: w.height });
        await page.goto('/');
        await settle(page, 300);
        for (const id of ['hero', 'theme']) expect(await plateImage(page, id), id).toContain(`/stills/${id}-${w.opening}`);
        for (const id of ['speakers', 'schedule', 'venue']) expect(await plateImage(page, id), id).toContain(`/stills/${id}-${w.stage}`);
      });
    }
  });

  test('the live scene uses the same rule (portrait move under 1024 px wide unless short and wide)', async ({ page }) => {
    test.setTimeout(180_000);
    for (const w of WINDOWS) {
      await page.setViewportSize({ width: w.width, height: w.height });
      await page.goto('/?quality=low&perf=off&scene-debug=1');
      await page.waitForFunction(() => !!(window as unknown as { __sceneSim?: unknown }).__sceneSim, null, { timeout: 60_000 });
      // Over Schedule the portrait move keeps the subject in the middle of the width, the landscape move at the right.
      const x = await page.evaluate(
        () => (window as unknown as { __sceneSim: { place: (js: number[]) => { barrel: number[] }[] } }).__sceneSim.place([3.5])[0].barrel[0],
      );
      if (w.stage === 'portrait') expect(x, `${w.width}x${w.height}`).toBeLessThan(0.58);
      else expect(x, `${w.width}x${w.height}`).toBeGreaterThan(0.6);
    }
  });
});

test.describe('phones: the Theme clauses have their own scrim', () => {
  test.describe.configure({ timeout: 90_000 });
  for (const size of [
    { width: 390, height: 844 },
    { width: 360, height: 780 },
  ]) {
    test(`${size.width}x${size.height}: a soft scrim behind the clauses, no wider page`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.goto('/');
      await settle(page, 300);
      const r = await page.locator('.theme-fine').evaluate((el) => {
        const s = getComputedStyle(el, '::before');
        const box = el.getBoundingClientRect();
        return {
          content: s.content,
          background: s.backgroundColor,
          mask: s.maskImage,
          zIndex: s.zIndex,
          // The scrim's box: the clauses' box widened by its (negative) insets.
          left: box.left + parseFloat(s.left),
          right: box.right - parseFloat(s.right),
          vw: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          layoutWidth: window.innerWidth,
        };
      });
      expect(r.content).not.toBe('none');
      // Dark enough to take the engraving down behind 13px text, and behind the text.
      const alpha = Number(/rgba?\(0, 0, 0(?:, ([\d.]+))?\)/.exec(r.background)?.[1] ?? 1);
      expect(alpha).toBeGreaterThanOrEqual(0.6);
      expect(r.zIndex).toBe('-1');
      // No visible edges: it fades out above and below and runs to both screen edges...
      expect(r.mask).toContain('linear-gradient');
      expect(r.left).toBeLessThanOrEqual(0.5);
      expect(r.right).toBeGreaterThanOrEqual(r.vw - 0.5);
      // ...and not past them: the page is no wider than the screen.
      expect(r.scrollWidth).toBe(size.width);
      expect(r.layoutWidth).toBe(size.width);
      await context.close();
    });
  }

  test('desktop: no such scrim (the pinned stage has its own)', async ({ page }) => {
    await page.goto('/');
    await settle(page, 300);
    expect(await page.locator('.theme-fine').evaluate((el) => getComputedStyle(el, '::before').content)).toBe('none');
  });
});
