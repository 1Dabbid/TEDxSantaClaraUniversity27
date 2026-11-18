import { expect, test } from '@playwright/test';
import { publicRoutes } from './helpers';

/**
 * Google Analytics is off unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set at build time
 * (docs/ANALYTICS.md). The suite's normal build has no ID: nothing of it may show.
 * The switched-on build is covered by analytics-on.spec.ts.
 */

/** The public site's policy without analytics, word for word (next.config.ts). */
const SITE_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; " +
  "media-src 'self'; FRAME; object-src 'none'; base-uri 'self'; form-action 'self'; " +
  "frame-ancestors 'none'; upgrade-insecure-requests";

test.describe('analytics off (no Measurement ID)', () => {
  test('the Content-Security-Policy names no Google host and is otherwise unchanged', async ({ request }) => {
    for (const route of ['/', '/speakers', '/no-such-page']) {
      const csp = (await request.get(route)).headers()['content-security-policy'] ?? '';
      expect(csp, route).not.toMatch(/google/i);
      // frame-src follows the ticket checkout embed (content/tickets.yaml), so it is compared loosely.
      expect(csp.replace(/frame-src [^;]+/, 'FRAME'), route).toBe(SITE_CSP);
    }
  });

  test('the HTML carries no trace of analytics', async ({ request }) => {
    for (const route of publicRoutes()) {
      const html = await (await request.get(route)).text();
      expect(html, route).not.toMatch(/googletagmanager|google-analytics|G-TEST/);
    }
  });

  test('no request leaves the site and nothing is queued, on the home page and a topic page', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const foreign: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/^https?:/.test(url) && new URL(url).origin !== origin) foreign.push(url);
    });
    for (const route of ['/', '/speakers']) {
      await page.goto(route, { waitUntil: 'load' });
      // Longer than the switched-on build ever waits before it asks for gtag.js after load.
      await page.waitForTimeout(5000);
      const state = await page.evaluate(() => ({
        dataLayer: typeof window.dataLayer,
        gtag: typeof window.gtag,
        scripts: [...document.scripts].map((s) => s.src).filter((src) => /google/i.test(src)),
      }));
      expect(state, route).toEqual({ dataLayer: 'undefined', gtag: 'undefined', scripts: [] });
    }
    expect(foreign).toEqual([]);
  });
});
