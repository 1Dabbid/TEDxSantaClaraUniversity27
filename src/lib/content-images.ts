import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { contentWarning } from './content-checks';

/**
 * Checks for images uploaded through the admin, run by the content loader at
 * build time (src/lib/content.ts) and by `npm run check:content`. A file of the
 * wrong type or a missing file never breaks the build: the image is dropped
 * with a warning and the page shows its "portrait to follow" state.
 */

export type ImageKind = 'jpeg' | 'png' | 'webp' | 'avif' | 'svg';

/** Larger uploads still work (the site serves resized copies) but bloat the repository. */
export const IMAGE_WARN_BYTES = 2 * 1024 * 1024;

const EXTENSION_KIND: Record<string, ImageKind> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  svg: 'svg',
};

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** Identifies an image from its first bytes ("magic numbers"), or null. */
export function sniffImage(head: Uint8Array): ImageKind | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => head[i] === v)) return 'png';
  if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'webp';
  if (head.length >= 12 && ascii(head, 4, 8) === 'ftyp') {
    // ISO-BMFF: the major brand, then compatible brands, inside the ftyp box. HEIC uses the same container.
    const boxEnd = Math.min(head.length, (head[0] << 24) | (head[1] << 16) | (head[2] << 8) | head[3]);
    const brands: string[] = [ascii(head, 8, 12)];
    for (let i = 16; i + 4 <= boxEnd; i += 4) brands.push(ascii(head, i, i + 4));
    if (brands.some((b) => b === 'avif' || b === 'avis')) return 'avif';
    return null;
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(head).replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(text)) return 'svg';
  return null;
}

const KIND_NAMES = 'JPG, PNG, WebP or AVIF';

/**
 * Checks an uploaded image referenced from content (a public path such as
 * "/images/speakers/jane-doe/photo.jpg"). Returns the path when the file exists
 * and really is an allowed image, otherwise null with a warning; the page then
 * shows its "portrait to follow" state instead of a broken image. Warns, but keeps
 * the image, when the file is larger than 2 MB. Never throws.
 *
 * `allowSvg`: only sponsor logos may be SVG.
 */
export function checkImage(
  publicPath: string | null | undefined,
  where: { file: string; field: string; allowSvg?: boolean },
  publicDir: string = join(process.cwd(), 'public'),
): string | null {
  const p = (publicPath ?? '').trim();
  if (!p) return null;
  const allowed = where.allowSvg ? `${KIND_NAMES} or SVG` : KIND_NAMES;
  const drop = (why: string) => {
    contentWarning(where.file, where.field, `${why} The image is left out until a ${allowed} file is uploaded.`);
    return null;
  };

  if (!p.startsWith('/') || p.includes('\\') || p.split('/').includes('..')) {
    return drop(`"${p}" is not an uploaded image path.`);
  }
  const ext = p.split('.').pop()?.toLowerCase() ?? '';
  const extKind = EXTENSION_KIND[ext];
  if (!extKind || (extKind === 'svg' && !where.allowSvg)) {
    return drop(`"${p}" is a .${ext} file, which cannot be shown here.`);
  }

  const abs = join(publicDir, p);
  let size: number;
  const head = new Uint8Array(512);
  let read = 0;
  try {
    size = statSync(abs).size;
    const fd = openSync(abs, 'r');
    try {
      read = readSync(fd, head, 0, head.length, 0);
    } finally {
      closeSync(fd);
    }
  } catch {
    return drop(`the file "${p}" was not found (it may have been renamed or deleted).`);
  }

  const kind = sniffImage(head.subarray(0, read));
  if (!kind) return drop(`"${p}" is not really an image the site can show (for example a PDF or an iPhone HEIC photo renamed).`);
  if (kind === 'svg' && !where.allowSvg) return drop(`"${p}" is an SVG file; photos must be ${KIND_NAMES}.`);
  if ((kind === 'svg') !== (extKind === 'svg')) return drop(`"${p}" does not contain what its name says.`);

  if (size > IMAGE_WARN_BYTES) {
    contentWarning(
      where.file,
      where.field,
      `"${p}" is ${(size / 1024 / 1024).toFixed(1)} MB. It still works, but please keep photos under 2 MB (export a smaller JPG) so the site repository stays small.`,
    );
  }
  return p;
}

/** File names a dropped-in team photo may have, in order of preference. */
export const TEAM_PHOTO_FILES = ['photo.jpg', 'photo.jpeg', 'photo.png', 'photo.webp'] as const;

/**
 * A team photo placed by hand at the path the admin's Photo field writes to
 * (public/images/team/<slug>/photo.jpg), for when the YAML does not name it yet.
 * Returns its public path, or '' when there is none.
 */
export function findTeamPhoto(slug: string, publicDir: string = join(process.cwd(), 'public')): string {
  for (const name of TEAM_PHOTO_FILES) {
    const rel = `/images/team/${slug}/${name}`;
    if (existsSync(join(publicDir, rel))) return rel;
  }
  return '';
}
