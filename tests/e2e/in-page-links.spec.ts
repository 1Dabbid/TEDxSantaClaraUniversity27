import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { publishedSpeakers } from './helpers';

/*
 * Links that stay on the page being shown (src/motion/inPage.ts): section jumps
 * such as Tickets on the home page, and the page's own link in the header, the
 * footer and the menu. They must work whatever query string the address carries
 * (shared and campaign links arrive as /?utm_source=… or /?fbclid=…), with motion
 * on and off, with a mouse and on a phone. Back and Forward must move the page,
 * not only the address, and a link back to the top takes the #section out of the
 * address. Also here: the reader's place when motion is switched off or back on
 * away from a deep link, the scroll cue, the speaker-page breadcrumb with a
 * mouse, and the boot script's ?perf rule.
 */

const QUERY = '?utm_source=x';

// The class `motion` on <html> (not `reduce-motion`).
const MOTION = /(^|\s)motion(\s|$)/;
const NO_MOTION = /^(?!(.*\s)?motion(\s|$))/;

const SETUPS = [
  { name: 'desktop, motion on', viewport: { width: 1440, height: 900 }, touch: false, reducedMotion: 'no-preference' },
  { name: 'desktop, reduced motion', viewport: { width: 1440, height: 900 }, touch: false, reducedMotion: 'reduce' },
  { name: 'phone, motion on', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
  { name: 'phone, reduced motion', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'reduce' },
] as const;
type Setup = (typeof SETUPS)[number];

async function open(browser: Browser, setup: Setup, url: string): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: setup.viewport,
    hasTouch: setup.touch,
    isMobile: setup.touch,
    reducedMotion: setup.reducedMotion,
  });
  const page = await ctx.newPage();
  await page.goto(url);
  // The tier under test really is the one running.
  const motion = setup.reducedMotion === 'no-preference';
  await expect(page.locator('html')).toHaveClass(motion ? MOTION : NO_MOTION);
  if (motion) await expect(page.locator('html')).toHaveAttribute('data-smooth-scroll', 'true');
  await page.waitForTimeout(600);
  return page;
}

const press = (setup: Setup, link: Locator) => (setup.touch ? link.tap() : link.click());

/** How far the section's top edge is from the line a jump lands on (html scroll-padding-top), in px. */
const offBy = (page: Page, id: string) =>
  page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return 99999; // the page that has it is still on its way
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    return Math.abs(Math.round(el.getBoundingClientRect().top - pad));
  }, id);

const address = (page: Page) => page.evaluate(() => location.pathname + location.search + location.hash);
const focusId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? '');
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

async function expectLanded(page: Page, id: string, url: string) {
  await expect.poll(() => offBy(page, id), { timeout: 9000 }).toBeLessThanOrEqual(1);
  // Still there once everything has settled (no late jump away).
  await page.waitForTimeout(500);
  expect(await offBy(page, id)).toBeLessThanOrEqual(1);
  expect(await address(page)).toBe(url);
  expect(await focusId(page)).toBe(id);
  await expect(page.locator('html')).not.toHaveClass(/nav-pending/);
}

async function expectTop(page: Page, url: string) {
  await expect.poll(() => scrollY(page), { timeout: 9000 }).toBe(0);
  expect(await address(page)).toBe(url);
  expect(await focusId(page)).toBe('main');
  await expect(page.locator('html')).not.toHaveClass(/nav-pending/);
}

for (const setup of SETUPS) {
  test.describe(`in-page links with a query string in the address: ${setup.name}`, () => {
    test('header Tickets scrolls to the section, keeps the query, moves focus', async ({ browser }) => {
      const page = await open(browser, setup, `/${QUERY}`);
      await press(setup, page.locator('header a[href="/#tickets"]'));
      await expectLanded(page, 'tickets', `/${QUERY}#tickets`);
      // Back returns to where the reader was, on the same address: the page moves too.
      await page.goBack();
      await expect.poll(() => address(page)).toBe(`/${QUERY}`);
      await expect.poll(() => scrollY(page), { timeout: 9000 }).toBe(0);
      // And Forward goes to the section again.
      await page.goForward();
      await expect.poll(() => address(page)).toBe(`/${QUERY}#tickets`);
      await expect.poll(() => offBy(page, 'tickets'), { timeout: 9000 }).toBeLessThanOrEqual(2);
      await page.context().close();
    });

    test('Back and Forward move the page between sections and the top (no query string)', async ({ browser }) => {
      const page = await open(browser, setup, '/');
      await press(setup, page.locator('header a[href="/#tickets"]'));
      await expectLanded(page, 'tickets', '/#tickets');
      // A second section, from a link inside the first (brought to the middle of the screen first).
      const faq = page.locator('#tickets a[href="#faq"]').first();
      await faq.evaluate((a) => a.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }));
      await page.waitForTimeout(1200);
      await press(setup, faq);
      await expectLanded(page, 'faq', '/#faq');

      // Back between two sections: the page is in the Tickets section again, well away from the FAQ.
      await page.goBack();
      await expect.poll(() => address(page)).toBe('/#tickets');
      await expect.poll(() => offBy(page, 'faq'), { timeout: 9000 }).toBeGreaterThan(300);
      expect(await scrollY(page)).toBeGreaterThan(1000);
      // Back to the address without a section: the top of the page.
      await page.goBack();
      await expect.poll(() => address(page)).toBe('/');
      await expect.poll(() => scrollY(page), { timeout: 9000 }).toBe(0);
      // Forward twice: Tickets, then the FAQ.
      await page.goForward();
      await expect.poll(() => address(page)).toBe('/#tickets');
      await expect.poll(() => scrollY(page), { timeout: 9000 }).toBeGreaterThan(1000);
      await page.goForward();
      await expect.poll(() => address(page)).toBe('/#faq');
      await expect.poll(() => offBy(page, 'faq'), { timeout: 9000 }).toBeLessThanOrEqual(2);
      await page.context().close();
    });

    // One test per address (plain, and with a query string): each opens one page and stays well inside the time budget.
    for (const [label, query] of [['no query string', ''], ['with a query string', QUERY]] as const) {
      test(`the logo goes to the top and takes the #section out of the address; Back returns to the section (${label})`, async ({ browser }) => {
        const page = await open(browser, setup, `/${query}`);
        await press(setup, page.locator('header a[href="/#tickets"]'));
        await expectLanded(page, 'tickets', `/${query}#tickets`);
        await press(setup, page.locator('header a[href="/"]').first());
        // A copied or shared address must not open at a section the page is not showing.
        await expectTop(page, `/${query}`);
        await page.goBack();
        await expect.poll(() => address(page)).toBe(`/${query}#tickets`);
        await expect.poll(() => scrollY(page), { timeout: 9000 }).toBeGreaterThan(1000);
        await page.goBack();
        await expect.poll(() => address(page)).toBe(`/${query}`);
        await expect.poll(() => scrollY(page), { timeout: 9000 }).toBe(0);
        await page.context().close();
      });
    }

    test('the hero Tickets button does the same, also with an fbclid', async ({ browser }) => {
      const page = await open(browser, setup, '/?fbclid=abc');
      await press(setup, page.locator('[data-hero] a[href="/#tickets"]'));
      await expectLanded(page, 'tickets', '/?fbclid=abc#tickets');
      await page.context().close();
    });

    test('footer Tickets and the logo, from the bottom of the page', async ({ browser }) => {
      const page = await open(browser, setup, `/${QUERY}`);
      const tickets = page.locator('footer a[href="/#tickets"]');
      await tickets.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await press(setup, tickets);
      await expectLanded(page, 'tickets', `/${QUERY}#tickets`);

      const logo = page.locator('footer a[href="/"]').first();
      await logo.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await press(setup, logo);
      // A link back to the top takes the section out of the address and keeps the query.
      await expectTop(page, `/${QUERY}`);
      await page.context().close();
    });

    test('a section link activated in the same breath as a jump of the page lands on its target', async ({ browser }) => {
      const page = await open(browser, setup, `/${QUERY}`);
      await page.waitForTimeout(1200);
      // The page is moved without the wheel (focus, a screen reader, the scrollbar) and the
      // link is activated before the scroll engine has heard of the new position.
      await page.locator('#tickets a[href="#faq"]').first().evaluate((a) => {
        a.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1 }));
      });
      await expectLanded(page, 'faq', `/${QUERY}#faq`);
      await page.context().close();
    });

    test('from another page with a query string, Tickets opens the home page on its section', async ({ browser }) => {
      const page = await open(browser, setup, `/venue${QUERY}`);
      await press(setup, page.locator('header a[href="/#tickets"]'));
      await expectLanded(page, 'tickets', '/#tickets');
      await page.context().close();
    });

    test('the footer link of the current page goes back to the top and moves focus to the content', async ({ browser }) => {
      const page = await open(browser, setup, `/venue${QUERY}`);
      const link = page.locator('footer nav a', { hasText: 'Venue' });
      await link.scrollIntoViewIfNeeded();
      await expect.poll(() => scrollY(page)).toBeGreaterThan(500);
      await page.waitForTimeout(400);
      await press(setup, link);
      await expectTop(page, `/venue${QUERY}`);
      await page.context().close();
    });
  });
}

for (const setup of SETUPS.filter((s) => s.touch)) {
  test(`mobile menu: the link of the current page closes the menu and goes to the top (${setup.name})`, async ({ browser }) => {
    const page = await open(browser, setup, `/venue${QUERY}`);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect.poll(() => scrollY(page)).toBeGreaterThan(800);
    await page.locator('[data-menu-toggle]').tap();
    const link = page.locator('[data-menu-panel] a', { hasText: 'Venue' });
    await expect(link).toBeVisible();
    await page.waitForTimeout(500);
    await link.tap();
    await expect(page.locator('html')).not.toHaveAttribute('data-menu-open', /.*/);
    await expectTop(page, `/venue${QUERY}`);
    await page.context().close();
  });
}

test.describe('switching motion off away from a deep link', () => {
  for (const setup of SETUPS.filter((s) => s.reducedMotion === 'no-preference')) {
    test(`the reader stays at the switch, not thrown back to the deep link (${setup.name})`, async ({ browser }) => {
      const page = await open(browser, setup, '/#tickets');
      await expect.poll(() => offBy(page, 'tickets'), { timeout: 9000 }).toBeLessThanOrEqual(2);
      await page.waitForTimeout(1500);
      // A screen reader's reading cursor and voice control move the page and activate
      // controls without any wheel, touch, key or mouse event.
      const toggle = page.locator('footer [data-motion-toggle]');
      await toggle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(600);
      expect(await offBy(page, 'tickets')).toBeGreaterThan(1000);
      await toggle.evaluate((el) => (el as HTMLElement).click());
      await expect(page.locator('html')).toHaveClass(NO_MOTION);
      await page.waitForTimeout(3500);
      await expect(toggle).toBeInViewport();
      expect(await offBy(page, 'tickets')).toBeGreaterThan(1000);
      await page.context().close();
    });

    test(`still on the deep link, the reader stays on its section (${setup.name})`, async ({ browser }) => {
      const page = await open(browser, setup, '/#tickets');
      await expect.poll(() => offBy(page, 'tickets'), { timeout: 9000 }).toBeLessThanOrEqual(2);
      await page.waitForTimeout(1500);
      await page.locator('footer [data-motion-toggle]').evaluate((el) => (el as HTMLElement).click());
      await expect(page.locator('html')).toHaveClass(NO_MOTION);
      await page.waitForTimeout(3500);
      expect(await offBy(page, 'tickets')).toBeLessThanOrEqual(2);
      await page.context().close();
    });
  }
});

test.describe('switching motion back on away from a deep link', () => {
  // Reduce motion was switched on in an earlier visit (the footer switch remembers it).
  async function openReduced(browser: Browser, setup: Setup): Promise<Page> {
    const ctx = await browser.newContext({ viewport: setup.viewport, hasTouch: setup.touch, isMobile: setup.touch, reducedMotion: 'no-preference' });
    await ctx.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('fp-test-seeded')) {
          localStorage.setItem('fp:reduce-motion', '1');
          sessionStorage.setItem('fp-test-seeded', '1');
        }
      } catch {
        /* about:blank */
      }
    });
    const page = await ctx.newPage();
    await page.goto('/#tickets');
    await expect(page.locator('html')).toHaveClass(NO_MOTION);
    await expect.poll(() => offBy(page, 'tickets'), { timeout: 9000 }).toBeLessThanOrEqual(2);
    await page.waitForTimeout(1500);
    return page;
  }

  for (const setup of SETUPS.filter((s) => s.reducedMotion === 'no-preference')) {
    test(`the reader stays at the switch, not thrown back to the deep link (${setup.name})`, async ({ browser }) => {
      const page = await openReduced(browser, setup);
      // Moved and activated without any wheel, touch, key or mouse event (a screen reader, voice control).
      const toggle = page.locator('footer [data-motion-toggle]');
      await toggle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(600);
      expect(await offBy(page, 'tickets')).toBeGreaterThan(1000);
      await toggle.evaluate((el) => (el as HTMLElement).click());
      await expect(page.locator('html')).toHaveClass(MOTION);
      await expect(page.locator('html')).toHaveAttribute('data-smooth-scroll', 'true');
      await page.waitForTimeout(3500);
      await expect(toggle).toBeInViewport();
      expect(await offBy(page, 'tickets')).toBeGreaterThan(1000);
      await page.context().close();
    });

    test(`a little way past the deep link, the reader is not put back on it (${setup.name})`, async ({ browser }) => {
      const page = await openReduced(browser, setup);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(300);
      await page.locator('footer [data-motion-toggle]').evaluate((el) => (el as HTMLElement).click());
      await expect(page.locator('html')).toHaveClass(MOTION);
      await page.waitForTimeout(3500);
      expect(await offBy(page, 'tickets')).toBeGreaterThan(100);
      await page.context().close();
    });

    test(`still on the deep link, the reader stays on its section (${setup.name})`, async ({ browser }) => {
      const page = await openReduced(browser, setup);
      await page.locator('footer [data-motion-toggle]').evaluate((el) => (el as HTMLElement).click());
      await expect(page.locator('html')).toHaveClass(MOTION);
      await page.waitForTimeout(3500);
      expect(await offBy(page, 'tickets')).toBeLessThanOrEqual(2);
      await page.context().close();
    });
  }
});

test.describe('hero scroll cue', () => {
  test('is there at rest, gone once scrolling has started, back at the top', async ({ browser }) => {
    const page = await open(browser, SETUPS[0], '/');
    const cue = page.locator('.scroll-cue');
    // After its intro (1.3 s delay, 0.8 s fade).
    await expect.poll(() => cue.evaluate((el) => getComputedStyle(el).opacity), { timeout: 9000 }).toBe('1');
    await expect(cue).toBeVisible();

    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 320);
    await expect.poll(() => scrollY(page), { timeout: 9000 }).toBeGreaterThan(250);
    // Not just transparent: an invisible link must not be clickable or in the tab order.
    await expect.poll(() => cue.evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');

    await page.mouse.wheel(0, -900);
    await expect.poll(() => scrollY(page), { timeout: 9000 }).toBe(0);
    await expect.poll(() => cue.evaluate((el) => getComputedStyle(el).opacity), { timeout: 9000 }).toBe('1');
    await expect(cue).toBeVisible();
    await page.context().close();
  });

  test('its scrim is a soft pool: no stop darker than needed, and it fades to nothing', async ({ browser }) => {
    const page = await open(browser, SETUPS[0], '/');
    const scrim = await page.locator('.scroll-cue').evaluate((el) => {
      const s = getComputedStyle(el, '::before');
      return { content: s.content, image: s.backgroundImage };
    });
    expect(scrim.content).not.toBe('none');
    const alphas = [...scrim.image.matchAll(/rgba\(0, 0, 0, ([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(alphas.length).toBeGreaterThanOrEqual(4);
    // 0.8 behind #b8b8b8 keeps 4.5:1 even on a white highlight; more than 0.85 reads as a black bar.
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.85);
    expect(Math.max(...alphas)).toBeGreaterThanOrEqual(0.78);
    expect(alphas.at(-1)).toBe(0);
    await page.context().close();
  });
});

test.describe('speaker page breadcrumb', () => {
  const height = (page: Page) =>
    page.locator('nav[aria-label="Breadcrumb"]').evaluate((el) => ({
      nav: Math.round(el.getBoundingClientRect().height),
      links: [...el.querySelectorAll('a')].map((a) => Math.round(a.getBoundingClientRect().height)),
    }));

  test('with a mouse it is as compact as on the other pages; on a phone the links are 44px', async ({ browser }) => {
    const slug = publishedSpeakers()[0]?.slug;
    test.skip(!slug, 'no speaker page is published');
    const speaker = (page: Page) => page.goto(`/speakers/${slug}?quality=static`);

    const mouse = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await mouse.goto('/venue?quality=static');
    const reference = await height(mouse);
    await speaker(mouse);
    const compact = await height(mouse);
    expect(compact.nav).toBe(reference.nav);
    expect(Math.max(...compact.links)).toBeLessThan(32);
    await mouse.context().close();

    const phone = await (
      await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    ).newPage();
    await speaker(phone);
    const touch = await height(phone);
    for (const h of touch.links) expect(h).toBeGreaterThanOrEqual(44);
    await phone.context().close();
  });
});

test.describe('boot script and the scene gate agree on the remembered slow scene', () => {
  test('the note is ignored under ?perf= as under ?quality=, and honoured otherwise', async ({ page }) => {
    // Every class added from the first script on, recorded as it is added: the GPU probe may
    // take `scene-likely` away again a moment later (a software renderer in tests).
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('fp:scene-slow', '1');
      } catch {
        /* about:blank */
      }
      const seen: string[] = [];
      (window as unknown as { __bootClasses: string[] }).__bootClasses = seen;
      const add = DOMTokenList.prototype.add;
      DOMTokenList.prototype.add = function (...tokens: string[]) {
        seen.push(...tokens);
        return add.apply(this, tokens);
      };
    });
    const boot = async (url: string) => {
      await page.goto('about:blank');
      await page.goto(url, { waitUntil: 'commit' });
      await page.waitForSelector('body', { state: 'attached' });
      await page.waitForTimeout(300);
      return page.evaluate(() => (window as unknown as { __bootClasses: string[] }).__bootClasses.join(' '));
    };
    expect(await boot('/')).toMatch(MOTION);
    expect(await boot('/')).not.toMatch(/scene-likely/);
    expect(await boot('/?utm_source=x')).not.toMatch(/scene-likely/);
    expect(await boot('/?quality=low')).toMatch(/scene-likely/);
    expect(await boot('/?perf=off')).toMatch(/scene-likely/);
    expect(await boot('/?utm_source=x&perf=slow')).toMatch(/scene-likely/);
  });
});
