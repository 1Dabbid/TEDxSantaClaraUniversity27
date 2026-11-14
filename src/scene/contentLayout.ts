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
  // The microphone's head and tail reach about 1.2% of the width right of the stand line.
  const hi = left - PANEL_AIR_PX - 0.012 * vw;
  const lo = colRight + AIR_PX + 6;
  const x = lo <= hi ? lo : (lo + hi) / 2;
  return Math.round((x / vw) * 200) / 200;
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
 * right, or undefined without that layout.
 */
export function measureTicketsX(): number | undefined {
  if (typeof document === 'undefined') return undefined;
  const aside = document.querySelector<HTMLElement>('[data-section="tickets"] aside');
  const col = aside?.previousElementSibling;
  const vw = window.innerWidth;
  if (!aside || !col || vw < 1) return undefined;
  const left = aside.getBoundingClientRect().left;
  if (left < vw * 0.5) return undefined;
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
