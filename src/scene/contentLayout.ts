import { portraitFraming, WIDE_COPY_MIN_WIDTH, WIDE_HERO_X_RANGE, WIDE_HERO_Y, WIDE_HERO_Y_LOWEST, WIDE_HERO_Y_MAX, wideCopyFraming } from './choreography';

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
 * The hero's microphone and the hero's copy: where the move's opening anchor
 * goes so the grille keeps clear of the copy (choreography.ts, ShotOptions
 * `heroX`, `heroY`, `wideCopy`).
 *
 * Landscape move: clear of the end of the headline. The grille's left edge sits
 * about 11% of the width left of the anchor; it keeps 2.5% of the width of
 * air, plus 1% for the words drifting apart as the hero scrolls out
 * (HeroMotion).
 *
 * Portrait move in a window that is not taller than wide (wideCopyFraming: a
 * half-screen browser window, a small tablet on its side): the microphone
 * stands at the right, beside the copy (`wideCopy`; choreography.ts,
 * wideOpening), where the layout leaves room for it. The hero's distance and
 * lens are fixed, so the microphone's size follows the frame's height
 * (GRILLE). From 640 px wide the headline and the facts row under it run
 * across the left half or more of the frame, and the anchor stands 3.5% of
 * the width plus `GRILLE.edge` right of them ("beside the headline").
 *
 * Under 640 px wide the headline is set at the phone's size and the rest of
 * the copy (the tagline, the buttons, the stacked facts) is a narrow column at
 * the left under it. One of three places, in this order:
 * - under the headline: in a near-square window the headline runs most of the
 *   width, so the grille stands under its end, right of the column (`heroY`:
 *   5% of the height of air under the headline's last line);
 * - beside the headline, as from 640 px: in a window clearly wider than tall
 *   the headline is short of the right edge and there is no room under it;
 * - where neither fits (a small window between the two shapes), whichever of
 *   the two, held at the nearest anchor the move can give (under the headline
 *   it may stand a little lower here: WIDE_HERO_Y_LOWEST), leaves the grille
 *   more air from the lines as they sit and as they scroll up past it
 *   (grilleAir). The phone's hero, with the microphone in the lower middle,
 *   would stand on the column there.
 * From 640 px, when the anchor beside the headline is past its limit (a longer
 * theme title), `wideCopy` is false: the grille would be pulled back onto the
 * headline's end, and the move opens on the phone's hero, with the microphone
 * under the copy.
 *
 * Nothing is set on a frame taller than wide (the phone's hero) or without
 * the hero.
 */
export type HeroPlace = { heroX?: number; heroY?: number; wideCopy: boolean };

/**
 * The grille in the hero of a wide-copy window, as fractions of the frame's
 * height: its centre sits `left` left of the anchor and `up` above it,
 * `radius` is its radius, and `edge` is how far left of the anchor its left
 * edge is taken to be (a little over `left` plus `radius`).
 */
const GRILLE = { left: 0.047, up: 0.064, radius: 0.069, edge: 0.123 } as const;

type Box = { right: number; bottom: number };

/** The hero's lines (page coordinates, so the same wherever the page is scrolled to): the headline's words, and the column under it. */
function heroLines(title: HTMLElement, column: Element[]): Box[] {
  const out: Box[] = [];
  const add = (r: DOMRect) => {
    if (r.width > 1 && r.height > 1) out.push({ right: r.right, bottom: r.bottom + window.scrollY });
  };
  for (const w of title.querySelectorAll<HTMLElement>('[data-hero-word]')) add(w.getBoundingClientRect());
  const range = document.createRange();
  for (const el of column) {
    if (el.matches('a, button')) add(el.getBoundingClientRect());
    else {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim() || n.parentElement?.closest('.sr-only')) continue;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) add(r);
      }
    }
  }
  return out;
}

/**
 * The least air (px) between the grille, with the anchor at (ax, ay), and the
 * hero's lines. The copy is set from the left, and the page scrolls up under
 * the microphone: a line level with the grille or below it has to end left of
 * it; a line above it only has to be clear of it as it sits.
 */
function grilleAir(ax: number, ay: number, lines: Box[], vw: number, vh: number): number {
  const cx = ax * vw - GRILLE.left * vh;
  const cy = (ay - GRILLE.up) * vh;
  const r = GRILLE.radius * vh;
  let air = Infinity;
  for (const b of lines) air = Math.min(air, b.bottom > cy - r ? cx - r - b.right : Math.hypot(Math.max(0, cx - b.right), cy - b.bottom) - r);
  return air;
}

export function measureHero(): HeroPlace {
  if (typeof document === 'undefined') return { wideCopy: false };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 1 || vh < 1) return { wideCopy: false };
  const title = document.querySelector<HTMLElement>('#hero-title');
  if (!portraitFraming(vw, vh)) {
    let right = -1;
    for (const w of title?.querySelectorAll<HTMLElement>('[data-hero-word]') ?? []) {
      // The words' own scroll-out drift is a transform: measure where they sit without it.
      const tx = new DOMMatrixReadOnly(getComputedStyle(w).transform === 'none' ? undefined : getComputedStyle(w).transform).m41;
      right = Math.max(right, w.getBoundingClientRect().right - tx);
    }
    return right < 0 ? { wideCopy: false } : { heroX: Math.round((right / vw + 0.145) * 200) / 200, wideCopy: false };
  }
  if (!wideCopyFraming(vw, vh)) return { wideCopy: false };
  // Without the hero's copy there is nothing to keep clear of: the move's own place at the right.
  if (!title) return { wideCopy: true };
  const facts = document.querySelector<HTMLElement>('.hero-facts');
  const anchorX = (right: number, air: number) => Math.round((right / vw + air + (GRILLE.edge * vh) / vw) * 200) / 200;
  const fitsX = (x: number) => x <= WIDE_HERO_X_RANGE[1] + 0.01;
  // The words' scroll-out drift is small against the air kept here: the lines as they sit.
  const factsRight = facts ? textRight(facts, vw) : -1;
  const copyRight = Math.max(factsRight, textRight(title, vw));
  if (copyRight < 0) return { wideCopy: true };
  const beside = anchorX(copyRight, 0.035);
  if (vw >= WIDE_COPY_MIN_WIDTH) return { heroX: beside, wideCopy: fitsX(beside) };

  // The column under the headline: the tagline and the buttons as well as the facts.
  const body = document.querySelector<HTMLElement>('[data-hero-body]');
  const column: Element[] = [...(body?.querySelectorAll<HTMLElement>('a:not(.scroll-cue), button') ?? [])];
  if (body?.firstElementChild) column.push(body.firstElementChild);
  if (facts) column.push(facts);
  let columnRight = factsRight;
  if (body?.firstElementChild) columnRight = Math.max(columnRight, textRight(body.firstElementChild, vw));
  for (const el of column) if (el.matches('a, button')) columnRight = Math.max(columnRight, el.getBoundingClientRect().right);
  let bottom = -1;
  for (const w of title.querySelectorAll<HTMLElement>('[data-hero-word]')) bottom = Math.max(bottom, w.getBoundingClientRect().bottom + window.scrollY);
  if (columnRight < 0 || bottom < 0) return { heroX: beside, wideCopy: fitsX(beside) };
  // A little more air than beside the headline: the column stands right under the grille.
  const underX = anchorX(columnRight, 0.045);
  const underY = Math.round((bottom / vh + GRILLE.up + GRILLE.radius + 0.05) * 100) / 100;
  if (fitsX(underX) && underY <= WIDE_HERO_Y_MAX + 0.01) return { heroX: underX, heroY: underY, wideCopy: true };
  if (fitsX(beside)) return { heroX: beside, wideCopy: true };
  // Neither fits: each held at the nearest anchor the move can give, by the air it leaves.
  const lines = heroLines(title, column);
  const held = [
    { heroX: Math.min(WIDE_HERO_X_RANGE[1], beside), heroY: undefined as number | undefined, ay: WIDE_HERO_Y },
    { heroX: Math.min(WIDE_HERO_X_RANGE[1], underX), heroY: Math.min(WIDE_HERO_Y_LOWEST, underY) as number | undefined, ay: Math.min(WIDE_HERO_Y_LOWEST, underY) },
  ].map((c) => ({ ...c, air: grilleAir(Math.max(WIDE_HERO_X_RANGE[0], c.heroX), c.ay, lines, vw, vh) }));
  const best = held[1].air > held[0].air ? held[1] : held[0];
  return { heroX: best.heroX, heroY: best.heroY, wideCopy: true };
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
