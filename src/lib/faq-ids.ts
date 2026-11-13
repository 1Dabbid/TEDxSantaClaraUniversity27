/**
 * Stable, unique ids for FAQ questions, so one question can be linked
 * (`/faq#tickets-on-sale`). Derived from the question as shown (placeholders
 * already filled in): lower case, ASCII letters and digits, filler words dropped,
 * at most six words. A repeated id gets "-2", "-3" in question order. The same
 * question always gives the same id, so links survive reordering and edits to
 * other questions; only rewording the question itself changes its address.
 */
const FILLER = new Set(['a', 'an', 'the', 'is', 'are', 'am', 'be', 'i', 'my', 'it', 'can', 'do', 'does', 'will', 'of']);

/**
 * Ids /faq itself renders (skip-link target, headings, footer): a question never
 * takes one of them. Checked against the rendered page in tests/e2e/topic-pages.spec.ts.
 */
export const RESERVED_IDS: ReadonlySet<string> = new Set([
  'main',
  'site-footer',
  'faq-page-title',
  'questions-title',
  'next-title',
  'footer-tedx',
  'footer-ted',
  'footer-site',
]);

/**
 * One slug. `reserved` ids get the `fallback` word appended; text with no ASCII
 * letters or digits becomes `fallback` itself (then uniqued by slugIds).
 */
export function faqSlug(question: string, reserved: ReadonlySet<string> = RESERVED_IDS, fallback = 'question'): string {
  const words = question
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const kept = words.filter((w) => !FILLER.has(w));
  const slug = (kept.length ? kept : words).slice(0, 6).join('-');
  if (!slug) return fallback;
  // An id must not start with a digit to be usable as a CSS selector without escaping.
  const safe = /^\d/.test(slug) ? `q-${slug}` : slug;
  return reserved.has(safe) ? `${safe}-${fallback}` : safe;
}

/** Unique ids for a list of headings on one page: slugs, never a reserved id, repeats get "-2", "-3". */
export function slugIds(texts: string[], reserved: ReadonlySet<string>, fallback: string): string[] {
  const used = new Set<string>(reserved);
  return texts.map((q) => {
    const base = faqSlug(q, reserved, fallback);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  });
}

export const faqIds = (questions: string[]): string[] => slugIds(questions, RESERVED_IDS, 'question');
