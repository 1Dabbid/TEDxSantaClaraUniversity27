import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SHARE_IMAGE_DESIGN, shareImagePath, shareImageVersion, siteDescription, venueDescriptionTail } from '../../src/lib/site';
import { SITE_URL, contentValue, topicRoutes } from './helpers';

/** The whole text of a content file (for values the flat-key helper cannot read, such as list items). */
const contentFile = (file: string) => readFileSync(join(process.cwd(), 'content', file), 'utf8');

const meta = (html: string, attr: 'property' | 'name', key: string) =>
  html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1] ?? '';

/**
 * Link previews. A page that sets its own Open Graph block loses the image the
 * root layout would add, so every page that can be shared is checked for one:
 * every address in the sitemap, plus /speakers (shared before it is indexed).
 */
test.describe('share images', () => {
  test('every sitemap page and /speakers has an og:image and a twitter:image that load', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(paths.length).toBeGreaterThan(3);
    const checked = new Map<string, boolean>();
    for (const path of new Set([...paths, '/speakers'])) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      expect(meta(html, 'name', 'twitter:card'), `${path} twitter:card`).toBe('summary_large_image');
      for (const [attr, key] of [
        ['property', 'og:image'],
        ['name', 'twitter:image'],
      ] as const) {
        const url = meta(html, attr, key).replace(/&amp;/g, '&');
        expect(url, `${path} ${key}`).toMatch(new RegExp(`^${SITE_URL}/`));
        const image = new URL(url);
        const target = `${image.pathname}${image.search}`;
        if (!checked.has(target)) {
          const img = await request.get(target);
          const png = await img.body();
          // A PNG states its size in its first chunk: width and height at bytes 16 and 20.
          const sized = png.length > 24 && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630;
          checked.set(target, img.status() === 200 && (img.headers()['content-type'] ?? '').includes('image/png') && sized);
        }
        expect(checked.get(target), `${path} ${key} loads as a 1200 × 630 PNG (${target})`).toBe(true);
      }
      expect(meta(html, 'property', 'og:image:width'), `${path} og:image:width`).toBe('1200');
      expect(meta(html, 'property', 'og:image:height'), `${path} og:image:height`).toBe('630');
      expect(meta(html, 'property', 'og:image:alt'), `${path} og:image:alt`).toContain('TEDxSantaClaraUniversity');
    }
  });

  test('the share image version changes exactly when something drawn on the card changes', () => {
    const card = { themeName: 'Fine Print', dateMedium: 'April 23, 2027', venueName: 'Hall', venueCampus: 'Campus' };
    const v = shareImageVersion(card);
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(shareImageVersion({ ...card })).toBe(v);
    expect(shareImageVersion({ ...card, themeName: 'Small Print' })).not.toBe(v);
    expect(shareImageVersion({ ...card, dateMedium: 'April 24, 2027' })).not.toBe(v);
    expect(shareImageVersion({ ...card, venueCampus: 'Other Campus' })).not.toBe(v);
    // The card shows the campus when there is one, so the hall's name only counts without it.
    expect(shareImageVersion({ ...card, venueName: 'Other Hall' })).toBe(v);
    expect(shareImageVersion({ ...card, venueCampus: '', venueName: 'Other Hall' })).not.toBe(shareImageVersion({ ...card, venueCampus: '' }));
    // A redesign of the card changes it too: the design number is counted by hand (SHARE_IMAGE_DESIGN).
    expect(shareImageVersion(card, SHARE_IMAGE_DESIGN)).toBe(v);
    expect(shareImageVersion(card, SHARE_IMAGE_DESIGN + 1)).not.toBe(v);
    expect(shareImagePath(card)).toBe(`/opengraph-image?v=${v}`);
  });

  test('the design number is raised when the card itself changes', () => {
    // The card's source (and its fonts) as it was when SHARE_IMAGE_DESIGN was last set.
    // If this fails, the card was edited: add one to SHARE_IMAGE_DESIGN in src/lib/site.ts
    // (so share platforms fetch the new card on every page), then record the new values here.
    const RECORDED = { design: 1, source: 'c3f4657e5b28803a' };
    const dir = join(process.cwd(), 'src/app/_og');
    const hash = createHash('sha256').update(readFileSync(join(process.cwd(), 'src/app/opengraph-image.tsx')));
    for (const file of readdirSync(dir).sort()) hash.update(file).update(readFileSync(join(dir, file)));
    expect({ design: SHARE_IMAGE_DESIGN, source: hash.digest('hex').slice(0, 16) }).toEqual(RECORDED);
  });

  test('the home page and every topic page name the same share image, with its version', async ({ request }) => {
    const versions = new Set<string>();
    for (const path of ['/', ...topicRoutes()]) {
      const html = await (await request.get(path)).text();
      const og = meta(html, 'property', 'og:image').replace(/&amp;/g, '&');
      expect(og, `${path} og:image`).toMatch(new RegExp(`^${SITE_URL}/opengraph-image\\?v=[0-9a-f]{8}$`));
      expect(meta(html, 'name', 'twitter:image').replace(/&amp;/g, '&'), `${path} twitter:image`).toBe(og);
      versions.add(og);
    }
    // One card, one address: the home page and every topic page share the same versioned image.
    expect(versions.size).toBe(1);
    // The Event structured data on the home page names it too.
    const home = await (await request.get('/')).text();
    expect(home).toContain(`"image":["${[...versions][0]}"]`);
  });
});

test.describe('descriptions follow the content', () => {
  const note = (title: string, body = '') => ({ title, body });

  test('the venue description only mentions what the page has', () => {
    const empty = [note('Directions'), note('Parking'), note('Accessibility')];
    expect(venueDescriptionTail({ venueNotes: empty, mapUrl: 'https://maps.example.com/x' })).toBe(
      'Address and map link; directions, parking and accessibility details to follow.',
    );
    expect(venueDescriptionTail({ venueNotes: [], mapUrl: '' })).toBe('Address; directions, parking and accessibility details to follow.');
    expect(
      venueDescriptionTail({ venueNotes: [note('Directions'), note('Parking', 'Lot B, free after 4 PM.'), note('Accessibility')], mapUrl: 'https://maps.example.com/x' }),
    ).toBe('Address, map link and parking; directions and accessibility details to follow.');
    expect(
      venueDescriptionTail({ venueNotes: empty.map((n) => note(n.title, 'Filled in.')), mapUrl: 'https://maps.example.com/x' }),
    ).toBe('Address, map link, directions, parking and accessibility.');
  });

  test('the venue description keeps a title the owner typed as typed', () => {
    // Only the three standard titles are lower-cased; names and acronyms are not mangled.
    expect(
      venueDescriptionTail({
        venueNotes: [note('Directions', 'From the main gate.'), note('Parking'), note('Accessibility'), note('Caltrain & VTA', 'Santa Clara station.'), note('ADA drop-off')],
        mapUrl: 'https://maps.example.com/x',
      }),
    ).toBe('Address, map link, directions and Caltrain & VTA; parking, accessibility and ADA drop-off details to follow.');
    expect(venueDescriptionTail({ venueNotes: [note(' PARKING ', 'Lot B.'), note('accessibility')], mapUrl: '' })).toBe(
      'Address and parking; accessibility details to follow.',
    );
  });

  test('/venue: the served description promises nothing the notes do not hold', async ({ request }) => {
    const html = await (await request.get('/venue')).text();
    const description = meta(html, 'name', 'description');
    expect(description).toBeTruthy();
    expect(meta(html, 'property', 'og:description')).toBe(description);
    // Today's content: are the three "Getting there" notes still empty?
    const bodies = [...contentFile('venue.yaml').matchAll(/^\s+body:\s*(.*)$/gm)].map((m) => m[1].replace(/^['"]|['"]$/g, '').trim());
    if (bodies.length && bodies.every((b) => b === '')) {
      expect(description).toMatch(/details to follow\.$/);
      expect(description).not.toMatch(/map, directions, parking and accessibility\.$/);
    }
  });

  test('a blank tagline leaves no double space in the site description', () => {
    const s = { eventName: 'TEDxSantaClaraUniversity', themeName: 'Fine Print', dateLong: 'Friday, April 23, 2027', venueName: 'Hall', venueCampus: 'Campus' };
    expect(siteDescription({ ...s, themeTagline: '' })).toBe('TEDxSantaClaraUniversity: Fine Print. Friday, April 23, 2027, Hall, Campus.');
    expect(siteDescription({ ...s, themeTagline: ' Details decide. ' })).toBe(
      'TEDxSantaClaraUniversity: Fine Print. Details decide. Friday, April 23, 2027, Hall, Campus.',
    );
  });

  test('no page description has a double space, and the manifest has a description', async ({ request }) => {
    for (const path of ['/', '/venue', '/partners', '/schedule']) {
      const html = await (await request.get(path)).text();
      expect(meta(html, 'name', 'description'), path).not.toMatch(/ {2}/);
    }
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(String(manifest.description).trim()).not.toBe('');
    const tagline = contentValue('settings.yaml', 'themeTagline');
    if (tagline) expect(manifest.description).toBe(tagline);
  });
});

test.describe('titles', () => {
  test('the switched-off admin keeps the 404 title after the page has loaded', async ({ page }) => {
    const res = await page.goto('/keystatic');
    expect(res?.status()).toBe(404);
    await expect(page.locator('h1')).toContainText('does not exist');
    await page.waitForLoadState('networkidle');
    expect(await page.title()).toBe('TEDxSantaClaraUniversity · Page not found (404)');
    expect(await page.title()).not.toContain('Content admin');
  });

  test('a placeholder speaker page says the same in its title and its heading', async ({ page }) => {
    const res = await page.goto('/speakers/speaker-01');
    test.skip(res?.status() !== 200, 'no placeholder speaker page today');
    const h1 = ((await page.locator('h1').textContent()) ?? '').replace(/\s+/g, ' ').trim();
    test.skip(!/to be announced/i.test(h1), 'speaker-01 is announced');
    expect(h1).toBe('Speaker 01: To be announced.');
    expect(await page.title()).toBe('TEDxSantaClaraUniversity · Speaker 01: To be announced');
  });
});

test.describe('static files', () => {
  test('the still frames are cached like the other public images', async ({ request }) => {
    const policy = 'public, max-age=86400, stale-while-revalidate=604800';
    for (const path of ['/stills/hero-landscape.avif', '/stills/hero-landscape.webp', '/brand/logo-on-black.png']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['cache-control'], path).toBe(policy);
    }
  });
});
