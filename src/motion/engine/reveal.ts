import { gsap, ScrollTrigger, SplitText } from '../gsap';

/**
 * Global `data-reveal` system.
 *
 *   data-reveal="lines"   SplitText lines, masked, rise in
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
  t.scrollTrigger?.kill();
  t.progress(1);
};

const START = 'top 90%';
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

function revealSplit(el: HTMLElement, kind: 'lines' | 'chars'): Rec {
  const delay = delayOf(el);
  const heading = /^H[1-6]$/.test(el.tagName);
  const interactive = el.querySelector(INTERACTIVE) !== null;

  // Accessibility: headings get aria-label (+ hidden split). Running text split into
  // lines stays plain text (it still reads naturally). Char-split non-headings read
  // from a visually hidden copy while the split copy is aria-hidden.
  let target: HTMLElement = el;
  let aria: 'auto' | 'none' = 'none';
  let unwrap: (() => void) | null = null;
  if (heading && !interactive) {
    aria = 'auto';
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
  const finish = () => {
    if (finished) return;
    finished = true;
    done.add(el);
    // Restore the original markup on the next frame (after the last tween render).
    requestAnimationFrame(() => {
      split?.kill();
      split?.revert();
      split = null;
      unwrap?.();
      unwrap = null;
    });
  };

  split = SplitText.create(target, {
    type: kind === 'lines' ? 'lines' : 'words,chars',
    mask: kind === 'lines' ? 'lines' : 'words',
    linesClass: 'rv-line',
    wordsClass: 'rv-word',
    charsClass: 'rv-char',
    aria,
    autoSplit: true,
    onSplit(self: SplitText) {
      if (finished) return;
      const parts = kind === 'lines' ? self.lines : self.chars;
      current = gsap.from(parts, {
        yPercent: kind === 'lines' ? 105 : 110,
        duration: kind === 'lines' ? 1.25 : 1,
        ease: 'expo.out',
        stagger: kind === 'lines' ? 0.1 : 0.024,
        delay,
        scrollTrigger: { trigger: el, start: START, once: true },
        onComplete: finish,
      });
      return current;
    },
  });

  return {
    el,
    now: () => finishTween(current),
    kill: () => {
      finished = true;
      split?.kill();
      split?.revert();
      split = null;
      unwrap?.();
    },
  };
}

function revealFade(el: HTMLElement): Rec {
  const tween = gsap.from(el, {
    opacity: 0,
    y: 28,
    duration: 1.2,
    ease: 'expo.out',
    delay: delayOf(el),
    clearProps: 'opacity,transform',
    scrollTrigger: { trigger: el, start: START, once: true },
    onComplete: () => void done.add(el),
  });
  return { el, kill: () => tween.revert(), now: () => finishTween(tween) };
}

function revealRule(el: HTMLElement): Rec {
  const tween = gsap.from(el, {
    scaleX: 0,
    transformOrigin: '0% 50%',
    duration: 1.6,
    ease: 'power4.inOut',
    delay: delayOf(el),
    clearProps: 'transform',
    scrollTrigger: { trigger: el, start: 'top 95%', once: true },
    onComplete: () => void done.add(el),
  });
  return { el, kill: () => tween.revert(), now: () => finishTween(tween) };
}

function revealStagger(el: HTMLElement): Rec {
  const children = Array.from(el.children) as HTMLElement[];
  const wipe = el.dataset.revealVariant === 'wipe';
  const delay = delayOf(el);
  // transition:none so CSS hover transitions on the children never smear the reveal.
  const from = wipe
    ? { clipPath: 'inset(100% 0% 0% 0%)', y: 48, transition: 'none' }
    : { opacity: 0, y: 32, transition: 'none' };
  const to = wipe ? { clipPath: 'inset(0% 0% 0% 0%)', y: 0 } : { opacity: 1, y: 0 };
  gsap.set(children, from);
  const tweens: gsap.core.Tween[] = [];
  const triggers = ScrollTrigger.batch(children, {
    start: START,
    once: true,
    onEnter: (batch) => {
      tweens.push(
        gsap.to(batch, {
          ...to,
          duration: wipe ? 1.4 : 1.1,
          ease: 'expo.out',
          stagger: 0.11,
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

/** Arms every not-yet-armed [data-reveal] element under `root`. */
export function scanReveals(root: ParentNode = document) {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal-armed])'));
  for (const el of els) {
    // Nested reveals: the outermost one owns the animation.
    const outer = el.parentElement?.closest('[data-reveal]');
    if (outer || done.has(el)) {
      arm(el);
      continue;
    }
    let rec: Rec | null = null;
    switch (el.dataset.reveal) {
      case 'lines':
        rec = revealSplit(el, 'lines');
        break;
      case 'chars':
        rec = revealSplit(el, 'chars');
        break;
      case 'stagger':
        rec = revealStagger(el);
        break;
      case 'rule':
        rec = revealRule(el);
        break;
      default:
        rec = revealFade(el);
    }
    arm(el);
    records.push(rec);
  }
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
}

/** Keyboard focus must never land on something still hidden: finish its reveal now. */
export function revealFocused(target: Element) {
  for (const r of records) if (r.el.contains(target)) r.now(target);
}
