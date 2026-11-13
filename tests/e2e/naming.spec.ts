import { expect, test, type Page } from '@playwright/test';
import { publishedSpeakers, settle, topicRoutes } from './helpers';

/**
 * TEDx licence naming rule, checked on the page as it is actually rendered.
 *
 * - The name is always "TEDxSantaClaraUniversity" and the word always "TEDx"
 *   (lower-case x). CSS such as `.fine-print { text-transform: uppercase }`
 *   would turn them into "TEDXSANTACLARAUNIVERSITY" / "TEDX", so every text
 *   node is read with its computed text-transform (and small-caps) applied.
 * - "TEDx" on its own may only appear in TED's standard phrases (ALLOWED);
 *   anything else (e.g. "TEDx Santa Clara", "TEDxSCU") is a short form.
 * - Lower-case "tedx" (domain, emails, handles such as tedxscu.com, @scutedx)
 *   is only accepted as the visible text of the link it points to, and is
 *   listed in the output.
 * - aria-label, alt, title, placeholder and <title> are checked too.
 *
 * Runs against whatever /content holds. To check other states (ticket states,
 * team names shown, a sponsor, a livestream link), change the content, rebuild
 * and run this file again.
 */

const ALLOWED: RegExp[] = [
  /What is TEDx\?/g,
  /About TEDx\b/g,
  /\bTEDx program/g,
  /\bTEDx events?\b/g,
  /\bTEDx Talks\b/g,
  /\bTEDx (?:rules|guidelines)\b/g,
  /\bTEDx is a program\b/g,
  // TED's standard "About TEDx" boilerplate.
  /branded TEDx, where x = independently organized TED event/g,
];

type Finding = { where: string; text: string };
type Report = { violations: Finding[]; linkForms: Finding[] };

/** Runs in the page. Kept self-contained (it is serialised by Playwright). */
function scan(allowedSources: string[]): Report {
  const allowed = allowedSources.map((s) => new RegExp(s, 'gi'));
  const violations: Finding[] = [];
  const linkForms: Finding[] = [];
  const snippet = (s: string, i: number) => s.slice(Math.max(0, i - 40), i + 50).replace(/\s+/g, ' ');

  const render = (text: string, el: Element) => {
    const cs = getComputedStyle(el);
    let tt = cs.textTransform;
    if (tt === 'none' && cs.fontVariantCaps && cs.fontVariantCaps !== 'normal') tt = 'uppercase';
    if (tt === 'uppercase' || tt === 'full-width') return text.toUpperCase();
    if (tt === 'lowercase') return text.toLowerCase();
    if (tt === 'capitalize') return text.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
    return text;
  };

  /** A string as a visitor reads it: no "TEDX", and every "TEDx" is the full name or in an allowed phrase. */
  const check = (s: string, where: string) => {
    const ok: [number, number][] = [];
    for (const re of allowed) for (const m of s.matchAll(re)) ok.push([m.index, m.index + m[0].length]);
    for (const m of s.matchAll(/tedx/gi)) {
      const i = m.index;
      if (m[0] !== 'TEDx') {
        violations.push({ where, text: `"${m[0]}" (wrong case): …${snippet(s, i)}…` });
        continue;
      }
      if (s.startsWith('TEDxSantaClaraUniversity', i)) continue;
      if (ok.some(([a, b]) => i >= a && i < b)) continue;
      violations.push({ where, text: `"TEDx" outside the name and the allowed phrases: …${snippet(s, i)}…` });
    }
  };

  /** The addresses a link points to that a visitor may see as its label: email, domain, @handle. */
  const addressesOf = (a: Element): string[] => {
    let href = a.getAttribute('href') ?? '';
    try {
      href = decodeURIComponent(href);
    } catch {
      /* keep raw */
    }
    if (href.startsWith('mailto:')) return [href.slice(7).split('?')[0]];
    try {
      const u = new URL(href, location.href);
      const host = u.hostname.replace(/^www\./, '');
      const path = u.pathname.replace(/\/$/, '');
      const last = path.split('/').pop() ?? '';
      return [host + path, host, last ? `@${last}` : ''].filter(Boolean);
    } catch {
      return [];
    }
  };

  // 1. Text nodes, joined in document order so phrases split across inline elements (or split
  //    into per-letter spans by animations) still read whole; a line break between blocks.
  const SKIP = 'script,style,noscript,template,title';
  const blockOf = (el: Element): Element => {
    let b: Element = el;
    while (b.parentElement && /^(inline|contents)/.test(getComputedStyle(b).display)) b = b.parentElement;
    return b;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let joined = '';
  const linkOf: (Element | null)[] = [];
  let lastBlock: Element | null = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest(SKIP)) continue;
    const raw = n.textContent ?? '';
    if (!raw) continue;
    const block = blockOf(el);
    if (lastBlock && block !== lastBlock) {
      joined += '\n';
      linkOf.push(null);
    }
    lastBlock = block;
    const shown = render(raw, el);
    const a = el.closest('a[href]');
    joined += shown;
    for (let i = 0; i < shown.length; i++) linkOf.push(a);
  }

  // A link's own address shown as its label (tedxscu.com, team@tedxscu.com, @scutedx) is the
  // unavoidable short form: listed, then blanked. Only exact, untransformed text inside that link counts.
  const links = new Set(linkOf.filter((a): a is Element => a !== null));
  for (const a of links) {
    for (const addr of addressesOf(a).filter((x) => /tedx/i.test(x)).sort((x, y) => y.length - x.length)) {
      for (let i = joined.indexOf(addr); i !== -1; i = joined.indexOf(addr, i + 1)) {
        let inside = true;
        for (let k = i; k < i + addr.length; k++) if (linkOf[k] !== a) inside = false;
        if (!inside) continue;
        linkForms.push({ where: a.getAttribute('href') ?? '', text: addr });
        joined = joined.slice(0, i) + ' '.repeat(addr.length) + joined.slice(i + addr.length);
      }
    }
  }
  check(joined, 'text');

  // 2. Generated content.
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    for (const pseudo of ['::before', '::after']) {
      const c = getComputedStyle(el, pseudo).content;
      if (c && c !== 'none' && c !== 'normal' && /tedx/i.test(c)) check(render(c, el), `${el.tagName.toLowerCase()}${pseudo}`);
    }
  }

  // 3. Accessible names and tooltips (not transformed by CSS).
  for (const attr of ['aria-label', 'alt', 'title', 'placeholder', 'aria-description', 'aria-roledescription']) {
    for (const el of Array.from(document.querySelectorAll(`[${attr}]`))) {
      const v = el.getAttribute(attr) ?? '';
      if (/tedx/i.test(v)) check(v, `${el.tagName.toLowerCase()}[${attr}]`);
    }
  }

  // 4. The document title.
  check(document.title, '<title>');

  return { violations, linkForms };
}

async function checkPage(page: Page, label: string) {
  await settle(page, 200);
  const report = await page.evaluate(scan, ALLOWED.map((r) => r.source));
  for (const f of report.linkForms) console.log(`[naming] ${label}: short form shown as its own link: "${f.text}" -> ${f.where}`);
  expect(report.violations, `${label}: rendered naming violations`).toEqual([]);
}

const ROUTES = [
  '/',
  ...topicRoutes(),
  ...publishedSpeakers().map((s) => `/speakers/${s.slug}`),
  '/this-clause-does-not-exist',
];

test.describe('licensed name is rendered exactly', () => {
  for (const route of ROUTES) {
    test(`${route} (desktop)`, async ({ page }) => {
      await page.goto(route);
      await checkPage(page, route);
    });
  }

  test('home page on a phone, with the menu open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await settle(page, 200);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('[data-menu-panel]')).toBeVisible();
    await checkPage(page, '/ (390px, menu open)');
  });

  test('the checker itself catches an uppercased name and a short form', async ({ page }) => {
    await page.setContent(
      `<!doctype html><html><head><title>t</title></head><body>
        <p style="text-transform:uppercase">For TEDxSantaClaraUniversity</p>
        <p>TEDx Santa Clara</p>
        <p style="text-transform:uppercase"><span style="text-transform:none">TEDxSantaClaraUniversity</span> · What is TEDx?</p>
        <a href="https://tedxscu.com">tedxscu.com</a>
      </body></html>`,
    );
    const report = await page.evaluate(scan, ALLOWED.map((r) => r.source));
    const texts = report.violations.map((v) => v.text).join('\n');
    expect(texts).toContain('TEDXSANTACLARAUNIVERSITY');
    expect(texts).toContain('TEDx Santa Clara');
    // "WHAT IS TEDX?" is uppercased too: caught.
    expect(texts).toContain('WHAT IS TEDX');
    expect(report.violations).toHaveLength(3);
    expect(report.linkForms.map((f) => f.text)).toEqual(['tedxscu.com']);
  });
});
