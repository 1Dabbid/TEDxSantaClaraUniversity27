import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { initials } from '../../src/lib/site';
import { contentValue } from './helpers';

/**
 * The facts the club's President supplied in November 2026 (history, team,
 * tiers, times, tickets, interest form). These follow /content where they can,
 * so an edit in the admin moves the expectation with it.
 */

const PAGES = ['/', '/partners', '/team', '/schedule', '/venue', '/speakers', '/faq'];

/** The club's own public addresses (Contact in the admin); no other email may appear. */
const CLUB_EMAILS = [contentValue('contact.yaml', 'contactEmail'), contentValue('contact.yaml', 'partnershipsEmail')].filter(Boolean);

type ContentMember = { slug: string; name: string; role: string; linkedin: string; hasPhoto: boolean };

/** Named team members from content/team, in display order, and whether each has a photo (Photo field or the dropped-in file). */
function teamFromContent(): ContentMember[] {
  const dir = join(process.cwd(), 'content/team');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => ({ slug: f.replace(/\.yaml$/, ''), y: readFileSync(join(dir, f), 'utf8') }))
    .filter(({ y }) => /^showName:\s*true/m.test(y))
    .map(({ slug, y }) => {
      const photoField = (y.match(/^photo:\s*(.*)$/m)?.[1] ?? '').trim();
      const dropped = ['jpg', 'jpeg', 'png', 'webp'].some((ext) => existsSync(join(process.cwd(), 'public/images/team', slug, `photo.${ext}`)));
      return {
        slug,
        name: (y.match(/^name:\s*(.+)$/m)?.[1] ?? '').trim(),
        role: (y.match(/^role:\s*(.+)$/m)?.[1] ?? '').trim(),
        linkedin: (y.match(/^linkedin:\s*(.+)$/m)?.[1] ?? '').trim(),
        hasPhoto: Boolean(photoField && photoField !== 'null') || dropped,
        order: Number(y.match(/^order:\s*(\d+)/m)?.[1] ?? 0),
      };
    })
    .filter((m) => m.name)
    .sort((a, b) => a.order - b.order)
    .map(({ slug, name, role, linkedin, hasPhoto }) => ({ slug, name, role, linkedin, hasPhoto }));
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

  test('/team groups the board by level: the president alone, the executive board, then operations', async ({ page }) => {
    await page.goto('/team');
    const groups = page.locator('section[aria-labelledby^="board-"]');
    const group = (name: string) => groups.filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) });
    await expect(groups.getByRole('heading', { level: 2 })).toHaveText([/President$/, /Executive board$/, /Operations$/]);
    await expect(group('President').locator('[data-team-member] h3')).toHaveText(['David Simmons']);
    await expect(group('Executive board').locator('[data-team-member] h3')).toHaveText(['Liam Aldwinckle', 'Diego Velasco']);
    await expect(group('Operations').locator('[data-team-member] h3')).toHaveCount(6);
    // The president's portrait is the larger one.
    const lead = (await group('President').locator('.portrait').boundingBox())!;
    const card = (await group('Operations').locator('.portrait').first().boundingBox())!;
    expect(lead.width).toBeGreaterThan(card.width * 1.2);
  });

  test('three steps down the chart: the president, then the executive board, then operations', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/team');
    const width = async (level: string) =>
      (await page.locator(`section[aria-labelledby="board-${level}"] .portrait`).first().boundingBox())!.width;
    const [lead, exec, ops] = [await width('president'), await width('executive'), await width('operations')];
    expect(lead).toBeGreaterThan(exec + 30);
    expect(exec).toBeGreaterThan(ops + 30);
  });

  test('every member has a 4:5 frame: a photo toggle where there is a photo, initials where there is not', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/team');
    for (const m of team) {
      const card = page.locator(`[data-team-member]#${m.slug}`);
      const frame = card.locator(m.hasPhoto ? '[data-portrait-toggle]' : '[data-team-monogram]');
      await expect(frame, m.slug).toHaveCount(1);
      const box = (await frame.boundingBox())!;
      expect(box.width / box.height, m.slug).toBeCloseTo(0.8, 2);
      if (m.hasPhoto) await expect(frame.locator('img')).toHaveAttribute('alt', '');
      else await expect(frame).toHaveText(initials(m.name));
    }
  });

  test('photos are black and white until hovered; the neighbour stays black and white', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/team');
    const portraits = page.locator('[data-team-member] [data-portrait-toggle]');
    test.skip((await portraits.count()) < 3, 'needs three photos');
    const filter = (i: number) => portraits.nth(i).locator('img').evaluate((el) => getComputedStyle(el).filter);
    expect(await filter(1)).toContain('grayscale(1)');
    await portraits.nth(1).hover();
    await expect.poll(() => filter(1)).toContain('grayscale(0)');
    expect(await filter(2)).toContain('grayscale(1)');
  });

  test('keyboard: focus shows the colour on the portrait and its LinkedIn link; Enter keeps it, marked by crop marks', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/team');
    const card = page.locator('section[aria-labelledby="board-operations"] [data-team-member]').filter({ has: page.locator('[data-portrait-toggle]') }).first();
    const name = (await card.locator('h3').textContent())!.trim();
    const button = card.getByRole('button', { name: `${name} in colour` });
    const link = card.getByRole('link', { name: `${name} on LinkedIn (opens in a new tab)` });
    const filter = () => card.locator('img').evaluate((el) => getComputedStyle(el).filter);
    const marks = () => card.locator('.portrait-marks').evaluate((el) => getComputedStyle(el).opacity);
    expect(await filter()).toContain('grayscale(1)');
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(button).toBeFocused();
    await expect.poll(filter).toContain('grayscale(0)');
    // Focus alone draws no crop marks; the ring is square.
    expect(await marks()).toBe('0');
    expect(await button.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('0px');
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(marks).toBe('1');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect.poll(filter).toContain('grayscale(0)');
  });

  test('phones: two columns, a tap toggles colour and the LinkedIn link stays reachable', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/team');
    const cards = page.locator('section[aria-labelledby="board-operations"] [data-team-member]');
    const [a, b] = [(await cards.nth(0).boundingBox())!, (await cards.nth(1).boundingBox())!];
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    expect(b.x).toBeGreaterThan(a.x + a.width - 1);
    const card = cards.filter({ has: page.locator('[data-portrait-toggle]') }).first();
    const name = (await card.locator('h3').textContent())!.trim();
    const button = card.getByRole('button', { name: `${name} in colour` });
    const filter = () => button.locator('img').evaluate((el) => getComputedStyle(el).filter);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await button.tap();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(filter).toContain('grayscale(0)');
    await button.tap();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(filter).toContain('grayscale(1)');
    // The link is its own target, below the portrait, and large enough to tap.
    const link = card.getByRole('link', { name: `${name} on LinkedIn (opens in a new tab)` });
    const lb = (await link.boundingBox())!;
    const pb = (await button.boundingBox())!;
    expect(lb.y).toBeGreaterThanOrEqual(pb.y + pb.height);
    expect(lb.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await ctx.close();
  });

  test('the home strip: grouped by level at every width, one link per person to their /team card', async ({ page }) => {
    await page.goto('/');
    const names = page.locator('#team [data-sign] [data-sign-name]');
    expect((await names.allTextContents()).map((t) => t.replace(/,$/, ''))).toEqual(team.map((m) => m.name));
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const levels = page.locator('#team ul[aria-labelledby^="team-level-"]');
      await expect(levels).toHaveCount(3);
      for (const label of ['President', 'Executive board', 'Operations']) {
        await expect(page.locator('#team').getByRole('list', { name: label, exact: true })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}`).toBeLessThanOrEqual(width);
    }
    for (const m of team) {
      await expect(page.locator(`#team a[href="/team#${m.slug}"]`), m.slug).toHaveCount(1);
    }
    await expect(page.locator('#team button')).toHaveCount(0);
    await expect(page.locator('#team').getByRole('link', { name: 'The team' })).toHaveAttribute('href', '/team');
  });

  test('the home strip: phones put the President and Executive board on one row, Operations three by three', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/');
    const tops = async (label: string) =>
      Promise.all(
        (await page.locator('#team').getByRole('list', { name: label, exact: true }).locator('.portrait').all()).map(async (p) => Math.round((await p.boundingBox())!.y)),
      );
    const [pres, exec, ops] = [await tops('President'), await tops('Executive board'), await tops('Operations')];
    expect(new Set([...pres, ...exec]).size).toBe(1);
    expect(new Set(ops.slice(0, 3)).size).toBe(1);
    expect(ops[3]).toBeGreaterThan(ops[0]);
    expect(ops[0]).toBeGreaterThan(pres[0]);
    await ctx.close();
  });

  test('the home strip: lazy portraits, and the file loaded fits the frame (desktop, DPR 1)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const imgs = page.locator('#team [data-portrait-photo] img');
    await expect(imgs).toHaveCount(team.filter((m) => m.hasPhoto).length);
    for (const img of await imgs.all()) await expect(img).toHaveAttribute('loading', 'lazy');
    await page.locator('#team').scrollIntoViewIfNeeded();
    for (const img of await imgs.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      const src = await img.evaluate((el: HTMLImageElement) => el.currentSrc);
      const w = Number(new URL(src).searchParams.get('w'));
      expect(w, src).toBeGreaterThan(0);
      expect(w, src).toBeLessThanOrEqual(256);
    }
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
