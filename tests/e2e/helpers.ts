import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { siteUrlFrom } from '../../src/lib/site';
import { THEME_COPY_DEFAULTS, type ThemeCopy } from '../../src/lib/theme-copy';

/** The canonical origin of the build under test (src/lib/site.ts: SITE_URL env var, else the default). */
export const SITE_URL = siteUrlFrom(process.env.SITE_URL);

/**
 * One top-level scalar from a content YAML file ('' when absent): plain, 'single'
 * or "double" quoted, or a `|-` block. Enough for the flat files the admin writes;
 * no YAML dependency. Lets the suite check this year's facts without hard-coding them.
 */
export function contentValue(file: string, key: string): string {
  const yaml = readFileSync(join(process.cwd(), 'content', file), 'utf8');
  const block = yaml.match(new RegExp(`^${key}:\\s*\\|-?\\n((?:(?:  .*)?\\n?)*)`, 'm'));
  if (block) return block[1].replace(/^ {2}/gm, '').trimEnd();
  const m = yaml.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return '';
  const v = m[1].trim();
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.startsWith('"') && v.endsWith('"')) return JSON.parse(v) as string;
  return v;
}

/** This year's facts, read from content/ as the site does (Event basics and Venue). */
export function eventFacts() {
  const dateISO = contentValue('settings.yaml', 'dateISO');
  return {
    themeName: contentValue('settings.yaml', 'themeName'),
    dateISO,
    /** "April 23, 2027" (the weekday is left out so both the long and short forms match). */
    dateText: new Date(`${dateISO}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    venueName: contentValue('venue.yaml', 'venueName'),
    campus: contentValue('venue.yaml', 'campus'),
  };
}

/** One Theme copy line as the site shows it: content/theme-copy.yaml, else the built-in default. */
export function themeCopy(key: keyof ThemeCopy): string {
  return contentValue('theme-copy.yaml', key) || THEME_COPY_DEFAULTS[key];
}

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

/**
 * The topic pages that exist with today's content: /team and /faq follow their
 * switches (Contact & site > Show / hide sections), the others always exist.
 */
export function topicRoutes(): string[] {
  const on = (key: string) => contentValue('sections.yaml', key) !== 'false';
  return ['/speakers', '/schedule', '/venue', '/partners', ...(on('showTeam') ? ['/team'] : []), ...(on('showFaq') ? ['/faq'] : [])];
}

/** Every public, statically generated page. */
export function publicRoutes(): string[] {
  return ['/', ...topicRoutes(), ...publishedSpeakers().map((s) => `/speakers/${s.slug}`)];
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
