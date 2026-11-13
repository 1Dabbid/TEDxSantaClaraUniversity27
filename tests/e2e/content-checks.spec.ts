import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  contentWarnings,
  fillPlaceholders,
  HTTPS_URL_PATTERN,
  isRealDate,
  isValidSlug,
  normalizeLink,
  requiredText,
  resolveThemeCopy,
  stripEmoji,
  TIME_PATTERN,
} from '../../src/lib/content-checks';
import { checkImage, sniffImage } from '../../src/lib/content-images';
import { DEFAULT_SITE_URL, engravingLines, siteUrlFrom } from '../../src/lib/site';
import { THEME_COPY_DEFAULTS } from '../../src/lib/theme-copy';

/**
 * The loader's defensive normalisation (src/lib/content-checks.ts,
 * src/lib/content-images.ts), tested directly with temporary fixtures: nothing
 * here touches /content. No browser is used.
 */

test.describe('links', () => {
  test('full https links are kept', () => {
    expect(normalizeLink('https://www.eventbrite.com/e/123')).toEqual({ url: 'https://www.eventbrite.com/e/123' });
    expect(normalizeLink('  https://sendfox.com/tedx  ').url).toBe('https://sendfox.com/tedx');
    expect(normalizeLink('')).toEqual({ url: '' });
    expect(normalizeLink(null)).toEqual({ url: '' });
  });

  test('bare domains get https:// and http is upgraded', () => {
    expect(normalizeLink('www.eventbrite.com/e/123').url).toBe('https://www.eventbrite.com/e/123');
    expect(normalizeLink('youtube.com/live/abc').url).toBe('https://youtube.com/live/abc');
    expect(normalizeLink('http://example.com/x').url).toBe('https://example.com/x');
    expect(normalizeLink('www.example.com').note).toContain('added https://');
  });

  test('Instagram handles become profile links (only for Instagram)', () => {
    expect(normalizeLink('@scutedx', 'instagram').url).toBe('https://www.instagram.com/scutedx');
    expect(normalizeLink('scutedx', 'instagram').url).toBe('https://www.instagram.com/scutedx');
    expect(normalizeLink('@scu.tedx', 'instagram').url).toBe('https://www.instagram.com/scu.tedx');
    expect(normalizeLink('instagram.com/scutedx', 'instagram').url).toBe('https://instagram.com/scutedx');
    expect(normalizeLink('@scutedx').url).toBe('');
  });

  test('anything else is dropped, never a relative link', () => {
    for (const bad of ['/relative', 'not a url', 'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'ftp://x.example.com', 'https://', 'https://ok.example.com/a b', 'mailto:a@b.co', 'https://localhost', '@handle']) {
      const r = normalizeLink(bad);
      expect(r.url, bad).toBe('');
      expect(r.note, bad).toBeTruthy();
    }
  });

  test('the admin pattern accepts only blank or https://', () => {
    expect(HTTPS_URL_PATTERN.test('')).toBe(true);
    expect(HTTPS_URL_PATTERN.test('https://a.example.com/x')).toBe(true);
    expect(HTTPS_URL_PATTERN.test('www.example.com')).toBe(false);
    expect(HTTPS_URL_PATTERN.test('@handle')).toBe(false);
    expect(HTTPS_URL_PATTERN.test('https://a b')).toBe(false);
  });
});

test('slugs: lowercase letters, numbers and dashes only', () => {
  for (const ok of ['jane-doe', 'speaker-01', 'cornerstone-partner', 'a']) expect(isValidSlug(ok), ok).toBe(true);
  for (const bad of ['Jane Doe!', 'Jane-Doe', 'jane_doe', '-jane', 'jane-', 'jane--doe', '', 'jané']) expect(isValidSlug(bad), bad).toBe(false);
});

test('dates must exist on the calendar', () => {
  expect(isRealDate('2027-04-23')).toBe(true);
  expect(isRealDate('2028-02-29')).toBe(true);
  expect(isRealDate('2027-02-30')).toBe(false);
  expect(isRealDate('2027-02-29')).toBe(false);
  expect(isRealDate('2027-13-01')).toBe(false);
  expect(isRealDate('April 23, 2027')).toBe(false);
  expect(isRealDate('')).toBe(false);
});

test('times look like 5:30 PM', () => {
  for (const ok of ['5:30 PM', '12:00 AM', '9:05pm', '10:15 am']) expect(TIME_PATTERN.test(ok), ok).toBe(true);
  for (const bad of ['25:99 PM', '13:00 PM', '0:30 AM', '18:00', '6pm', '5:60 PM']) expect(TIME_PATTERN.test(bad), bad).toBe(false);
});

test('required TED text falls back when empty or whitespace-only', () => {
  expect(requiredText('   ', 'DEFAULT', 100)).toEqual({ text: 'DEFAULT', usedFallback: true });
  expect(requiredText('\n\t ', 'DEFAULT')).toEqual({ text: 'DEFAULT', usedFallback: true });
  expect(requiredText(undefined, 'DEFAULT')).toEqual({ text: 'DEFAULT', usedFallback: true });
  expect(requiredText('too short', 'DEFAULT', 100).usedFallback).toBe(true);
  const real = 'x'.repeat(120);
  expect(requiredText(`  ${real}  `, 'DEFAULT', 100)).toEqual({ text: real, usedFallback: false });
});

test('FAQ placeholders are filled in; unknown ones are reported', () => {
  const values = { capacity: '100', date: 'Friday, April 23, 2027', venue: 'Locatelli Student Activity Center', campus: 'Santa Clara University', eventName: 'TEDxSantaClaraUniversity' };
  const r = fillPlaceholders('{eventName}: {date}, at the {venue} on the {campus} campus, {capacity} seats. {price}', values);
  expect(r.text).toBe('TEDxSantaClaraUniversity: Friday, April 23, 2027, at the Locatelli Student Activity Center on the Santa Clara University campus, 100 seats. {price}');
  expect(r.unknown).toEqual(['{price}']);
  // {interestUrl} is known only where a value is passed (FAQ answers), not in theme copy.
  expect(fillPlaceholders('Form: {interestUrl}.', values).unknown).toEqual(['{interestUrl}']);
  expect(fillPlaceholders('Form: {interestUrl}.', { ...values, interestUrl: 'https://example.com' }).text).toBe('Form: https://example.com.');
});

test('Theme copy: blanks fall back to the defaults, optional lines can be hidden, placeholders are filled', () => {
  const values = { capacity: '80', date: 'Saturday, April 15, 2028', venue: 'Example Hall', campus: 'Santa Clara University', eventName: 'TEDxSantaClaraUniversity' };
  // No file at all: every default.
  expect(resolveThemeCopy(null, values).heroFootnote).toBe(THEME_COPY_DEFAULTS.heroFootnote);
  const c = resolveThemeCopy(
    { themeHeading: '  Take it from the top.  ', newsletterHeading: '', heroFootnote: '', partnersEditionTitle: '', partnersIntro: 'Up to {capacity} guests at the {venue}. {typo}' },
    values,
  );
  expect(c.themeHeading).toBe('Take it from the top.');
  expect(c.newsletterHeading).toBe(THEME_COPY_DEFAULTS.newsletterHeading);
  expect(c.heroFootnote).toBe('');
  expect(c.partnersEditionTitle).toBe('');
  expect(c.partnersIntro).toBe('Up to 80 guests at the Example Hall. {typo}');
  expect(c.partnerBandBody).toContain('TEDxSantaClaraUniversity returns, student-run');
  expect(c.partnerBandBody).toContain('80 seats');
  expect(contentWarnings().some((w) => w.file === 'content/theme-copy.yaml' && w.message.includes('{typo}'))).toBe(true);
});

test('SITE_URL: an https origin from the environment, else the default', () => {
  expect(siteUrlFrom(undefined)).toBe(DEFAULT_SITE_URL);
  expect(siteUrlFrom('')).toBe(DEFAULT_SITE_URL);
  expect(siteUrlFrom('https://seconddraft.tedxscu.com/')).toBe('https://seconddraft.tedxscu.com');
  expect(siteUrlFrom('http://seconddraft.tedxscu.com')).toBe(DEFAULT_SITE_URL);
  expect(siteUrlFrom('seconddraft.tedxscu.com')).toBe(DEFAULT_SITE_URL);
  expect(siteUrlFrom('https://seconddraft.tedxscu.com/path')).toBe(DEFAULT_SITE_URL);
});

test('engraving lines built from content match the engraving style', () => {
  expect(
    engravingLines({ themeName: 'Fine Print', dateLong: 'Friday, April 23, 2027', venueName: 'Locatelli Student Activity Center', capacity: 100 }),
  ).toEqual({ theme: 'FINE PRINT', dateLine: 'FRIDAY · APRIL 23 · 2027', venueLine: 'LOCATELLI STUDENT ACTIVITY CENTER', seatsLine: '100 SEATS' });
});

test('share-image text has no emoji', () => {
  expect(stripEmoji('Jane 🎤 Doe')).toBe('Jane Doe');
  expect(stripEmoji('Talk ❤️ 👩🏽‍💻 🇺🇸 1️⃣')).toBe('Talk 1');
  expect(stripEmoji('Plain © text')).toBe('Plain © text');
});

test.describe('images', () => {
  let dir = '';
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
  const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
  const ftyp = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftyp'), Buffer.from(brand), Buffer.from([0, 0, 0, 0]), Buffer.from('mif1'), Buffer.from('miaf')]);
  const PDF = Buffer.from('%PDF-1.4\n');
  const SVG = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const where = (field = 'Portrait') => ({ file: 'content/speakers/jane-doe.yaml', field });

  test.beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'content-images-'));
    mkdirSync(join(dir, 'images'));
    const files: Record<string, Buffer> = {
      'ok.jpg': JPEG,
      'ok.png': PNG,
      'ok.webp': WEBP,
      'ok.avif': ftyp('avif'),
      'iphone.jpg': ftyp('heic'),
      'photo.heic': ftyp('heic'),
      'doc.pdf': PDF,
      'renamed-pdf.jpg': PDF,
      'logo.svg': SVG,
      'svg-as.png': SVG,
      'big.jpg': Buffer.concat([JPEG, Buffer.alloc(2 * 1024 * 1024 + 10)]),
    };
    for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, 'images', name), data);
  });
  test.afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('sniffs real image types from their first bytes', () => {
    expect(sniffImage(JPEG)).toBe('jpeg');
    expect(sniffImage(PNG)).toBe('png');
    expect(sniffImage(WEBP)).toBe('webp');
    expect(sniffImage(ftyp('avif'))).toBe('avif');
    expect(sniffImage(ftyp('heic'))).toBeNull();
    expect(sniffImage(PDF)).toBeNull();
    expect(sniffImage(SVG)).toBe('svg');
  });

  test('keeps real JPG, PNG, WebP and AVIF photos', () => {
    for (const f of ['ok.jpg', 'ok.png', 'ok.webp', 'ok.avif']) expect(checkImage(`/images/${f}`, where(), dir), f).toBe(`/images/${f}`);
    expect(checkImage(null, where(), dir)).toBeNull();
  });

  test('drops wrong types and missing files with a warning naming file and field', () => {
    for (const f of ['iphone.jpg', 'photo.heic', 'doc.pdf', 'renamed-pdf.jpg', 'logo.svg', 'svg-as.png', 'missing.jpg']) {
      expect(checkImage(`/images/${f}`, where(), dir), f).toBeNull();
      expect(contentWarnings().some((w) => w.file === 'content/speakers/jane-doe.yaml' && w.field === 'Portrait' && w.message.includes(f)), f).toBe(true);
    }
    expect(checkImage('/images/../../etc/passwd', where(), dir)).toBeNull();
  });

  test('SVG is allowed only for sponsor logos', () => {
    expect(checkImage('/images/logo.svg', { ...where('Logo'), allowSvg: true }, dir)).toBe('/images/logo.svg');
    expect(checkImage('/images/svg-as.png', { ...where('Logo'), allowSvg: true }, dir)).toBeNull();
  });

  test('files over 2 MB are kept with a warning', () => {
    expect(checkImage('/images/big.jpg', where(), dir)).toBe('/images/big.jpg');
    expect(contentWarnings().some((w) => w.message.includes('big.jpg') && w.message.includes('2 MB'))).toBe(true);
  });
});
