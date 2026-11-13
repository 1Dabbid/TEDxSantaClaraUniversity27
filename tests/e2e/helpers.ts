import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

/** The canonical origin hard-coded in src/lib/site.ts (used in robots.txt and the sitemap). */
export const SITE_URL = 'https://fineprint.tedxscu.com';

type SpeakerFile = { slug: string; announced: boolean; published: boolean };

/**
 * Speaker entries straight from content/speakers/*.yaml, so the suite follows
 * whatever the editors have published (no YAML dependency: the two flags are
 * plain `key: true|false` lines).
 */
export function speakerFiles(): SpeakerFile[] {
  const dir = join(process.cwd(), 'content/speakers');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => {
      const yaml = readFileSync(join(dir, f), 'utf8');
      const flag = (key: string, fallback: boolean) => {
        const m = yaml.match(new RegExp(`^${key}:\\s*(true|false)\\s*$`, 'm'));
        return m ? m[1] === 'true' : fallback;
      };
      return { slug: f.replace(/\.yaml$/, ''), announced: flag('announced', false), published: flag('published', true) };
    });
}

export const publishedSpeakers = () => speakerFiles().filter((s) => s.published);

/** Every public, statically generated page. */
export function publicRoutes(): string[] {
  return ['/', '/partners', ...publishedSpeakers().map((s) => `/speakers/${s.slug}`)];
}

export type Problems = { console: string[]; failed: string[] };

/**
 * Collects console errors, uncaught exceptions, failed requests and HTTP error
 * responses for one page. Call before the first navigation.
 */
export function watchProblems(page: Page): Problems {
  const problems: Problems = { console: [], failed: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.console.push(msg.text());
  });
  page.on('pageerror', (err) => problems.console.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    const reason = req.failure()?.errorText ?? '';
    // A prefetch or chunk request cancelled because the test moved on is not a failure.
    if (reason === 'net::ERR_ABORTED') return;
    problems.failed.push(`${req.method()} ${req.url()} ${reason}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) problems.failed.push(`${res.status()} ${res.url()}`);
  });
  return problems;
}

/** Load a page and wait until it is quiet (scripts, idle callbacks, lazy chunks). */
export async function settle(page: Page, ms = 400) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle');
  // Idle-time work (quality probe, engine start) runs after load.
  await page.evaluate(
    () => new Promise<void>((r) => ('requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 2000 }) : setTimeout(r, 300))),
  );
  await page.waitForTimeout(ms);
}

/**
 * Elements that stick out of the viewport sideways and are not clipped by an
 * ancestor (body's `overflow-x: clip` safety net is ignored on purpose, so a
 * real overflow is not hidden by it). Returns short descriptions.
 */
export async function horizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    const clips = (el: Element) => {
      const s = getComputedStyle(el);
      return s.overflowX !== 'visible' || s.clipPath !== 'none' || s.contain.includes('paint');
    };
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      // Clipped by an ancestor that itself fits (a marquee, a masked line, an sr-only twin)?
      let clipped = false;
      for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        if (getComputedStyle(a).position === 'fixed') {
          clipped = true;
          break;
        }
        if (clips(a)) {
          const ar = a.getBoundingClientRect();
          if (ar.right <= vw + 1 && ar.left >= -1) {
            clipped = true;
            break;
          }
        }
      }
      if (!clipped) out.push(`${describe(el)} [${Math.round(r.left)}..${Math.round(r.right)} of ${vw}]`);
    }
    return out.slice(0, 10);
  });
}
