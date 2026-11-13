import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { SITE_URL, publicRoutes, publishedSpeakers } from './helpers';

/** A plain `key: value` line from a content YAML file ('' when missing or blank). */
function yamlValue(file: string, key: string): string {
  const yaml = readFileSync(join(process.cwd(), 'content', file), 'utf8');
  const raw = yaml.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? '';
  return raw.replace(/^['"]|['"]$/g, '');
}

type Node = Record<string, unknown>;

/** Every JSON-LD node on a page (top-level objects and @graph members). */
async function jsonLd(request: APIRequestContext, path: string): Promise<{ raw: string[]; nodes: Node[] }> {
  const html = await (await request.get(path)).text();
  const raw = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const nodes = raw.flatMap((r) => {
    const data = JSON.parse(r) as Node;
    return Array.isArray(data['@graph']) ? (data['@graph'] as Node[]) : [data];
  });
  return { raw, nodes };
}

const anyAnnounced = () => publishedSpeakers().some((s) => s.announced);

test.describe('structured data', () => {
  test('home Event: stable @id, offers only once tickets are on sale, offset on timed start', async ({ request }) => {
    const { raw, nodes } = await jsonLd(request, '/');
    // Serialised safely: no raw "<" can close the script tag early.
    for (const r of raw) expect(r).not.toContain('<');
    const event = nodes.find((n) => n['@type'] === 'Event');
    expect(event, 'Event node').toBeTruthy();
    expect(event?.['@id']).toBe(`${SITE_URL}/#event`);
    expect(String(event?.name)).toMatch(/^TEDxSantaClaraUniversity: /);
    expect(nodes.some((n) => n['@type'] === 'WebSite')).toBe(true);

    const state = yamlValue('tickets.yaml', 'ticketState') || 'coming-soon';
    if (state === 'coming-soon' || state === 'closed') expect(event?.offers, `no offers while ${state}`).toBeUndefined();
    else expect(event?.offers).toBeTruthy();

    const timed = Boolean(yamlValue('settings.yaml', 'talksTime') || yamlValue('settings.yaml', 'doorsTime'));
    const startDate = String(event?.startDate);
    if (timed) expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    else expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  for (const s of publishedSpeakers()) {
    test(`/speakers/${s.slug}: ${s.announced ? 'Person points at the main Event, breadcrumb' : 'no Person data'}`, async ({ request }) => {
      const { nodes } = await jsonLd(request, `/speakers/${s.slug}`);
      const person = nodes.find((n) => n['@type'] === 'Person');
      if (!s.announced) {
        expect(person).toBeUndefined();
        return;
      }
      expect(person?.performerIn).toEqual({ '@id': `${SITE_URL}/#event` });
      expect(nodes.some((n) => n['@type'] === 'Event'), 'no second, thin Event').toBe(false);
      expect(nodes.some((n) => n['@type'] === 'BreadcrumbList')).toBe(true);
    });
  }
});

test.describe('indexing', () => {
  test('robots.txt allows the site in a production (non-preview) build', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toMatch(/^Allow: \/$/m);
    expect(body).not.toMatch(/^Disallow: \/$/m);
  });

  test('/speakers exists and is noindex until a speaker is announced', async ({ request }) => {
    const res = await request.get('/speakers');
    expect(res.status()).toBe(200);
    const html = await res.text();
    const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';
    if (anyAnnounced()) expect(robots).not.toContain('noindex');
    else expect(robots).toContain('noindex');
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml.includes(`<loc>${SITE_URL}/speakers</loc>`)).toBe(anyAnnounced());
  });

  test('the 404 page has no canonical link', async ({ request }) => {
    const html = await (await request.get('/this-clause-does-not-exist')).text();
    expect(html).not.toMatch(/<link rel="canonical"/);
  });

  for (const route of publicRoutes()) {
    test(`${route}: title leads with the full event name`, async ({ request }) => {
      const html = await (await request.get(route)).text();
      expect(html).toMatch(/<title>TEDxSantaClaraUniversity[ :·]/);
      expect(html).toMatch(/<meta property="og:title" content="TEDxSantaClaraUniversity[ :·]/);
    });
  }
});

test.describe('icons and manifest', () => {
  for (const [path, type] of [
    ['/icon.svg', 'image/svg+xml'],
    ['/favicon.ico', 'image/x-icon'],
    ['/apple-icon.png', 'image/png'],
    ['/icons/icon-192.png', 'image/png'],
    ['/icons/icon-512.png', 'image/png'],
    ['/manifest.webmanifest', 'application/manifest+json'],
  ] as const) {
    test(`${path} returns 200 (${type})`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain(type);
    });
  }

  test('the manifest names the event from content', async ({ request }) => {
    const m = await (await request.get('/manifest.webmanifest')).json();
    expect(m.name).toBe(`TEDxSantaClaraUniversity: ${yamlValue('settings.yaml', 'themeName')}`);
    expect(m.short_name).toBe(yamlValue('settings.yaml', 'themeName'));
  });
});
