import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Origins allowed in `frame-src` (and for the Payment Request API inside the frame),
 * for the ticket checkout embed:
 * - the origin of `ticketEmbedUrl` in content/tickets.yaml (set in Keystatic under
 *   Tickets & speaker applications) is picked up automatically at build time, and
 * - `CSP_FRAME_SRC` (space-separated origins, e.g. "https://checkout.example.com
 *   https://js.stripe.com") adds more, for services that nest a second frame.
 * Headers are computed at build time, so a new embed link needs a rebuild (a Keystatic
 * save in GitHub mode already triggers one).
 */
function frameOrigins(): string[] {
  const origins = new Set<string>();
  try {
    const yaml = readFileSync(join(process.cwd(), 'content/tickets.yaml'), 'utf8');
    const raw = yaml.match(/^ticketEmbedUrl:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1];
    if (raw) origins.add(new URL(raw).origin);
  } catch {
    /* no file or no valid URL: nothing to allow */
  }
  for (const o of (process.env.CSP_FRAME_SRC ?? '').split(/\s+/)) {
    if (!o) continue;
    try {
      origins.add(new URL(o).origin);
    } catch {
      /* ignore malformed entries */
    }
  }
  return [...origins];
}

const frames = frameOrigins();

const csp = (directives: Record<string, string[]>) =>
  Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k))
    .join('; ');

// Vercel preview deployments inject the Vercel Toolbar (comments, share) from vercel.live.
const preview = process.env.VERCEL_ENV === 'preview';
const toolbar = (...extra: string[]) => (preview ? ['https://vercel.live', ...extra] : []);

/**
 * Public site. Every page is statically generated, so per-request nonces are not
 * possible: Next's inline RSC payload scripts and the motion boot script need
 * 'unsafe-inline'. Everything else is same-origin only; the site makes no
 * third-party requests (self-hosted fonts, no analytics). Preview deployments
 * additionally allow the Vercel Toolbar.
 */
const siteCsp = csp({
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...toolbar()],
  'style-src': ["'self'", "'unsafe-inline'", ...toolbar()],
  'img-src': ["'self'", 'data:', 'blob:', ...toolbar('https://vercel.com')],
  'font-src': ["'self'", 'data:', ...toolbar('https://assets.vercel.com')],
  'connect-src': ["'self'", ...(isDev ? ['ws:'] : []), ...toolbar('wss://ws-us3.pusher.com')],
  'worker-src': ["'self'", 'blob:'],
  'media-src': ["'self'"],
  'frame-src': frames.length || preview ? ["'self'", ...frames, ...toolbar()] : ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  ...(isDev ? {} : { 'upgrade-insecure-requests': [] }),
});

/**
 * Keystatic admin (/keystatic, /api/keystatic): the editor UI loads Google Fonts,
 * talks to GitHub in GitHub mode, previews uploads as blob: URLs and may use eval
 * in some editor plugins. Editors only; never indexed or cached.
 */
const adminCsp = csp({
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
  'connect-src': ["'self'", 'https://api.github.com', 'https://github.com', 'https://*.githubusercontent.com', 'https://api.keystatic.cloud', ...(isDev ? ['ws:'] : [])],
  'worker-src': ["'self'", 'blob:'],
  'frame-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'", 'https://github.com'],
  'frame-ancestors': ["'none'"],
});

const permissionsPolicy = [
  'accelerometer=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'usb=()',
  'browsing-topics=()',
  `payment=(${['self', ...frames.map((o) => `"${o}"`)].join(' ')})`,
].join(', ');

const common = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: permissionsPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  // allow-popups: checkout providers may open a payment popup that talks back to its opener.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const noStore = [
  { key: 'Cache-Control', value: 'no-store, max-age=0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `ANALYZE=1 next build` emits browser source maps so first-load chunks can be attributed per module.
  productionBrowserSourceMaps: process.env.ANALYZE === '1',
  // Inline the (Tailwind, ~11 KB brotli) stylesheet into the prerendered HTML: removes the
  // render-blocking CSS round trip on a cold load, which is nearly every visit to an event
  // site. Measured on emulated slow 4G + 4x CPU: home FCP/LCP ~1.35 s -> ~0.8 s. Brotli
  // dedupes the second copy Next keeps in the RSC payload. Client navigations still use <link>.
  experimental: { inlineCss: true },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Optimised portraits are re-generated at most once a week per size (sources only change on deploy).
    minimumCacheTTL: 604800,
  },
  async headers() {
    return [
      // Site pages (everything except the admin and its API). Next already serves
      // /_next/static/* as `public, max-age=31536000, immutable` and prerendered HTML is
      // cached and revalidated by the Vercel CDN, so only headers Next does not set are added.
      {
        source: '/((?!keystatic|api/keystatic).*)',
        headers: [...common, { key: 'Content-Security-Policy', value: siteCsp }],
      },
      { source: '/keystatic', headers: [...common, ...noStore, { key: 'Content-Security-Policy', value: adminCsp }] },
      { source: '/keystatic/:path*', headers: [...common, ...noStore, { key: 'Content-Security-Policy', value: adminCsp }] },
      { source: '/api/keystatic/:path*', headers: [...common, ...noStore] },
      // Files in /public keep stable names, so they get a day of caching plus a week of
      // background revalidation rather than `immutable`. (The header logo is imported and
      // therefore served from hashed /_next/static/media URLs instead.)
      {
        source: '/:dir(brand|images)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default nextConfig;
