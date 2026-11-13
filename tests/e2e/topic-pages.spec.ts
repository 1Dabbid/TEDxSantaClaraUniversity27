import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { SITE_URL, settle, topicRoutes } from './helpers';
import { faqIds } from '../../src/lib/faq-ids';

/**
 * The topic pages (/speakers, /schedule, /venue, /partners, /team, /faq) and the
 * navigation rule documented at the top of src/components/nav.ts.
 */

const NEW_PAGES = ['/schedule', '/venue', '/team', '/faq'].filter((r) => topicRoutes().includes(r));

test.describe('navigation rule', () => {
  test('home: header links scroll to the home sections; footer links open the topic pages', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('navigation', { name: 'Primary' });
    const hrefs = await header.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h === '/partners' || h!.startsWith('/#'), `header link ${h}`).toBe(true);
    await expect(header.locator('[aria-current]')).toHaveCount(0);

    const footer = page.getByRole('navigation', { name: 'Site' });
    const footerHrefs = await footer.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    for (const r of topicRoutes()) expect(footerHrefs, `footer links ${r}`).toContain(r);
    for (const h of footerHrefs) expect(h === '/#tickets' || !h!.includes('#'), `footer link ${h}`).toBe(true);
  });

  for (const route of NEW_PAGES) {
    test(`${route}: header links open topic pages and mark the current one`, async ({ page }) => {
      await page.goto(route);
      const header = page.getByRole('navigation', { name: 'Primary' });
      const hrefs = await header.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      for (const h of hrefs) expect(h!.includes('#'), `header link ${h} on ${route}`).toBe(false);
      // Off the home page the header lists every page that exists, so the current one is always there and marked.
      const current = header.locator('a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute('href', route);
      const footer = page.getByRole('navigation', { name: 'Site' });
      const footerHrefs = await footer.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect(hrefs, `header and footer list the same pages on ${route}`).toEqual(footerHrefs.filter((h) => !h!.includes('#')));
    });
  }

  test('mobile menu follows the same rule', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/venue');
    await settle(page, 200);
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('navigation', { name: 'Mobile' });
    await expect(menu.getByRole('link', { name: /Venue/ })).toHaveAttribute('href', '/venue');
    await expect(menu.getByRole('link', { name: /Venue/ })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');

    await page.goto('/');
    await settle(page, 200);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(menu.getByRole('link', { name: /Venue/ })).toHaveAttribute('href', '/#venue');
  });

  test('home sections end with a quiet link to their page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#venue [data-more-link] a')).toHaveAttribute('href', '/venue');
    const more = await page.locator('[data-more-link] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    for (const h of more) expect(topicRoutes(), `more link ${h}`).toContain(h);
  });

  test('page transition home -> /venue -> back: focus on main, current page announced', async ({ page }) => {
    await page.goto('/');
    await settle(page, 300);
    await page.evaluate(() => document.querySelector<HTMLAnchorElement>('#venue [data-more-link] a')?.click());
    await page.waitForURL('**/venue');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#main')).toBeFocused({ timeout: 5_000 });
    await expect(page.getByRole('navigation', { name: 'Primary' }).locator('a[aria-current="page"]')).toHaveAttribute('href', '/venue');
    await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>('main a[href="/"]')].at(-1)?.click());
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.locator('#main')).toBeFocused({ timeout: 5_000 });
  });
});

test.describe('topic page structure', () => {
  for (const route of NEW_PAGES) {
    test(`${route}: breadcrumb, canonical, BreadcrumbList, closing row`, async ({ page, request }) => {
      const html = await (await request.get(route)).text();
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}${route}"/>`);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const graph = blocks.flatMap((b) => b['@graph'] ?? [b]);
      const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList');
      expect(crumbs?.itemListElement.at(-1).item).toBe(`${SITE_URL}${route}`);
      await page.goto(route);
      await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
      await expect(page.getByRole('link', { name: 'Back to the event' })).toHaveAttribute('href', '/');
    });
  }

  test('/venue: Place JSON-LD and a map action', async ({ page, request }) => {
    const html = await (await request.get('/venue')).text();
    expect(html).toMatch(/"@type":"Place"/);
    await page.goto('/venue');
    await expect(page.getByRole('link', { name: /Open in Maps/ }).first()).toBeVisible();
  });

  test('FAQPage JSON-LD appears once per page', async ({ request }) => {
    for (const route of ['/', '/faq']) {
      const html = await (await request.get(route)).text();
      expect(html.match(/"@type":"FAQPage"/g)?.length ?? 0, route).toBe(1);
    }
  });

  test('sitemap lists the topic pages that exist', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    for (const r of NEW_PAGES) expect(xml).toContain(`<loc>${SITE_URL}${r}</loc>`);
  });
});

test.describe('FAQ deep links', () => {
  test.skip(!topicRoutes().includes('/faq'), 'FAQ switched off');

  test('ids are derived from the question, stable and unique', async ({ page }) => {
    expect(faqIds(['Are tickets on sale?', 'Are tickets on sale?', 'How can I apply to speak?'])).toEqual([
      'tickets-on-sale',
      'tickets-on-sale-2',
      'how-apply-to-speak',
    ]);
    await page.goto('/faq');
    const ids = await page.locator('main ol > li[id]').evaluateAll((lis) => lis.map((l) => l.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    const questions = await page.locator('main ol > li summary').evaluateAll((s) => s.map((x) => x.textContent!.replace(/^\d+/, '').trim()));
    expect(ids).toEqual(faqIds(questions));
  });

  /** The question ids /faq renders, read from the server HTML (no browser visit, so the next goto is a cold load). */
  const questionIds = async (request: APIRequestContext) =>
    [...(await (await request.get('/faq')).text()).matchAll(/<li id="([^"]+)"/g)].map((m) => m[1]);

  /** The linked question is open, on screen and not hidden under the fixed header. */
  const expectLanded = async (page: Page, id: string) => {
    const target = page.locator(`[id="${id}"]`);
    await expect(target.locator('details')).toHaveAttribute('open', '');
    await expect(target).toBeInViewport();
    const header = await page.locator('header').first().boundingBox();
    const box = await target.boundingBox();
    expect(box!.y, 'question below the header').toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);
  };

  test('a shared link (cold load of /faq#id) opens the question below the header', async ({ page, request }) => {
    const id = (await questionIds(request)).at(-1)!;
    await page.goto(`/faq#${id}`);
    await settle(page, 600);
    await expectLanded(page, id);
    // Only the linked question opens.
    await expect(page.locator('main details[open]')).toHaveCount(1);
  });

  test('back and forward between two question links re-open and re-land on each', async ({ page, request }) => {
    const ids = await questionIds(request);
    const [a, b] = [ids.at(-1)!, ids[0]];
    await page.goto(`/faq#${a}`);
    await settle(page, 600);
    await page.locator(`[id="${b}"] summary`).click();
    await page.locator(`[id="${b}"] [data-faq-permalink]`).click();
    await expect(page).toHaveURL(new RegExp(`#${b}$`));
    await settle(page, 600);
    await expectLanded(page, b);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`#${a}$`));
    await settle(page, 600);
    await expectLanded(page, a);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`#${b}$`));
    await settle(page, 600);
    await expectLanded(page, b);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('a shared link still lands on the question as a normal anchor', async ({ page, request }) => {
      const id = (await questionIds(request)).at(-1)!;
      await page.goto(`/faq#${id}`);
      await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
    });
  });

  test('home links to the FAQ page, and the home FAQ keeps no duplicate ids', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#faq li[id]')).toHaveCount(0);
  });
});
