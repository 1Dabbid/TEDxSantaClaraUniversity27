import { expect, test, type Page } from '@playwright/test';

/*
 * Motion must never cost content. If the gsap chunk (gsap + ScrollTrigger +
 * SplitText, shared by the engine, the section moments and smooth scroll)
 * fails to load, the page drops `html.motion` straight away and everything is
 * visible as rendered: no waiting for the 3s CSS failsafe.
 */

/**
 * Fails the lazily loaded chunk that carries gsap, whatever its hashed name, every
 * time it is requested. `failed` resolves on the first failure; `lastFailure` is the
 * time of the latest one (the chunk loader retries a failed chunk once, a few hundred
 * ms later, and only then rejects the import).
 */
async function failGsapChunk(page: Page): Promise<{ failed: Promise<string>; lastFailure: () => number }> {
  let failed!: (url: string) => void;
  let last = 0;
  const done = new Promise<string>((r) => (failed = r));
  await page.route(/\/_next\/static\/chunks\/.*\.js(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (body.includes('scrollerProxy') && body.includes('autoSplit')) {
      await route.abort('failed');
      last = Date.now();
      return failed(route.request().url());
    }
    return route.fulfill({ response: res, body });
  });
  // Wrapped: an async function returning a bare promise would wait for it.
  return { failed: done, lastFailure: () => last };
}

/** Reveal targets and every element a section moment animates, with anything hidden on them. */
const MOMENTS = [
  '[data-reveal]',
  '[data-seat-count]',
  '[data-seat-dash]',
  '[data-seat-ruler] [data-seat-tick]',
  '[data-seat-ruler] [data-seat-label]',
  '#tickets [aria-current] svg',
  '[data-footer-date]',
  '[data-footer-dot]',
  '[data-ledger] > *',
  '[data-ledger] > * > *',
  '[data-cta-text]',
  '[data-speakers-title]',
  '[data-speakers-meta]',
  '[data-speakers-strip]',
  '[data-venue-plate] > *',
  '[data-venue-coord]',
  '[data-timeline-line]',
  '[data-sign-line]',
  '[data-sign-mark]',
  '[data-sign-text]',
  '[data-sign-rule]',
].join(', ');

const hiddenMoments = (page: Page) =>
  page.evaluate((sel) => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement | SVGElement>(sel))) {
      if (el.closest('.sr-only, [hidden]')) continue;
      let opacity = 1;
      let why = '';
      for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
        const s = getComputedStyle(n);
        opacity *= Number(s.opacity);
        if (s.visibility === 'hidden') why ||= 'visibility';
        if (s.transform !== 'none') {
          const m = new DOMMatrix(s.transform);
          if (Math.abs(m.a) < 0.05 || Math.abs(m.d) < 0.05) why ||= `transform ${s.transform}`;
        }
      }
      if (opacity < 0.99) why ||= `opacity ${opacity.toFixed(2)}`;
      if (why) out.push(`${el.tagName.toLowerCase()}[${Array.from(el.attributes).map((a) => a.name).filter((n) => n.startsWith('data-')).join(',')}]: ${why}`);
    }
    return out.slice(0, 20);
  }, MOMENTS);

for (const path of ['/', '/partners']) {
  test(`gsap chunk fails to load on ${path}: everything is visible within 1s`, async ({ page }) => {
    const { failed, lastFailure } = await failGsapChunk(page);
    await page.goto(path, { waitUntil: 'load' });
    await failed;
    // Motion goes off, and everything shows, within 1s of the final failed attempt
    // (without the fix motion stays on and only the CSS failsafe acts, after 3s).
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('motion')), { timeout: 2_500 }).toBe(false);
    const deadline = lastFailure() + 1_000;
    expect(Date.now(), 'motion off within 1s of the failure').toBeLessThanOrEqual(deadline);
    await expect.poll(() => hiddenMoments(page), { timeout: Math.max(100, deadline - Date.now()) }).toEqual([]);

    // Further down the page as well (nothing is armed later on).
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    expect(await hiddenMoments(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-reveals'))).toBe(false);
    // Chunk requests still in flight when the test ends must not fail it.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
}
