import { gsap, ScrollTrigger, SplitText } from '../gsap';

/**
 * Global `data-reveal` system.
 *
 *   data-reveal="lines"   SplitText lines, masked, rise in
 *       data-reveal-variant="shear"  lines rise with a shear (left edge leads), slower: display headlines
 *   data-reveal="chars"   per character (words masked), rise in
 *   data-reveal="fade"    fade + small translate up
 *   data-reveal="stagger" direct children one after another (batched per row)
 *       data-reveal-variant="wipe"  children reveal with a clip-path wipe instead of a fade
 *   data-reveal="rule"    hairline draws left to right (scaleX)
 *   data-reveal-delay="0.2" optional, seconds
 *
 * Each element is "armed" (data-reveal-armed) in the same synchronous step that
 * sets its start state, which lifts the CSS pre-reveal hide in globals.css.
 * Splits are reverted once the reveal completes, so the final DOM is the
 * original server markup again (best for screen readers, zoom and resizes).
 */

/** `now` finishes the reveal immediately (e.g. when keyboard focus lands inside it). */
type Rec = { el: HTMLElement; kill: () => void; now: (target: Element) => void };

const finishTween = (t: gsap.core.Tween | null | undefined) => {
  if (!t) return;
  // kill(revert, allowAnimation): keep the tween alive, or progress(1) never renders.
  t.scrollTrigger?.kill(false, true);
  t.progress(1);
};

/**
 * Touch / small screens get shorter, snappier reveals that start a little
 * earlier (a thumb flick covers a lot of ground). Read once per scan.
 */
const COMPACT_MQ = '(max-width: 767.98px), (pointer: coarse)';
let T = { dur: 1, dist: 1, stagger: 1, start: 'top 90%' };
function tune() {
  const compact = window.matchMedia(COMPACT_MQ).matches;
  T = compact ? { dur: 0.7, dist: 0.6, stagger: 0.6, start: 'top 94%' } : { dur: 1, dist: 1, stagger: 1, start: 'top 90%' };
}
const records: Rec[] = [];
const done = new WeakSet<Element>();

const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[tabindex]';

function arm(el: HTMLElement) {
  el.setAttribute('data-reveal-armed', '');
}

function delayOf(el: HTMLElement) {
  const d = parseFloat(el.dataset.revealDelay ?? '');
  return Number.isFinite(d) ? d : 0;
}

/*
 * Layout invariant for split reveals: the split text must occupy exactly the box
 * of the unsplit text before, during and after the reveal, or reverting the
 * split shifts everything below it (CLS). Pieces of that:
 *
 * - Mask boxes are exactly line boxes: no padding/margin, room for descenders
 *   comes from a clip-path (globals.css, `.rv-line-mask`).
 * - Lines are measured from the real layout: words are wrapped in plain inline
 *   spans while SplitText measures them (`tag: 'span'`). Inline-block word boxes
 *   re-flow differently, most visibly under `text-wrap: balance`, and the split
 *   would then have a different number of lines. Line spans are made blocks in
 *   globals.css.
 * - Block wrappers are split themselves, never sliced from their parent: a
 *   heading whose text sits in a `<span class="block">`, or a bio of several
 *   <p>. SplitText slices nested elements word by word, and each block slice
 *   re-flows (and re-balances) the rest of the text, which can add a line.
 *   Margins between blocks (`space-y-*`) also stay where they are instead of
 *   moving onto every line mask.
 * - `text-indent` is inherited by every line block but only indents the first
 *   line of the unsplit text (hanging punctuation): reset it on the others.
 * - Safety net: if a split still does not reproduce the unsplit box, it is
 *   dropped and the element gets the plain fade reveal instead.
 *
 * Re-splits (resize, web font swap) go through SplitText's autoSplit, which
 * reverts, re-splits from the new layout and resumes the tween at its time.
 */
const isInlineLevel = (n: Element) => getComputedStyle(n).display.startsWith('inline');
const isOutOfFlow = (n: Element) => /^(absolute|fixed)$/.test(getComputedStyle(n).position);

function lineTargets(el: HTMLElement): HTMLElement[] {
  const kids = (Array.from(el.children) as HTMLElement[]).filter((k) => !isOutOfFlow(k));
  const looseText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
  if (looseText || !kids.length || kids.some(isInlineLevel)) return [el];
  return kids.flatMap(lineTargets);
}

function pinLines(self: SplitText) {
  for (const line of self.lines as HTMLElement[]) {
    // First line of its split element: no line mask before it.
    if (line.parentElement?.previousElementSibling?.classList.contains('rv-line-mask')) line.style.textIndent = '0';
  }
}

function revealSplit(el: HTMLElement, kind: 'lines' | 'chars'): Rec {
  const delay = delayOf(el);
  const heading = /^H[1-6]$/.test(el.tagName);
  const shear = kind === 'lines' && el.dataset.revealVariant === 'shear';
  const interactive = el.querySelector(INTERACTIVE) !== null;
  const unsplitHeight = el.getBoundingClientRect().height;

  // Accessibility: headings get aria-label (+ hidden split). Running text split into
  // lines stays plain text (it still reads naturally). Char-split non-headings read
  // from a visually hidden copy while the split copy is aria-hidden.
  const targets = kind === 'lines' ? lineTargets(el) : [el];
  let target: HTMLElement | HTMLElement[] = targets;
  let aria: 'auto' | 'none' = 'none';
  let unwrap: (() => void) | null = null;
  if (heading && !interactive) {
    aria = 'auto';
    if (targets[0] !== el) {
      // The split runs on blocks inside the heading: the heading itself carries the label.
      const label = el.getAttribute('aria-label');
      el.setAttribute('aria-label', (el.textContent ?? '').trim());
      unwrap = () => (label === null ? el.removeAttribute('aria-label') : el.setAttribute('aria-label', label));
    }
  } else if (kind === 'chars' && !interactive) {
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = el.textContent;
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    visual.style.display = 'inherit';
    while (el.firstChild) visual.appendChild(el.firstChild);
    el.append(sr, visual);
    target = visual;
    unwrap = () => {
      if (!visual.isConnected) return;
      while (visual.firstChild) el.insertBefore(visual.firstChild, sr);
      sr.remove();
      visual.remove();
    };
  }

  let finished = false;
  let split: SplitText | null = null;
  let current: gsap.core.Tween | null = null;
  const restore = () => {
    split?.kill();
    split?.revert();
    split = null;
    unwrap?.();
    unwrap = null;
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    done.add(el);
    // Restore the original markup on the next frame (after the last tween render).
    requestAnimationFrame(restore);
  };

  split = SplitText.create(target, {
    type: kind === 'lines' ? 'lines' : 'words,chars',
    mask: kind === 'lines' ? 'lines' : 'words',
    linesClass: 'rv-line',
    wordsClass: 'rv-word',
    charsClass: 'rv-char',
    // Lines: measure from the real inline layout (see above). Chars keep SplitText's
    // inline-block wrappers, which they need to move.
    ...(kind === 'lines' ? { tag: 'span' } : null),
    aria,
    autoSplit: true,
    onSplit(self: SplitText) {
      if (kind === 'lines') pinLines(self);
      if (finished) return;
      const parts = kind === 'lines' ? self.lines : self.chars;
      current = gsap.from(parts, {
        yPercent: kind === 'lines' ? 105 : 110,
        ...(shear ? { skewY: 6, transformOrigin: '0% 100%' } : null),
        duration: (shear ? 1.5 : kind === 'lines' ? 1.25 : 1) * T.dur,
        ease: 'expo.out',
        stagger: (shear ? 0.13 : kind === 'lines' ? 0.1 : 0.024) * T.stagger,
        delay,
        scrollTrigger: { trigger: el, start: T.start, once: true },
        onComplete: finish,
      });
      return current;
    },
  });

  if (Math.abs(el.getBoundingClientRect().height - unsplitHeight) > 0.5) {
    // The split would change the layout (see above): reveal the element whole instead.
    finished = true;
    restore();
    return revealFade(el);
  }

  return {
    el,
    now: () => finishTween(current),
    kill: () => {
      finished = true;
      restore();
    },
  };
}

function revealFade(el: HTMLElement): Rec {
  const tween = gsap.from(el, {
    opacity: 0,
    y: 28 * T.dist,
    duration: 1.2 * T.dur,
    ease: 'expo.out',
    delay: delayOf(el),
    clearProps: 'opacity,transform',
    scrollTrigger: { trigger: el, start: T.start, once: true },
    onComplete: () => void done.add(el),
  });
  return { el, kill: () => tween.revert(), now: () => finishTween(tween) };
}

function revealRule(el: HTMLElement): Rec {
  const tween = gsap.from(el, {
    scaleX: 0,
    transformOrigin: '0% 50%',
    duration: 1.6 * T.dur,
    ease: 'power4.inOut',
    delay: delayOf(el),
    clearProps: 'transform',
    scrollTrigger: { trigger: el, start: 'top 95%', once: true },
    onComplete: () => void done.add(el),
  });
  return { el, kill: () => tween.revert(), now: () => finishTween(tween) };
}

function revealStagger(el: HTMLElement, onScreen: ((c: Element) => boolean) | null): Rec {
  // Cold load: children already painted on screen stay as they are (see scanReveals).
  const children = (Array.from(el.children) as HTMLElement[]).filter((c) => !onScreen?.(c));
  const wipe = el.dataset.revealVariant === 'wipe';
  const delay = delayOf(el);
  // transition:none so CSS hover transitions on the children never smear the reveal.
  const from = wipe
    ? { clipPath: 'inset(100% 0% 0% 0%)', y: 48 * T.dist, transition: 'none' }
    : { opacity: 0, y: 32 * T.dist, transition: 'none' };
  const to = wipe ? { clipPath: 'inset(0% 0% 0% 0%)', y: 0 } : { opacity: 1, y: 0 };
  gsap.set(children, from);
  const tweens: gsap.core.Tween[] = [];
  const triggers = ScrollTrigger.batch(children, {
    start: T.start,
    once: true,
    onEnter: (batch) => {
      tweens.push(
        gsap.to(batch, {
          ...to,
          duration: (wipe ? 1.4 : 1.1) * T.dur,
          ease: 'expo.out',
          stagger: 0.11 * T.stagger,
          delay,
          clearProps: 'clipPath,opacity,transform,transition',
        }),
      );
    },
  });
  return {
    el,
    now: (target) => {
      const child = children.find((c) => c.contains(target));
      if (!child) return;
      triggers[children.indexOf(child)]?.kill();
      gsap.killTweensOf(child);
      gsap.set(child, { clearProps: 'clipPath,opacity,transform,transition' });
    },
    kill: () => {
      triggers.forEach((t) => t.kill());
      tweens.forEach((t) => t.kill());
      gsap.set(children, { clearProps: 'clipPath,opacity,transform,transition' });
    },
  };
}

function create(el: HTMLElement, onScreen: ((c: Element) => boolean) | null): Rec {
  switch (el.dataset.reveal) {
    case 'lines':
      return revealSplit(el, 'lines');
    case 'chars':
      return revealSplit(el, 'chars');
    case 'stagger':
      return revealStagger(el, onScreen);
    case 'rule':
      return revealRule(el);
    default:
      return revealFade(el);
  }
}

/**
 * Cold load vs. later scans. The server HTML paints fully visible (the CSS
 * pre-reveal hide only applies once `html[data-reveals]` is set), so the first
 * contentful paint is also the largest one and the engine arriving late never
 * delays LCP. On the first scan, reveals already painted inside the viewport
 * are left as they are, with no hide-then-animate; everything below the fold
 * is armed off screen as usual. After that scan the hide applies, so content
 * rendered later (client navigations under the curtain, back/forward) is hidden
 * from its first paint until armed, with the 3s failsafe in globals.css.
 */
const READY_ATTR = 'data-reveals';
const onScreenNow = (n: Element) => {
  const r = n.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight && r.width > 0 && r.height > 0;
};

/** Arms every not-yet-armed [data-reveal] element under `root`. */
export function scanReveals(root: ParentNode = document) {
  tune();
  const html = document.documentElement;
  const onScreen = html.hasAttribute(READY_ATTR) ? null : onScreenNow;
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal-armed])'));
  // Nested reveals: the outermost one owns the animation. Arm them all first,
  // before any outer split re-creates them.
  const own: HTMLElement[] = [];
  for (const el of els) {
    if (el.parentElement?.closest('[data-reveal]') || done.has(el)) arm(el);
    else if (onScreen && el.dataset.reveal !== 'stagger' && onScreen(el)) {
      done.add(el);
      arm(el);
    } else own.push(el);
  }
  for (const el of own) {
    // Everything a reveal creates (tweens, ScrollTriggers, batch delayedCalls, the
    // split) is recorded by its context, so kill() can let go of all of it.
    let r!: Rec;
    const ctx = gsap.context(() => {
      r = create(el, onScreen);
    });
    arm(el);
    records.push({
      el,
      now: r.now,
      kill: () => {
        r.kill();
        ctx.revert();
      },
    });
  }
  html.setAttribute(READY_ATTR, '');
}

/** Kills reveals whose elements left the document (route change). */
export function pruneReveals() {
  for (let i = records.length - 1; i >= 0; i--) {
    if (!records[i].el.isConnected) {
      records[i].kill();
      records.splice(i, 1);
    }
  }
}

/** Reverts everything (quality dropped to static, or teardown). */
export function killReveals() {
  for (const r of records) {
    r.kill();
    r.el.removeAttribute('data-reveal-armed');
  }
  records.length = 0;
  // A later scan (quality back up) starts from whatever is painted, like a cold load.
  document.documentElement.removeAttribute(READY_ATTR);
}

/** Keyboard focus must never land on something still hidden: finish its reveal now. */
export function revealFocused(target: Element) {
  for (const r of records) if (r.el.contains(target)) r.now(target);
}
