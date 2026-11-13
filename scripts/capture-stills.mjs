#!/usr/bin/env node
/**
 * Captures still frames of the 3D scene for visitors who never get the live
 * canvas (no JavaScript, reduced motion, Save-Data, software-only WebGL, ...).
 * The frames are rendered by the real scene in headless Chromium, so they are
 * exactly the live shots; src/components/SceneStills.tsx shows them.
 *
 *   npm run build            # once, if there is no production build yet
 *   npm run stills           # writes public/stills/*.avif + *.webp, commit them
 *
 * Server: uses STILLS_URL if it answers (e.g. a running `npm run start`),
 * otherwise starts `next start` on STILLS_PORT (default 3121) from the current
 * build and stops it afterwards.
 *
 * Options (environment):
 *   PW_CHROMIUM_PATH   a Chromium binary already on disk (otherwise Playwright's own)
 *   STILLS_URL         base URL of a running production server
 *   STILLS_PORT        port for the server this script starts (default 3121)
 *   STILLS_ONLY        comma-separated shot names or orientations, e.g. "hero,portrait"
 *   STILLS_RAW         directory for the lossless PNG captures (default: OS temp dir)
 *   STILLS_RESUME=1    keep PNGs already in STILLS_RAW, capture only the missing ones
 *   STILLS_ENCODE_ONLY=1  re-encode the PNGs in STILLS_RAW without capturing again
 *
 * Headless Chromium renders WebGL on SwiftShader (the CPU): one frame of the
 * high tier at 1600x900 can take a second or more. The script forces the scene
 * on (?quality=), turns off the automatic quality step-down (perf=off), snaps
 * the camera to the exact shot (scene-debug=1&snap=1), hides all DOM, waits for
 * the scene to settle over many frames and checks the frame is not black.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'stills');
const RAW = process.env.STILLS_RAW || path.join(tmpdir(), 'fineprint-stills');
const PORT = Number(process.env.STILLS_PORT ?? 3121);
const ONLY = (process.env.STILLS_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * The shots. `J` is the journey coordinate of src/scene/choreography.ts:
 * section k spans J = k..k+1 (k in SECTION_IDS order), the fraction is how far
 * the viewport centre has travelled through it. Pick a J where the shot holds
 * (see the comments above DESKTOP_SHOTS / PORTRAIT_SHOTS). `darken` multiplies
 * the encoded pixels (1 = as rendered) where text sits over a bright frame.
 */
const SHOTS = [
  // Hero: J 0 scrolls to the very top, the first frame a visitor sees.
  { name: 'hero', landscape: { J: 0 }, portrait: { J: 0 } },
  { name: 'theme', landscape: { J: 1.1 }, portrait: { J: 1.0 } },
  { name: 'speakers', landscape: { J: 2.2 }, portrait: { J: 2.15 } },
  { name: 'schedule', landscape: { J: 3.5 }, portrait: { J: 3.5 } },
  { name: 'venue', landscape: { J: 4.5 }, portrait: { J: 4.5 } },
];
const SECTION_ORDER = ['hero', 'theme', 'speakers', 'schedule', 'venue', 'tickets', 'team', 'faq', 'newsletter'];

/**
 * Compositions. Output sizes must match the width/height in SceneStills.tsx.
 * Budgets are per file (bytes): the encoder lowers quality until it fits.
 */
const ORIENTATIONS = {
  landscape: {
    context: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
    quality: 'high',
    size: [1600, 900],
    budget: { avif: 80_000, webp: 110_000 },
  },
  portrait: {
    context: { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    quality: 'low',
    size: [780, 1560],
    budget: { avif: 45_000, webp: 70_000 },
  },
};

const log = (...a) => console.log('[stills]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const onlyShots = ONLY.filter((o) => SHOTS.some((s) => s.name === o));
const onlyOrients = ONLY.filter((o) => o in ORIENTATIONS);
const wanted = (shot, orient) =>
  (onlyShots.length === 0 || onlyShots.includes(shot)) && (onlyOrients.length === 0 || onlyOrients.includes(orient));

const exists = (f) => stat(f).then(() => true, () => false);

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    throw new Error(
      'sharp is not installed. It normally comes with Next.js (node_modules/sharp); run `npm ci` and try again.',
    );
  }
}

/* ------------------------------------------------------------------------- */
/* Server                                                                    */
/* ------------------------------------------------------------------------- */

async function up(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  const url = process.env.STILLS_URL || `http://127.0.0.1:${PORT}`;
  if (await up(url)) {
    log(`using the server at ${url}`);
    return { url, stop: async () => {} };
  }
  try {
    await stat(path.join(ROOT, '.next', 'BUILD_ID'));
  } catch {
    throw new Error('No production build found: run `npm run build` first (or set STILLS_URL).');
  }
  log(`starting next start on :${PORT}`);
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 60; i++) {
    if (await up(url)) return { url, stop: async () => void child.kill() };
    await sleep(1000);
  }
  child.kill();
  throw new Error(`the server on :${PORT} did not come up`);
}

/* ------------------------------------------------------------------------- */
/* Capture                                                                   */
/* ------------------------------------------------------------------------- */

/** Scroll so the scene's journey coordinate is J (same formula as journey() in choreography.ts). */
async function scrollToJourney(page, J) {
  const y = await page.evaluate(
    ([J, order]) => {
      const k = Math.floor(J);
      const el = document.querySelector(`[data-section="${order[k]}"]`);
      if (!el) throw new Error(`no section ${order[k]}`);
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      const want = top + (J - k) * r.height - innerHeight / 2;
      return Math.max(0, Math.min(max, want));
    },
    [J, SECTION_ORDER],
  );
  await page.evaluate((y) => {
    const lenis = window.__fpPerf?.lenis;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, y);
  return { y, clamped: y === 0 || y >= (await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)) };
}

const sceneState = (page) => page.evaluate(() => window.__scene ?? null);

/**
 * Waits until the scene's J has stopped moving (and is near the target, unless
 * the scroll was clamped at the top or bottom), then for `frames` more frames.
 */
async function settle(page, J, { frames = 36, timeout = 240_000, clamped = false } = {}) {
  const t0 = Date.now();
  let startFrame = null;
  let last = null;
  let prevJ = NaN;
  while (Date.now() - t0 < timeout) {
    last = await sceneState(page);
    const still = last && Math.abs(last.J - prevJ) < 0.002;
    prevJ = last?.J ?? NaN;
    if (still && (clamped || Math.abs(last.J - J) < 0.04)) {
      startFrame ??= last.frame;
      if (last.frame - startFrame >= frames) return last;
    } else {
      startFrame = null;
    }
    await sleep(250);
  }
  throw new Error(`scene did not settle at J=${J} (last: ${JSON.stringify(last && { J: last.J, frame: last.frame })})`);
}

/** Mean and peak luminance (0..255) of a PNG buffer. */
async function brightness(sharp, png) {
  const { channels } = await sharp(png).stats();
  const [r, g, b] = channels;
  const mean = 0.2126 * r.mean + 0.7152 * g.mean + 0.0722 * b.mean;
  const peak = Math.max(r.max, g.max, b.max);
  return { mean, peak };
}

async function captureOrientation(browser, sharp, base, orient, shots) {
  const o = ORIENTATIONS[orient];
  const context = await browser.newContext({ ...o.context, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', (e) => log(`page error (${orient}): ${e.message}`));
  const url = `${base}/?quality=${o.quality}&perf=off&scene-debug=1&snap=1`;
  log(`${orient}: loading ${url}`);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('.scene-canvas canvas', { timeout: 120_000 });
  // Only the canvas: no header, sections, footer (and so no stills either).
  await page.addStyleTag({
    content:
      'main, header, footer, .skip-link { visibility: hidden !important; } html, body { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }',
  });
  await page.waitForFunction(() => (window.__scene?.frame ?? 0) > 2, null, { timeout: 180_000 });

  for (const shot of shots) {
    const { J } = shot[orient];
    const t0 = Date.now();
    const { clamped } = await scrollToJourney(page, J);
    let png;
    for (let attempt = 0; attempt < 4; attempt++) {
      const s = await settle(page, J, { frames: 24 + attempt * 24, clamped });
      png = await page.screenshot({ type: 'png' });
      const b = await brightness(sharp, png);
      log(`${orient} ${shot.name}: J=${s.J.toFixed(3)} step=${s.step} post=${s.post} mean=${b.mean.toFixed(1)} peak=${b.peak} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      if (s.step !== 0) log(`  warning: the scene stepped its quality down (step ${s.step}); is ?perf=off honoured?`);
      if (b.mean > 2 && b.peak > 80) break;
      log('  frame looks black, waiting longer');
      png = null;
    }
    if (!png) throw new Error(`${orient} ${shot.name}: the frame stayed black`);
    const [w, h] = o.size;
    const meta = await sharp(png).metadata();
    if (meta.width !== w || meta.height !== h) throw new Error(`${orient} ${shot.name}: got ${meta.width}x${meta.height}, want ${w}x${h}`);
    await writeFile(path.join(RAW, `${shot.name}-${orient}.png`), png);
  }
  await context.close();
}

/* ------------------------------------------------------------------------- */
/* Encode                                                                    */
/* ------------------------------------------------------------------------- */

/** Encodes at the highest quality that fits the budget. */
async function encodeFitting(sharp, png, format, budget, darken) {
  const qualities = format === 'avif' ? [66, 62, 58, 54, 50, 46, 42, 38, 34] : [80, 76, 72, 66, 60, 54, 48, 42];
  let out;
  for (const q of qualities) {
    let img = sharp(png);
    if (darken !== 1) img = img.linear(darken, 0);
    img = format === 'avif' ? img.avif({ quality: q, effort: 7, chromaSubsampling: '4:2:0' }) : img.webp({ quality: q, effort: 6, smartSubsample: true });
    out = { buf: await img.toBuffer(), q };
    if (out.buf.length <= budget) return out;
  }
  log(`  ${format}: over budget even at q${out.q} (${out.buf.length} B)`);
  return out;
}

async function encode(sharp, shots) {
  await mkdir(OUT, { recursive: true });
  const rows = [];
  for (const shot of shots) {
    for (const orient of Object.keys(ORIENTATIONS)) {
      if (!wanted(shot.name, orient)) continue;
      const src = path.join(RAW, `${shot.name}-${orient}.png`);
      const png = await readFile(src);
      const darken = shot[orient].darken ?? 1;
      for (const format of ['avif', 'webp']) {
        const { buf, q } = await encodeFitting(sharp, png, format, ORIENTATIONS[orient].budget[format], darken);
        const file = `${shot.name}-${orient}.${format}`;
        await writeFile(path.join(OUT, file), buf);
        rows.push(`${file.padEnd(26)} ${String(buf.length).padStart(7)} B  q${q}`);
      }
    }
  }
  log(`wrote ${OUT}:\n  ${rows.join('\n  ')}`);
}

/* ------------------------------------------------------------------------- */

async function main() {
  const sharp = await loadSharp();
  const shots = SHOTS.filter((s) => Object.keys(ORIENTATIONS).some((o) => wanted(s.name, o)));
  await mkdir(RAW, { recursive: true });

  if (!process.env.STILLS_ENCODE_ONLY) {
    const server = await ensureServer();
    const browser = await chromium.launch({
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      // WebGL on SwiftShader (no GPU in headless). The site would normally keep the
      // scene off on a software renderer; ?quality= forces it on for the capture.
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    });
    try {
      for (const orient of Object.keys(ORIENTATIONS)) {
        const list = [];
        for (const s of shots.filter((s) => wanted(s.name, orient))) {
          if (process.env.STILLS_RESUME && (await exists(path.join(RAW, `${s.name}-${orient}.png`)))) {
            log(`${orient} ${s.name}: keeping the existing capture (STILLS_RESUME)`);
          } else list.push(s);
        }
        if (list.length) await captureOrientation(browser, sharp, server.url, orient, list);
      }
    } finally {
      await browser.close();
      await server.stop();
    }
    log(`raw PNGs in ${RAW}`);
  }
  await encode(sharp, shots);
  if (process.env.STILLS_CLEAN_RAW) await rm(RAW, { recursive: true, force: true });
}

main().catch((e) => {
  console.error('[stills]', e instanceof Error ? e.message : e);
  process.exit(1);
});
