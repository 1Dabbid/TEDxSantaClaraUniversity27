import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { contentValue } from './helpers';

/**
 * Google Analytics switched on: a second build with the made-up Measurement ID
 * G-TEST000000, served on PORT + 1 (playwright.config.ts). Every request that
 * would leave the machine is answered here (gtag.js with an empty script, anything
 * else is refused), so nothing reaches Google; what the site *would* send is read
 * from the queue it fills for gtag.js (window.dataLayer).
 *
 * Skipped with PW_SKIP_ANALYTICS=1 (the second build is then not made).
 */
const PORT = Number(process.env.PORT ?? 3100) + 1;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const ID = 'G-TEST000000';

test.skip(Boolean(process.env.PW_SKIP_ANALYTICS), 'PW_SKIP_ANALYTICS is set: no build with analytics on');
test.use({ baseURL: ORIGIN });

type Outside = { gtag: string[]; other: string[] };

/** Answers every off-site request locally and records it. Call before the first navigation. */
async function interceptOutside(context: BrowserContext): Promise<Outside> {
  const seen: Outside = { gtag: [], other: [] };
  await context.route(
    (url) => /^https?:$/.test(url.protocol) && url.origin !== ORIGIN,
    async (route) => {
      const url = route.request().url();
      if (url.startsWith('https://www.googletagmanager.com/gtag/js')) {
        seen.gtag.push(url);
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* test stand-in for gtag.js */' });
      } else {
        seen.other.push(url);
        await route.abort();
      }
    },
  );
  return seen;
}

type Command = unknown[];

/** Everything queued for gtag.js so far, as plain arrays. */
const queue = (page: Page): Promise<Command[]> =>
  page.evaluate(() => (window.dataLayer ?? []).map((entry) => JSON.parse(JSON.stringify(Array.from(entry as ArrayLike<unknown>)))));

const events = async (page: Page, name: string) =>
  (await queue(page)).filter((c) => c[0] === 'event' && c[1] === name).map((c) => c[2] as Record<string, string>);

/** Waits until the site has asked for gtag.js (it does so after load, at an idle moment). */
const scriptLoaded = (seen: Outside) => expect.poll(() => seen.gtag.length, { timeout: 20_000 }).toBe(1);

test.describe('analytics on (test Measurement ID)', () => {
  test('the site policy allows exactly the Google Analytics hosts; the admin policy does not', async ({ request }) => {
    const csp = (await request.get('/')).headers()['content-security-policy'] ?? '';
    const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';
    expect(directive('script-src')).toBe("script-src 'self' 'unsafe-inline' https://*.googletagmanager.com");
    expect(directive('img-src')).toBe("img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com");
    expect(directive('connect-src')).toBe(
      "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
    );
    // No advertising host (Google signals stays off), and nothing else changed.
    expect(csp).not.toMatch(/doubleclick|googleadservices|googlesyndication|www\.google\.com|\*\.google\.com/);
    expect(directive('frame-src')).not.toMatch(/google/);
    const admin = (await request.get('/keystatic')).headers()['content-security-policy'] ?? '';
    expect(admin).not.toMatch(/googletagmanager|google-analytics|analytics\.google/);
  });

  test('gtag.js is not in the HTML: it is requested once, after load, with privacy settings', async ({ page, context, request }) => {
    const html = await (await request.get('/')).text();
    expect(html).not.toContain('googletagmanager');

    const seen = await interceptOutside(context);
    let loaded = false;
    let requestedBeforeLoad = false;
    page.on('load', () => (loaded = true));
    page.on('request', (req) => {
      if (req.url().includes('googletagmanager.com') && !loaded) requestedBeforeLoad = true;
    });
    await page.goto('/');
    await scriptLoaded(seen);
    expect(requestedBeforeLoad).toBe(false);
    expect(seen.gtag[0]).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`);

    const q = await queue(page);
    expect(q.find((c) => c[0] === 'config')).toEqual([
      'config',
      ID,
      { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false },
    ]);
    expect(q.find((c) => c[0] === 'consent')).toEqual([
      'consent',
      'default',
      { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' },
    ]);
    // No user identifier, anywhere.
    expect(JSON.stringify(q)).not.toMatch(/user_id|client_id/);

    // Still once after moving around the site.
    await page.locator('header nav').getByRole('link', { name: 'Speakers' }).click();
    await expect(page).toHaveURL(/\/speakers$/);
    await page.waitForTimeout(1500);
    expect(seen.gtag).toHaveLength(1);
    expect(seen.other).toEqual([]);
  });

  test('never on the admin address', async ({ page, context }) => {
    const seen = await interceptOutside(context);
    // Without the GitHub variables the admin answers with the site's 404 page; with them, the admin has no site shell.
    await page.goto('/keystatic', { waitUntil: 'load' });
    await page.waitForTimeout(6000);
    expect(seen.gtag).toEqual([]);
    expect(await page.evaluate(() => typeof window.dataLayer)).toBe('undefined');
  });

  for (const signal of ['Global Privacy Control', 'Do Not Track'] as const) {
    test(`nothing is loaded or queued for a browser that sends ${signal}`, async ({ page, context }) => {
      const seen = await interceptOutside(context);
      await page.addInitScript((which) => {
        if (which === 'Global Privacy Control') Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true });
        else Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' });
      }, signal);
      await page.goto('/', { waitUntil: 'load' });
      await page.waitForTimeout(6000);
      await page.locator('header').getByRole('link', { name: /^Tickets/ }).click();
      expect(seen).toEqual({ gtag: [], other: [] });
      expect(await page.evaluate(() => [typeof window.dataLayer, typeof window.gtag, document.cookie])).toEqual(['undefined', 'undefined', '']);
    });
  }

  test('each page is counted once: #sections and query strings never add a page view', async ({ page, context }) => {
    await interceptOutside(context);
    await page.goto('/?quality=static&utm_source=flyer#venue');
    await expect.poll(() => events(page, 'page_view')).toHaveLength(1);
    const title = await page.title();
    // The address is reported without the #section and the QA switch; campaign tags stay.
    expect((await events(page, 'page_view'))[0]).toEqual({ page_location: `${ORIGIN}/?utm_source=flyer`, page_title: title });

    // In-page links add history entries (src/motion/inPage.ts) but are not pages.
    await page.locator('footer nav a[href="/#tickets"]').first().click();
    await expect(page).toHaveURL(/#tickets$/);
    await page.goBack();
    await page.goForward();
    await page.waitForTimeout(500);
    expect(await events(page, 'page_view')).toHaveLength(1);

    // A client-side navigation is a page.
    await page.locator('header nav').getByRole('link', { name: 'Speakers' }).click();
    await expect(page).toHaveURL(/\/speakers$/);
    await expect.poll(() => events(page, 'page_view')).toHaveLength(2);
    expect((await events(page, 'page_view'))[1]).toEqual({
      page_location: `${ORIGIN}/speakers`,
      page_title: await page.title(),
      page_referrer: `${ORIGIN}/?utm_source=flyer`,
    });
    expect(await page.title()).not.toBe(title);

    // Back is a visit to the home page again; the #section it lands on adds nothing.
    await page.goBack();
    await expect(page).toHaveURL(/\/\?quality=static&utm_source=flyer#tickets$/);
    await expect.poll(() => events(page, 'page_view')).toHaveLength(3);
    await page.waitForTimeout(500);
    const views = await events(page, 'page_view');
    expect(views).toHaveLength(3);
    expect(views[2].page_location).toBe(`${ORIGIN}/?utm_source=flyer`);
    // And the document was never reloaded: the queue is the same one throughout.
    expect((await queue(page)).filter((c) => c[0] === 'config')).toHaveLength(1);
  });

  test('ticket, mailing-list and interest-form clicks say where they were clicked', async ({ page, context }) => {
    const state = contentValue('tickets.yaml', 'ticketState').replace(/-/g, '_');
    const newsletter = contentValue('contact.yaml', 'newsletterUrl');
    const interest = contentValue('tickets.yaml', 'interestUrl');
    await interceptOutside(context);
    // Links to other sites open a new tab: close it, the click is what matters here.
    context.on('page', (popup) => void popup.close().catch(() => {}));

    await page.goto('/?quality=static');
    await page.locator('[data-section="hero"]').getByRole('link', { name: /^Tickets/ }).click();
    await expect.poll(() => events(page, 'ticket_click')).toEqual([{ place: 'hero', ticket_state: state }]);
    await page.locator('header').getByRole('link', { name: /^Tickets/ }).click();
    await expect.poll(() => events(page, 'ticket_click')).toHaveLength(2);
    expect((await events(page, 'ticket_click'))[1]).toEqual({ place: 'header', ticket_state: state });
    // A plain navigation link to the Tickets section is not a ticket click.
    await page.locator('footer nav a[href="/#tickets"]').first().click();
    await page.waitForTimeout(300);
    expect(await events(page, 'ticket_click')).toHaveLength(2);

    test.skip(!newsletter, 'no mailing-list link in content/contact.yaml');
    await page.locator(`[data-section="newsletter"] a[href="${newsletter}"]`).first().click();
    await page.locator(`footer a[href="${newsletter}"]`).first().click();
    await expect.poll(() => events(page, 'newsletter_click')).toEqual([{ place: 'newsletter' }, { place: 'footer' }]);

    // The closing band of a topic page.
    await page.goto('/venue?quality=static');
    await page.locator('section[aria-labelledby="next-title"]').getByRole('link', { name: /^Tickets/ }).click();
    await expect(page).toHaveURL(/\/#tickets$/);
    await expect.poll(() => events(page, 'ticket_click')).toEqual([{ place: 'closing_band', ticket_state: state }]);

    if (interest && contentValue('sections.yaml', 'showTeam') !== 'false') {
      await page.goto('/team?quality=static');
      await page.locator(`section[aria-labelledby="next-title"] a[href="${interest}"]`).click();
      await expect.poll(() => events(page, 'interest_form_click')).toEqual([{ place: 'closing_band' }]);
    }

    // Only the fixed words are sent: no link address, and never anything like an email address.
    const sent = JSON.stringify((await queue(page)).filter((c) => c[0] === 'event' && c[1] !== 'page_view'));
    expect(sent).not.toMatch(/https?:|@|mailto/);
  });

  test('a home-page section is reported once per visit, when it is actually reached', async ({ page, context }) => {
    await interceptOutside(context);
    await page.goto('/?quality=static');
    await expect.poll(() => events(page, 'page_view')).toHaveLength(1);
    await page.waitForTimeout(1500);
    // At the top only the hero is on screen, and the hero is not a "section reached".
    expect(await events(page, 'section_view')).toEqual([]);

    const show = (id: string) => page.evaluate((s) => document.getElementById(s)!.scrollIntoView({ block: 'start' }), id);
    await show('schedule');
    await expect.poll(() => events(page, 'section_view')).toEqual([{ section: 'schedule' }]);
    // A section that is only passed on the way (well under a second) does not count.
    await show('faq');
    await page.waitForTimeout(200);
    await show('schedule');
    await page.waitForTimeout(1500);
    expect(await events(page, 'section_view')).toEqual([{ section: 'schedule' }]);

    // Not again after a reload in the same visit.
    await page.reload();
    await show('schedule');
    await page.waitForTimeout(1800);
    expect(await events(page, 'section_view')).toEqual([]);
    await show('venue');
    await expect.poll(() => events(page, 'section_view')).toEqual([{ section: 'venue' }]);
  });

  test.describe('which version of the site the visitor got', () => {
    const tier = async (page: Page) =>
      (await queue(page))
        .filter((c) => c[0] === 'set' && c[1] === 'user_properties')
        .map((c) => (c[2] as { site_tier: string }).site_tier)
        .at(-1);

    test('static design', async ({ page, context }) => {
      await interceptOutside(context);
      await page.goto('/?quality=static');
      await expect.poll(() => tier(page)).toBe('static_stills');
    });

    test('motion design over still frames (no usable GPU in the test browser)', async ({ page, context }) => {
      await interceptOutside(context);
      await page.goto('/');
      await expect.poll(() => tier(page)).toBe('motion_stills');
    });

    test('motion design with the 3D scene', async ({ page, context }) => {
      await interceptOutside(context);
      await page.goto('/?quality=low');
      await expect.poll(() => tier(page)).toBe('motion_3d');
    });

    test.describe('reduced motion', () => {
      test.use({ reducedMotion: 'reduce' });
      test('is reported as such', async ({ page, context }) => {
        await interceptOutside(context);
        await page.goto('/');
        await expect.poll(() => tier(page)).toBe('reduced_motion');
      });
    });
  });

  test('nothing queued ever contains an email address', async ({ page, context }) => {
    await interceptOutside(context);
    context.on('page', (popup) => void popup.close().catch(() => {}));
    for (const route of ['/', '/faq', '/venue', '/team', '/partners']) {
      const response = await page.goto(`${route}?quality=static`);
      if (response?.status() !== 200) continue;
      await expect.poll(() => events(page, 'page_view')).toHaveLength(1);
      // Click every email link on the page (the handler must ignore them).
      for (const link of await page.locator('a[href^="mailto:"]').all()) {
        await link.evaluate((a) => {
          a.addEventListener('click', (e) => e.preventDefault(), { once: true });
          (a as HTMLElement).click();
        });
      }
      expect(JSON.stringify(await queue(page)), route).not.toMatch(/[^\s"@]+@[^\s"@]+\.[a-z]{2,}|mailto/i);
    }
  });
});
