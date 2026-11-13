import { expect, test, type Page } from '@playwright/test';

/*
 * Headings never orphan punctuation onto a line of their own, and the line
 * reveal never changes where they break. Regression: at some laptop widths
 * "Questions, answered." ran a few pixels past its column and broke as
 * "Questions" / "," / "answered.".
 */

/** The visible text of each rendered line of every element matching `selector` (screen-reader copies ignored). */
function lines(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const out: Record<string, string[]> = {};
    document.querySelectorAll<HTMLElement>(sel).forEach((el, n) => {
      const rows: { y: number; t: string }[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('.sr-only')) continue;
        const text = node.textContent ?? '';
        for (let i = 0; i < text.length; i++) {
          if (!text[i].trim()) continue;
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const box = range.getBoundingClientRect();
          if (!box.height) continue;
          const mid = box.top + box.height / 2;
          let row = rows.find((r) => Math.abs(r.y - mid) < box.height / 2);
          if (!row) rows.push((row = { y: mid, t: '' }));
          row.t += text[i];
        }
      }
      out[el.id || `${sel}#${n}`] = rows.sort((a, b) => a.y - b.y).map((r) => r.t);
    });
    return out;
  }, selector);
}

const PUNCTUATION_ONLY = /^[\p{P}\s]+$/u;

for (const width of [1024, 1280, 1440, 1480, 1520, 1920]) {
  test(`FAQ heading at ${width}px: two lines, before and after its reveal`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const before = (await lines(page, '#faq-title'))['faq-title'];
    await page.locator('#faq-title').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const during = (await lines(page, '#faq-title'))['faq-title'];
    await page.waitForTimeout(2500);
    const after = (await lines(page, '#faq-title'))['faq-title'];
    expect(before).toEqual(['Questions,', 'answered.']);
    // Mid-reveal the lines are moving inside their masks, so only the orphan check applies.
    expect(during.filter((r) => PUNCTUATION_ONLY.test(r))).toEqual([]);
    expect(after).toEqual(['Questions,', 'answered.']);
  });
}

test('no heading on the home page has a line of punctuation only (desktop and phone)', async ({ page }) => {
  for (const width of [390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const all = await lines(page, 'h1, h2, h3');
    for (const [id, rows] of Object.entries(all)) {
      expect(rows.filter((r) => PUNCTUATION_ONLY.test(r)), `${id} at ${width}px: ${JSON.stringify(rows)}`).toEqual([]);
    }
  }
});
