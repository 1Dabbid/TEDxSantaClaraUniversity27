/**
 * Small DOM helpers shared by the section moments (Venue, Tickets, Team,
 * Newsletter, Footer, Partners). Imported only from the lazily loaded setup
 * functions' modules; no gsap here, so nothing heavy is pulled in.
 *
 * Every helper that changes the DOM returns a `revert` that puts the original
 * server nodes back exactly, so a route change, a quality drop or a media query
 * flip leaves the markup as it was rendered.
 */

/** Long, scrubbed versions: a mouse or trackpad on a wide screen. */
export const FULL = '(hover: hover) and (pointer: fine) and (min-width: 768px)';
/** Touch and small screens: shorter, simpler, played once (the complement of FULL). */
export const COMPACT = '(hover: none), (pointer: coarse), (max-width: 767.98px)';

/** Still below the fold: safe to set a hidden start state without a visible jump. */
export function belowFold(el: Element): boolean {
  return el.getBoundingClientRect().top >= window.innerHeight;
}

/**
 * Safe to scrub: below the fold (starts hidden, unseen) or already scrolled past
 * (the scrub lands on its end state, which is the static design). Mid-range on
 * setup (a deep link or reload) the moment is skipped and the section stays static.
 */
export function scrubbable(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.top >= window.innerHeight || r.bottom <= 0;
}

/**
 * Visual copy for assistive tech: the original text goes into an sr-only span
 * and everything visible moves into an aria-hidden wrapper that can be split
 * and animated freely. Skipped when the host is already aria-hidden.
 */
export function visualCopy(el: HTMLElement): { visual: HTMLElement; revert: () => void } {
  if (el.closest('[aria-hidden="true"]')) return { visual: el, revert: () => {} };
  const original = Array.from(el.childNodes);
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = el.textContent;
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  visual.append(...original);
  el.append(sr, visual);
  return {
    visual,
    revert: () => {
      el.append(...original);
      sr.remove();
      visual.remove();
    },
  };
}

export type Piece = { ch: string; mask: HTMLElement; inner: HTMLElement };

type MaskOptions = {
  /** Return a list of glyphs to stack in a rolling strip (odometer wheel) for this character, or null. */
  strip?: (ch: string, index: number) => string[] | null;
  /** Insert a break opportunity after every character (keeps overflow-wrap: anywhere working). */
  wbr?: boolean;
  /** Only split characters matching this (others stay plain text). Default: every non-space. */
  only?: RegExp;
};

/**
 * Replaces every text node under `el` with one clipping mask per character.
 * A mask is an inline-block with the same advance and baseline as the glyph it
 * replaces (tabular figures keep widths identical), clipped by clip-path so the
 * baseline is untouched: no layout shift. `inner` is what gets animated: the
 * glyph itself, or the strip of a wheel.
 */
export function maskText(el: HTMLElement, { strip, wbr = false, only = /\S/ }: MaskOptions = {}) {
  const pieces: Piece[] = [];
  const swaps: { original: Text; created: Node[] }[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    if (t.parentElement?.closest('.sr-only')) continue;
    texts.push(t);
  }

  for (const t of texts) {
    const created: Node[] = [];
    for (const ch of Array.from(t.data)) {
      if (!only.test(ch)) {
        created.push(document.createTextNode(ch));
        continue;
      }
      const mask = document.createElement('span');
      mask.className = 'mo-mask';
      const glyphs = strip?.(ch, pieces.length) ?? null;
      let inner: HTMLElement;
      if (glyphs) {
        mask.dataset.strip = '';
        const ghost = document.createElement('span');
        ghost.className = 'mo-ghost';
        ghost.textContent = ch;
        inner = document.createElement('span');
        inner.className = 'mo-strip';
        for (const g of glyphs) {
          const s = document.createElement('span');
          s.textContent = g;
          inner.append(s);
        }
        mask.append(ghost, inner);
      } else {
        inner = document.createElement('span');
        inner.className = 'mo-char';
        inner.textContent = ch;
        mask.append(inner);
      }
      created.push(mask);
      if (wbr) created.push(document.createElement('wbr'));
      pieces.push({ ch, mask, inner });
    }
    const frag = document.createDocumentFragment();
    frag.append(...created);
    t.replaceWith(frag);
    swaps.push({ original: t, created });
  }

  return {
    pieces,
    revert: () => {
      for (const { original, created } of swaps) {
        const first = created[0];
        if (first?.parentNode) first.parentNode.insertBefore(original, first);
        created.forEach((n) => (n as ChildNode).remove());
      }
      swaps.length = 0;
    },
  };
}

/** Runs `fn` once if keyboard focus lands inside `el` (never leave a focused thing hidden). */
export function onFocusWithin(el: HTMLElement, fn: (target: Element) => void): () => void {
  const h = (e: FocusEvent) => {
    if (e.target instanceof Element) fn(e.target);
  };
  el.addEventListener('focusin', h);
  return () => el.removeEventListener('focusin', h);
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
