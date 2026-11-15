import { portraitFraming, WIDE_COPY_MIN_WIDTH, WIDE_HERO_X_RANGE, WIDE_HERO_Y_MAX, wideCopyFraming } from './choreography';

/**
 * Measurements of the page copy that the camera move adapts to (landscape).
 *
 * Venue: the location plate sits at the top right and the facts row runs the
 * full width under it. Both sit in the centred content column, so their
 * place on screen depends on the viewport width. Over Venue the subject rides
 * in the gutter between the facts' text that ends left of the plate and the
 * plate itself: `AIR_PX` right of that text, and at least `AIR_PX` left of the
 * plate (midway when the gutter is narrower than that).
 */
const AIR_PX = 28;
/** Air kept from a panel's edge (a panel has its own dark backing; its edge is not copy). */
const PANEL_AIR_PX = 16;

/** Screen x (fraction of the width) for the subject over Venue, or undefined without the layout (phones, other routes). */
export function measureVenueX(): number | undefined {
  if (typeof document === 'undefined') return undefined;
  const plate = document.querySelector<HTMLElement>('[data-venue-plate]');
  const facts = document.querySelector<HTMLElement>('[data-venue-facts]');
  const vw = window.innerWidth;
  if (!plate || !facts || vw < 1) return undefined;
  const left = plate.getBoundingClientRect().left;
  // Stacked layout (the plate under the heading): nothing to fit between.
  if (left < vw * 0.5) return undefined;
  // The right edge of the facts' text (the columns' boxes are wider than their lines) left of the plate.
  const colRight = textRight(facts, left);
  if (colRight < 0) return undefined;
  // Seen from the crane over Venue the stand and the head sit up to about 1.8% of the width right
  // of the aim line, and the tail leans a little left, so where there is room the stand moves up to
  // 0.5% of the width further from the text. Where there is not, it keeps nearer the facts' text
  // than the plate: the plate stands beside it through the whole crane, while the facts' row only
  // rises to its height late in the section.
  const hi = left - PANEL_AIR_PX - 0.018 * vw;
  const lo = colRight + AIR_PX + 6;
  const x = lo <= hi ? lo + Math.min(0.005 * vw, hi - lo) : (lo + hi) / 2 - 0.002 * vw;
  return Math.round((x / vw) * 1000) / 1000;
}

/**
 * Screen x (fraction of the width) for the subject right of the Speakers panel
 * (speakers not announced yet: one glass panel along the bottom, whose width
 * follows the content column), or undefined without it.
 */
export function measureSpeakersX(): number | undefined {
  if (typeof document === 'undefined') return undefined;
  const panel = document.querySelector<HTMLElement>('.speakers-runway--tba .speakers-panel');
  const vw = window.innerWidth;
  if (!panel || vw < 1) return undefined;
  const r = panel.getBoundingClientRect();
  if (r.width > vw * 0.85) return undefined;
  return Math.round(((r.right + PANEL_AIR_PX) / vw) * 200) / 200;
}

/**
 * Screen x (fraction of the width) for the subject over Tickets: the middle of
 * the gap between the heading column's text and the ticket details at the
 * right (or the seat counter's second numeral, which comes up under that gap
 * as the camera comes down, when it starts further left), or undefined
 * without that layout.
 */
export function measureTicketsX(): number | undefined {
  if (typeof document === 'undefined') return undefined;
  const aside = document.querySelector<HTMLElement>('[data-section="tickets"] aside');
  const col = aside?.previousElementSibling;
  const vw = window.innerWidth;
  if (!aside || !col || vw < 1) return undefined;
  const asideLeft = aside.getBoundingClientRect().left;
  if (asideLeft < vw * 0.5) return undefined;
  const count = document.querySelector<HTMLElement>('[data-section="tickets"] [data-seat-count]')?.getBoundingClientRect().left;
  const left = count && count > vw * 0.5 ? Math.min(asideLeft, count) : asideLeft;
  const right = textRight(col, left);
  if (right < 0) return undefined;
  return Math.round(((right + left) / 2 / vw) * 200) / 200;
}

/** The right edge (px) of the text lines inside `root` that start left of `limit`. */
function textRight(root: Node, limit: number): number {
  let right = -1;
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim() || n.parentElement?.closest('.sr-only')) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.left < limit && r.right > right) right = r.right;
  }
  return right;
}

/**
 * Screen x (fraction of the width) for the hero's anchor so the grille keeps
 * clear of the hero's copy.
 *
 * Landscape move: clear of the end of the headline. The grille's left edge sits
 * about 11% of the width left of the anchor; it keeps 2.5% of the width of
 * air, plus 1% for the words drifting apart as the hero scrolls out
 * (HeroMotion).
 *
 * Portrait move in a window that is not taller than wide (a half-screen
 * browser window, a small tablet on its side): clear of the headline and of
 * the facts row under it, which run across the left half or more of the
 * frame. There the grille's left edge sits about 12.3% of the height left of
 * the anchor (the hero's distance and lens are fixed, so the microphone's
 * size follows the frame's height); the same air. Under 640 px wide the
 * headline runs most of the width, so there the grille stands under it
 * (measureHeroY) and clear of the copy below the headline: the tagline, the
 * buttons and the stacked facts, a narrow column at the left.
 *
 * Undefined on a frame taller than wide (the phone's hero: the copy is
 * stacked and the microphone stands under it) and without the hero.
 */
export function measureHeroX(): number | undefined {
  if (typeof document === 'undefined') return undefined;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 1 || vh < 1) return undefined;
  if (portraitFraming(vw, vh)) {
    if (!wideCopyFraming(vw, vh)) return undefined;
    const title = document.querySelector<HTMLElement>('#hero-title');
    const facts = document.querySelector<HTMLElement>('.hero-facts');
    if (!title) return undefined;
    // The words' scroll-out drift is small against the air kept here: the lines as they sit.
    let copyRight = facts ? textRight(facts, vw) : -1;
    if (vw >= WIDE_COPY_MIN_WIDTH) copyRight = Math.max(copyRight, textRight(title, vw));
    else {
      // The column under the headline: the tagline and the buttons as well as the facts.
      const body = document.querySelector<HTMLElement>('[data-hero-body]');
      const tagline = body?.firstElementChild;
      if (tagline) copyRight = Math.max(copyRight, textRight(tagline, vw));
      for (const a of body?.querySelectorAll<HTMLElement>('a:not(.scroll-cue), button') ?? []) copyRight = Math.max(copyRight, a.getBoundingClientRect().right);
    }
    if (copyRight < 0) return undefined;
    // A little more air in the small windows, where the column stands right under the grille.
    return Math.round((copyRight / vw + (vw >= WIDE_COPY_MIN_WIDTH ? 0.035 : 0.045) + (0.123 * vh) / vw) * 200) / 200;
  }
  let right = -1;
  for (const w of document.querySelectorAll<HTMLElement>('#hero-title [data-hero-word]')) {
    // The words' own scroll-out drift is a transform: measure where they sit without it.
    const tx = new DOMMatrixReadOnly(getComputedStyle(w).transform === 'none' ? undefined : getComputedStyle(w).transform).m41;
    right = Math.max(right, w.getBoundingClientRect().right - tx);
  }
  if (right < 0) return undefined;
  return Math.round((right / vw + 0.145) * 200) / 200;
}

/**
 * Screen y (fraction of the height) for the hero's anchor in a window that is
 * not taller than wide and under 640 px wide (a small near-square window),
 * where the headline runs most of the width: the grille stands under it. The
 * grille's centre sits about 6.4% of the height above the anchor and its
 * radius is about 6.9% of the height; it keeps 5% of the height of air under
 * the headline's last line. Undefined elsewhere (the move's own height).
 */
export function measureHeroY(): number | undefined {
  if (typeof document === 'undefined') return undefined;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 1 || vh < 1 || vw >= WIDE_COPY_MIN_WIDTH || !wideCopyFraming(vw, vh)) return undefined;
  let bottom = -1;
  // In page coordinates: the same wherever the page is scrolled to (the words' scroll-out drift is small against the air kept).
  for (const w of document.querySelectorAll<HTMLElement>('#hero-title [data-hero-word]')) bottom = Math.max(bottom, w.getBoundingClientRect().bottom + window.scrollY);
  if (bottom < 0) return undefined;
  return Math.round((bottom / vh + 0.183) * 100) / 100;
}

/**
 * Whether the portrait move opens with the microphone at the right, beside the
 * hero's copy (choreography.ts, wideOpening): a window that is not taller than
 * wide (wideCopyFraming), where the anchor the copy asks for (measureHeroX,
 * measureHeroY) is one the move can give. Where it is not (a longer theme
 * title, a very small window), the grille would be pulled back onto the copy's
 * end: the phone's hero, under the copy, is used instead.
 */
export function measureWideCopy(): boolean {
  if (typeof document === 'undefined') return false;
  if (!wideCopyFraming(window.innerWidth, window.innerHeight)) return false;
  const x = measureHeroX();
  const y = measureHeroY();
  return (x === undefined || x <= WIDE_HERO_X_RANGE[1] + 0.01) && (y === undefined || y <= WIDE_HERO_Y_MAX + 0.01);
}

/**
 * The Tickets room figure (the seat counter: two big numerals, the ruler, a caption line, then
 * empty space to the end of the section), as fractions of the viewport, or undefined without it.
 * Over the end of Tickets the grille comes down between the numerals and rides up in the empty
 * space under the caption (choreography.ts, endKeys). Rounded, so the shots are rebuilt only when
 * the layout really changes.
 */
export function measureTicketsRoom(): { gapL: number; gapR: number; hv: number; gap: number; num: number; air: number } | undefined {
  if (typeof document === 'undefined') return undefined;
  const sec = document.querySelector<HTMLElement>('[data-section="tickets"]');
  const count = sec?.querySelector<HTMLElement>('[data-seat-count]');
  const row = count?.parentElement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!sec || !count || !row || vw < 1 || vh < 1) return undefined;
  const bottom = sec.getBoundingClientRect().bottom;
  const height = sec.getBoundingClientRect().height;
  // The first numeral is the row's leading text; the second is the counter itself.
  const range = document.createRange();
  let first = -1;
  for (const n of row.childNodes) {
    if (n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    first = Math.max(first, range.getBoundingClientRect().right);
  }
  const second = count.getBoundingClientRect().left;
  if (first < 0 || second <= first) return undefined;
  // The last line of text in the section is the caption under the ruler (the counter's own digits
  // roll inside a clipped box: they are not lines of the page).
  let last = -1;
  const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim() || !n.parentElement || n.parentElement.closest('.sr-only') || row.contains(n)) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.height > 1 && r.bottom <= bottom && r.bottom > last) last = r.bottom;
  }
  const numBottom = row.getBoundingClientRect().bottom;
  if (last < numBottom) return undefined;
  const r3 = (v: number) => Math.round(v * 200) / 200;
  return {
    gapL: r3(first / vw),
    gapR: r3(second / vw),
    hv: Math.round((height / vh) * 100) / 100,
    gap: r3((bottom - last) / vh),
    num: r3((bottom - numBottom) / vh),
    air: Math.round((12 / vh) * 1000) / 1000,
  };
}
