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

export function faqSlug(question: string): string {
  const words = question
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const kept = words.filter((w) => !FILLER.has(w));
  const slug = (kept.length ? kept : words).slice(0, 6).join('-');
  if (!slug) return 'question';
  // An id must not start with a digit to be usable as a CSS selector without escaping.
  const safe = /^\d/.test(slug) ? `q-${slug}` : slug;
  return RESERVED_IDS.has(safe) ? `${safe}-question` : safe;
}

export function faqIds(questions: string[]): string[] {
  const used = new Set<string>();
  return questions.map((q) => {
    const base = faqSlug(q);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  });
}
