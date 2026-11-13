import { expect, test } from '@playwright/test';
import { publicRoutes, settle } from './helpers';

/*
 * Accessibility regressions with motion ON (the default for a laptop with a
 * mouse). tests/e2e/a11y.spec.ts runs axe on the reduced-motion design; these
 * cover what only goes wrong while things move.
 */

// WCAG 1.4.12 overrides: line height 1.5, letter spacing 0.12em, word spacing 0.16em, paragraphs 2em apart.
const TEXT_SPACING =
  '*:not(.sr-only){line-height:1.5!important;letter-spacing:0.12em!important;word-spacing:0.16em!important}p{margin-bottom:2em!important}';

test('keyboard focus survives tabbing into a section that is still revealing (mailing list)', async ({ page }) => {
  await page.goto('/');
  await settle(page, 600);
  // The last FAQ question: the next Tab stop is the first link of the closing section, whose reveals have not run yet.
  await page.locator('[data-section="faq"] summary').last().focus();
  await page.keyboard.press('Tab');
  const next = page.locator('[data-section="newsletter"] a').first();
  await expect(next).toBeFocused();
  // Still focused once the reveals have finished.
  await page.waitForTimeout(2000);
  await expect(next).toBeFocused();
});

test('no link says "(opens in a new tab)" twice', async ({ page }) => {
  for (const route of publicRoutes()) {
    await page.goto(route);
    const doubled = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => (a.getAttribute('aria-label') ?? a.textContent ?? '').replace(/\s+/g, ' '))
        .filter((name) => (name.match(/opens in a new tab/gi) ?? []).length > 1),
    );
    expect(doubled, route).toEqual([]);
  }
});

test.describe('text spacing at 320px', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the width-fitted hero headline and long words stay on screen', async ({ page }) => {
    for (const route of ['/', '/partners']) {
      await page.goto(route);
      await page.addStyleTag({ content: TEXT_SPACING });
      await settle(page, 600);
      const outside = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out: string[] = [];
        const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          const el = n.parentElement;
          if (!n.textContent?.trim() || !el || el.closest('.sr-only, [aria-hidden="true"]')) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const r of Array.from(range.getClientRects())) {
            if (r.width > 1 && (r.right > vw + 1 || r.left < -1)) out.push(`${n.textContent.trim().slice(0, 30)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
          }
        }
        return out;
      });
      expect(outside, route).toEqual([]);
    }
  });
});
