import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { contentValue } from './helpers';

/**
 * The facts the club's President supplied in November 2026 (history, team,
 * tiers, times, tickets, interest form). These follow /content where they can,
 * so an edit in the admin moves the expectation with it.
 */

const PAGES = ['/', '/partners', '/team', '/schedule', '/venue', '/speakers', '/faq'];

/** The club's own public addresses (Contact in the admin); no other email may appear. */
const CLUB_EMAILS = [contentValue('contact.yaml', 'contactEmail'), contentValue('contact.yaml', 'partnershipsEmail')].filter(Boolean);

/** Named team members from content/team, in display order. */
function teamFromContent(): { name: string; linkedin: string }[] {
  const dir = join(process.cwd(), 'content/team');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .filter((y) => /^showName:\s*true/m.test(y))
    .map((y) => ({
      name: (y.match(/^name:\s*(.+)$/m)?.[1] ?? '').trim(),
      linkedin: (y.match(/^linkedin:\s*(.+)$/m)?.[1] ?? '').trim(),
      order: Number(y.match(/^order:\s*(\d+)/m)?.[1] ?? 0),
    }))
    .filter((m) => m.name)
    .sort((a, b) => a.order - b.order)
    .map(({ name, linkedin }) => ({ name, linkedin }));
}

test.describe('history: the event returns, it is not the first', () => {
  for (const route of PAGES) {
    test(`${route} makes no "first" claim`, async ({ request }) => {
      const html = (await (await request.get(route)).text()).toLowerCase();
      for (const s of ['first mainstage', 'first one happen', 'founding partner']) expect(html, `${route}: "${s}"`).not.toContain(s);
      // The whole document, head (meta and share descriptions) included.
      expect(html, `${route}: "mainstage"`).not.toMatch(/mainstage/);
      expect(html, `${route}: a "first" claim not followed by "since"`).not.toMatch(/first tedxsantaclarauniversity(?! since)/);
    });
  }

  test('the partner pitch says the event returns, for the first time since 2020', async ({ page }) => {
    await page.goto('/partners');
    await expect(page.locator('main')).toContainText('The first since 2020.');
    await expect(page.locator('main')).toContainText('the first TEDxSantaClaraUniversity since 2020');
  });
});

test.describe('team', () => {
  const team = teamFromContent();

  test('content names nine board members', () => {
    expect(team).toHaveLength(9);
    expect(team[0].name).toBe('David Simmons');
  });

  test('/team lists the nine names in order, with role, major, class year and LinkedIn', async ({ page }) => {
    await page.goto('/team');
    const cards = page.locator('[data-team-member]');
    await expect(cards).toHaveCount(team.length);
    expect(await cards.locator('h3').allTextContents()).toEqual(team.map((m) => m.name));
    await expect(cards.first()).toContainText('President');
    await expect(cards.first()).not.toContainText('License Holder');
    await expect(cards.first()).toContainText('Finance & Psychology');
    await expect(cards.first()).toContainText('Class of 2029');
    for (const m of team) {
      const link = page.getByRole('link', { name: `${m.name} on LinkedIn (opens in a new tab)` });
      await expect(link).toHaveAttribute('href', m.linkedin);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  test('without photos each member gets a monogram, never an empty box', async ({ page }) => {
    await page.goto('/team');
    const marks = page.locator('[data-team-member] [data-team-monogram]');
    await expect(marks).toHaveCount(team.length);
    await expect(marks.first()).toHaveText('DS');
  });

  test('the home roster shows the nine names in order and links to /team', async ({ page }) => {
    await page.goto('/');
    const names = page.locator('#team [data-sign] [data-sign-mark] p');
    expect(await names.allTextContents()).toEqual(team.map((m) => m.name));
    await expect(page.locator('#team').getByRole('link', { name: 'The team' })).toHaveAttribute('href', '/team');
  });

  for (const route of ['/', '/team']) {
    test(`${route} publishes no personal email address or phone number`, async ({ request }) => {
      const html = await (await request.get(route)).text();
      const emails = new Set(html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []);
      for (const e of emails) expect(CLUB_EMAILS, `unexpected email ${e}`).toContain(e);
      const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
      expect(text).not.toMatch(/\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/);
      expect(html).not.toMatch(/href="tel:/);
    });
  }
});

test.describe('partners', () => {
  test('tier amounts and availability render', async ({ page }) => {
    await page.goto('/partners');
    const ledger = page.locator('[data-ledger]');
    for (const name of ['Cornerstone Partner', 'Headline Partner', 'Bold Print Partner', 'Fine Print Supporter']) {
      await expect(ledger.getByRole('heading', { name })).toBeVisible();
    }
    for (const amount of ['$5,000', '$1,500', '$500', '$150']) await expect(ledger).toContainText(amount);
    await expect(ledger).toContainText('Open');
  });

  test('the benefits table carries per-tier details, three headings and two to-be-confirmed notes', async ({ page }) => {
    await page.goto('/partners');
    const table = page.locator('[data-benefits-table]');
    await expect(table).toBeVisible();
    await expect(table.locator('th[scope="rowgroup"]')).toHaveText(['On the website and in video', 'At the April 23 event', 'During the year']);
    const row = (name: string) => table.locator('tr', { has: page.locator('th[scope="row"]', { hasText: name }) });
    await expect(row('Listed on the Partners page').locator('td')).toHaveText(['Largest logo', 'Large logo', 'Logo', 'Name']);
    await expect(row('Reserved seats').locator('td')).toHaveText(['4', '2', '1', /Not included/]);
    await expect(table.getByText('To be confirmed')).toHaveCount(2);
    await expect(row('Logo on the sponsor slide of the April 23 talk videos')).toContainText('To be confirmed');
    await expect(row('Logo on event merchandise')).toContainText('To be confirmed');
  });

  test('phones get the stacked list instead of the table', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/partners');
    await expect(page.locator('[data-benefits-table]')).toBeHidden();
    const list = page.locator('[data-benefits-list]');
    await expect(list).toBeVisible();
    await expect(list.locator('li', { hasText: 'Lobby booth or table' })).toContainText('Premium booth');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('the TEDx-rule guardrails stay on the page', async ({ page }) => {
    await page.goto('/partners');
    await expect(page.getByRole('heading', { name: 'How partnerships work under TEDx rules.' })).toBeVisible();
    await expect(page.locator('main')).toContainText('cannot speak or present from the stage');
    await expect(page.locator('main')).toContainText('only on the sponsor thank-you slide');
    await expect(page.locator('main')).toContainText('used only for TEDxSantaClaraUniversity event news');
  });
});

test.describe('times and schedule', () => {
  const NOTE = 'Times are approximate and may shift slightly. The full running order follows once speakers are confirmed.';
  const ROWS = [
    ['5:00 PM', 'Doors open and reception', 'Reception'],
    ['6:00 PM', 'Talks begin', 'Talk'],
    ['9:00 PM', 'Close', 'Program'],
  ];

  for (const route of ['/schedule', '/']) {
    test(`${route} shows the three rows and the approximate note`, async ({ page }) => {
      await page.goto(route);
      const rows = page.locator('[data-timeline] li');
      await expect(rows).toHaveCount(3);
      for (const [i, [time, title, kind]] of ROWS.entries()) {
        await expect(rows.nth(i)).toContainText(time);
        await expect(rows.nth(i)).toContainText(title);
        await expect(rows.nth(i)).toContainText(kind);
      }
      await expect(rows.first().locator('time')).toHaveAttribute('datetime', '2027-04-23T17:00');
      await expect(page.locator('[data-times-note]').first()).toHaveText(NOTE);
    });
  }

  test('/venue shows the times with the note', async ({ page }) => {
    await page.goto('/venue');
    await expect(page.locator('main')).toContainText('5:00 PM');
    await expect(page.locator('main')).toContainText('6:00 PM');
    await expect(page.locator('main')).toContainText('9:00 PM');
    await expect(page.locator('[data-times-note]').first()).toHaveText(NOTE);
  });

  test('the event JSON-LD carries start, end and doors with the Pacific offset', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const all = blocks.flatMap((b) => (b['@graph'] as unknown[]) ?? [b]) as Record<string, unknown>[];
    const event = all.find((n) => n['@type'] === 'Event');
    expect(event).toBeTruthy();
    expect(event!.startDate).toBe('2027-04-23T18:00:00-07:00');
    expect(event!.endDate).toBe('2027-04-23T21:00:00-07:00');
    expect(event!.doorTime).toBe('2027-04-23T17:00:00-07:00');
  });
});

test.describe('tickets and getting involved', () => {
  test('tickets say when sales are expected, and the price cap stays', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tickets')).toContainText('Tickets are expected to go on sale in February 2027.');
    await expect(page.locator('#tickets')).toContainText('Tickets will cost no more than $100.');
    await page.goto('/faq');
    await expect(page.locator('main')).toContainText('Tickets are expected to go on sale in February 2027.');
  });

  test('the interest form is offered on the home Speakers section, /speakers, /team and in the FAQ', async ({ page }) => {
    const url = contentValue('tickets.yaml', 'interestUrl');
    expect(url).toMatch(/^https:\/\//);
    for (const [route, scope] of [
      ['/', '#speakers'],
      ['/speakers', 'main'],
    ] as const) {
      await page.goto(route);
      const link = page.locator(`${scope} a[data-interest-link]`).first();
      await expect(link).toHaveAttribute('href', url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toContainText('Register your interest');
      await expect(link).toContainText('(opens in a new tab)');
    }
    await page.goto('/team');
    await expect(page.getByRole('link', { name: /^Get involved/ })).toHaveAttribute('href', url);
    await page.goto('/faq');
    await expect(page.locator(`a[data-faq-link][href="${url}"]`)).toHaveCount(2);
  });

  test('speaker applications are still not open', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#speakers').getByRole('link', { name: /Apply to speak/ })).toHaveCount(0);
  });
});
