/**
 * Keeping the reader's place when the page layout changes under them.
 *
 * Two cases use it:
 * - The window is resized or a phone is rotated while the scroll engine runs
 *   (SmoothScroll): section heights are in viewport units, so the same scroll
 *   offset is a different section afterwards.
 * - `html.motion` is switched on or off after the first paint (MotionRoot): the
 *   motion layout has tall pinned runways the static layout does not, so a deep
 *   link (/#tickets) or the current section would otherwise be left behind.
 *
 * No dependency on gsap or Lenis: this is part of the first-load bundle.
 */

export type SectionBox = { id: string; top: number; height: number };

/**
 * A place on the page: a section and how far through it the viewport is (`p`, the
 * same 0..1 measure as scrollState.sections), or, between and after sections,
 * the distance of the viewport centre below that section's end (`after`, px).
 */
export type Anchor = { id: string; p: number; after: number | null };

export function findHashTarget(hash: string): HTMLElement | null {
  const raw = hash.replace(/^#/, '');
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // Malformed escape (e.g. #%E0%A4%A): look the hash up as written instead of throwing.
  }
  if (!id) return null;
  return document.getElementById(id);
}

/** Document positions of every scene section on the page, top to bottom. */
export function sectionBoxes(): SectionBox[] {
  const y = window.scrollY;
  const out: SectionBox[] = [];
  document.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (el.dataset.section) out.push({ id: el.dataset.section, top: r.top + y, height: r.height });
  });
  return out;
}

/** The place the viewport centre is at, or null at the very top or above the first section. */
export function pickAnchor(boxes: readonly SectionBox[], scrollY: number, vh: number): Anchor | null {
  if (scrollY < 2) return null;
  const centre = scrollY + vh / 2;
  let hit: SectionBox | null = null;
  for (const b of boxes) if (b.height > 0 && b.top <= centre && (!hit || b.top >= hit.top)) hit = b;
  if (!hit) return null;
  const end = hit.top + hit.height;
  return {
    id: hit.id,
    p: (scrollY + vh - hit.top) / (hit.height + vh),
    after: centre > end ? centre - end : null,
  };
}

/** The scroll offset that shows `anchor` in the layout described by `boxes`, or null if its section is gone. */
export function anchorScroll(anchor: Anchor, boxes: readonly SectionBox[], vh: number): number | null {
  const b = boxes.find((x) => x.id === anchor.id);
  if (!b) return null;
  const y = anchor.after === null ? b.top + anchor.p * (b.height + vh) - vh : b.top + b.height + anchor.after - vh / 2;
  return Math.max(0, Math.round(y));
}

// Has the visitor scrolled by hand since the page loaded? A deep link is only
// re-landed while they have not.
let userMoved = false;
if (typeof window !== 'undefined') {
  const moved = () => {
    userMoved = true;
    for (const t of INPUTS) window.removeEventListener(t, moved, true);
  };
  const INPUTS = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
  for (const t of INPUTS) window.addEventListener(t, moved, { passive: true, capture: true });
}

/**
 * Call right before a layout change made outside the scroll engine (`html.motion`
 * toggled); call the returned function right after it. The page then stays where
 * the reader was: on the deep link's target if they arrived on one and have not
 * scrolled since, otherwise in the same section at the same fraction. It lands
 * again as the new layout settles (fonts, section scripts reverting), and stops
 * at the first scroll input. Returns a no-op at the top of the page.
 */
export function holdPlace(): () => void {
  const hash = userMoved ? '' : window.location.hash;
  const target = hash ? findHashTarget(hash) : null;
  const anchor = target ? null : pickAnchor(sectionBoxes(), window.scrollY, window.innerHeight);
  if (!target && !anchor) return () => {};

  return () => {
    let live = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const stop = () => {
      live = false;
      timers.forEach(clearTimeout);
      for (const t of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.removeEventListener(t, stop, true);
      window.removeEventListener('load', onLoad);
    };
    const land = () => {
      if (!live) return;
      if (target) {
        if (window.location.hash !== hash || !target.isConnected) return stop();
        // Honours html { scroll-padding-top } (the header), like the browser's own jump.
        target.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      } else if (anchor) {
        const y = anchorScroll(anchor, sectionBoxes(), window.innerHeight);
        if (y !== null) window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      }
    };
    const onLoad = () => void timers.push(setTimeout(land, 50));
    for (const t of ['wheel', 'touchstart', 'keydown', 'mousedown']) {
      window.addEventListener(t, stop, { passive: true, capture: true });
    }
    land();
    requestAnimationFrame(() => requestAnimationFrame(land));
    timers.push(setTimeout(land, 400));
    void (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(land));
    if (document.readyState !== 'complete') window.addEventListener('load', onLoad, { once: true });
    timers.push(setTimeout(stop, 3000));
  };
}
