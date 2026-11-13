/**
 * Defensive checks for editor content, used by the loader (src/lib/content.ts)
 * at build time and by `npm run check:content`.
 *
 * The rule: a mistake made in the admin (or in a hand-edited YAML file) must
 * never break the deploy or a page. Anything that cannot be used safely is
 * dropped (the site then shows its "to be announced" / "portrait to follow"
 * state or hides the button) and a warning names the content file and the field
 * as the admin labels it. Only problems that would break a page outright (a file
 * that is not valid YAML, a value the admin cannot produce) still stop the build,
 * and their messages say where to look (see describeContentError in content.ts).
 *
 * Pure functions with no Next.js, Keystatic or Node imports: keystatic.config.ts
 * (which also runs in the browser) uses the patterns, and tests call them directly.
 * Image checks, which read files, are in content-images.ts.
 */

import {
  THEME_COPY_DEFAULTS,
  THEME_COPY_OPTIONAL_FIELDS,
  THEME_COPY_PLACEHOLDER_FIELDS,
  type ThemeCopy,
} from './theme-copy';

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export type ContentWarning = {
  /** Repository path of the content file, e.g. "content/tickets.yaml". */
  file: string;
  /** The field as the admin labels it, e.g. "Ticket link". */
  field: string;
  message: string;
};

const warnings = new Map<string, ContentWarning>();

/** Records a content warning (once per process) and prints it to the build log. */
export function contentWarning(file: string, field: string, message: string): void {
  const key = `${file}\u0000${field}\u0000${message}`;
  if (warnings.has(key)) return;
  warnings.set(key, { file, field, message });
  console.warn(`Content warning: ${file} › ${field}: ${message}`);
}

/** Every warning recorded so far in this process. */
export function contentWarnings(): ContentWarning[] {
  return [...warnings.values()];
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/** Lowercase letters and digits in dash-separated groups: "jane-doe", "speaker-01". */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MESSAGE = 'Use lowercase letters, numbers and dashes, like jane-doe.';

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** What the admin's link fields accept: blank, or a full https:// address with no spaces. */
export const HTTPS_URL_PATTERN = /^$|^https:\/\/\S+$/;
export const HTTPS_URL_MESSAGE = 'Paste the full address starting with https://, e.g. https://www.example.com/page. Or leave it blank.';

/** A bare domain with an optional path: "www.example.com/x", "eventbrite.com/e/123". */
const BARE_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#]\S*)?$/i;
/** An Instagram handle on its own: "@scutedx", "@scu.tedx" or "scutedx". */
const INSTAGRAM_HANDLE = /^@?([a-z0-9._]{1,30})$/i;

export type LinkResult = { url: string; note?: string };

/**
 * Turns whatever an editor typed into a safe absolute https:// link, or '' (the
 * button or link is then hidden). Never returns a relative link.
 *
 * - blank → ''
 * - `https://…` → kept (if it parses as a URL with a real host)
 * - `http://…` → upgraded to https:// (the site itself is https only)
 * - `www.example.com/x` → `https://www.example.com/x`
 * - Instagram only: `@handle` or `handle` → `https://www.instagram.com/handle`
 * - anything else (`/relative`, `javascript:`, `not a url`) → ''
 *
 * `note` explains any change, for a warning.
 */
export function normalizeLink(raw: string | null | undefined, kind: 'web' | 'instagram' = 'web'): LinkResult {
  const v = (raw ?? '').trim();
  if (!v) return { url: '' };

  let candidate = v;
  let note: string | undefined;
  if (/^https:\/\//i.test(v)) {
    candidate = v;
  } else if (/^http:\/\//i.test(v)) {
    candidate = `https://${v.slice(7)}`;
    note = `changed "${v}" to start with https://`;
  } else if (kind === 'instagram' && INSTAGRAM_HANDLE.test(v) && (v.startsWith('@') || !v.includes('.'))) {
    // "@scu.tedx" is a handle; "scu.tedx" without the @ could be a domain, so it is not guessed.
    const handle = v.replace(/^@/, '');
    return { url: `https://www.instagram.com/${handle}`, note: `turned the handle "${v}" into https://www.instagram.com/${handle}` };
  } else if (BARE_DOMAIN.test(v)) {
    candidate = `https://${v}`;
    note = `added https:// to "${v}"`;
  } else {
    return { url: '', note: `"${v}" is not a full web address starting with https://, so the link is hidden` };
  }

  if (/\s/.test(candidate)) {
    return { url: '', note: `"${v}" contains spaces, so the link is hidden` };
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.username || u.password) throw new Error('bad');
    return { url: candidate, note };
  } catch {
    return { url: '', note: `"${v}" is not a valid web address, so the link is hidden` };
  }
}

// ---------------------------------------------------------------------------
// Dates, times, required text
// ---------------------------------------------------------------------------

/** True for a real calendar date written YYYY-MM-DD ("2027-02-30" is not one). */
export function isRealDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** "5:30 PM", "12:00 AM", "9:05PM". Hours 1–12, minutes 00–59. */
export const TIME_PATTERN = /^(1[0-2]|[1-9]):[0-5]\d\s?(AM|PM)$/i;

/** Text that must be present: '' and whitespace-only values fall back to `fallback`. */
export function requiredText(value: string | null | undefined, fallback: string, minLength = 1): { text: string; usedFallback: boolean } {
  const t = (value ?? '').trim();
  if (t.length >= minLength && /\S/.test(t)) return { text: t, usedFallback: false };
  return { text: fallback, usedFallback: true };
}

// ---------------------------------------------------------------------------
// FAQ placeholders
// ---------------------------------------------------------------------------

/** The placeholders FAQ answers (and questions) and placeholder theme copy may use. Documented in the admin. */
export const FAQ_PLACEHOLDERS = ['capacity', 'date', 'venue', 'campus', 'eventName'] as const;
export type FaqPlaceholder = (typeof FAQ_PLACEHOLDERS)[number];
/** Placeholders only FAQ answers may use: {interestUrl} (Tickets & applications › Interest form link). */
export const FAQ_ONLY_PLACEHOLDERS = ['interestUrl'] as const;
export type FaqOnlyPlaceholder = (typeof FAQ_ONLY_PLACEHOLDERS)[number];

/**
 * Replaces each {name} that `values` has a value for ({capacity}, {date}, {venue},
 * {campus}, {eventName}, and in FAQ answers {interestUrl}). Unknown {words} are
 * left as typed and returned in `unknown`, so a typo can be warned about.
 */
export function fillPlaceholders(
  text: string,
  values: Record<FaqPlaceholder, string> & Partial<Record<FaqOnlyPlaceholder, string>>,
): { text: string; unknown: string[] } {
  const unknown: string[] = [];
  const known: Record<string, string | undefined> = values;
  const out = text.replace(/\{([A-Za-z]+)\}/g, (whole, name: string) => {
    if (Object.hasOwn(known, name) && typeof known[name] === 'string') return known[name];
    unknown.push(whole);
    return whole;
  });
  return { text: out, unknown };
}

// ---------------------------------------------------------------------------
// Theme copy
// ---------------------------------------------------------------------------

/**
 * Theme copy (content/theme-copy.yaml) with the built-in defaults filled in. A
 * blank or missing line falls back to THEME_COPY_DEFAULTS, except the optional
 * ones (the footnotes, the partners edition card), which an editor may blank on
 * purpose to hide them (a blank value in an existing file; a missing file still
 * gets every default). Placeholders are filled like FAQ answers; an unknown one
 * is shown as typed, with a warning.
 */
export function resolveThemeCopy(
  raw: Partial<Record<keyof ThemeCopy, string | null | undefined>> | null | undefined,
  values: Record<FaqPlaceholder, string>,
): ThemeCopy {
  const optional = new Set<string>(THEME_COPY_OPTIONAL_FIELDS);
  const placeholders = new Set<string>(THEME_COPY_PLACEHOLDER_FIELDS);
  const out = {} as ThemeCopy;
  for (const key of Object.keys(THEME_COPY_DEFAULTS) as (keyof ThemeCopy)[]) {
    const value = raw?.[key];
    let text = (value ?? '').trim();
    if (!text && !(optional.has(key) && raw && typeof value === 'string')) text = THEME_COPY_DEFAULTS[key];
    if (placeholders.has(key)) {
      const r = fillPlaceholders(text, values);
      for (const u of r.unknown) {
        contentWarning(
          'content/theme-copy.yaml',
          key,
          `${u} is not a known placeholder (use {capacity}, {date}, {venue}, {campus} or {eventName}); it is shown as typed.`,
        );
      }
      text = r.text;
    }
    out[key] = text;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Share images
// ---------------------------------------------------------------------------

/**
 * Removes emoji (pictographs, flags, skin-tone modifiers, keycaps, joiners and
 * variation selectors) from text drawn into a share image. The image renderer
 * would otherwise download emoji artwork from a third-party CDN during the
 * build, which fails offline and adds an outside dependency to every deploy.
 */
export function stripEmoji(text: string): string {
  return text
    // ©, ® and ™ are ordinary characters in the share-image font, so they stay.
    .replace(/(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[\u200D\uFE0E\uFE0F\u20E3]|[\u{E0020}-\u{E007F}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
