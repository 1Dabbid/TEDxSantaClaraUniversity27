import { gsap } from '../gsap';
import { lenisRef } from '../lenisRef';

/**
 * Custom cursor: a dot, a trailing ring, and a glass loupe that truly magnifies
 * whatever `[data-cursor="loupe"]` element is beneath it.
 *
 * The lens content is a live copy of the target AND of the layers painted under
 * it (ancestor backgrounds, decorative scrims), scaled and offset together, so
 * the lens carries the real background instead of flat black. A MutationObserver
 * keeps the copy in sync while hovered (inline style changes, e.g. the Theme
 * scrub lighting phrases, are mirrored node for node; text changes re-copy).
 *
 * Idle cost is zero: there is no permanent ticker. Pointer moves, scrolls and
 * target mutations wake a short rAF loop that stops itself once the ring has
 * caught up with the pointer.
 *
 * `[data-cursor="none"]` (the logo links) opts out: the custom cursor is hidden
 * there and the native pointer shows, so nothing is ever drawn over the logo.
 *
 * Only for fine, hovering pointers. The native cursor is hidden (html.has-cursor)
 * only after the custom one has received a real mouse move.
 */

const LINKISH = 'a[href], button, summary, label[for], [role="button"], [data-cursor="link"]';
const TEXTISH = 'input, textarea, select, [contenteditable="true"], iframe';
const DEFAULT_ZOOM = 2.4;
const MAX_LAYERS = 8;

type State = 'default' | 'link' | 'loupe' | 'text' | 'none';

const transparent = (c: string) => c === 'transparent' || /rgba?\([^)]*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);

/** Copies the paint of an element's background into an absolutely placed div. */
function backgroundLayer(el: Element, origin: DOMRect): HTMLElement | null {
  const cs = getComputedStyle(el);
  const img = cs.backgroundImage;
  const color = cs.backgroundColor;
  const hasImg = img && img !== 'none';
  if (!hasImg && transparent(color)) return null;
  if (cs.visibility === 'hidden' || cs.display === 'none') return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const d = document.createElement('div');
  Object.assign(d.style, {
    position: 'absolute',
    left: `${r.left - origin.left}px`,
    top: `${r.top - origin.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    backgroundColor: color,
    backgroundImage: hasImg ? img : 'none',
    backgroundSize: cs.backgroundSize,
    backgroundPosition: cs.backgroundPosition,
    backgroundRepeat: cs.backgroundRepeat,
    borderRadius: cs.borderRadius,
    opacity: cs.opacity,
  } satisfies Partial<CSSStyleDeclaration>);
  return d;
}

/**
 * Layers under `target`, bottom first: each ancestor's own background, then its
 * decorative absolutely positioned siblings of the path (aria-hidden scrims),
 * then the next ancestor down. Bounded to MAX_LAYERS.
 */
function underLayers(target: HTMLElement, origin: DOMRect): HTMLElement[] {
  const chain: Element[] = [];
  for (let a = target.parentElement; a && a !== document.documentElement; a = a.parentElement) chain.unshift(a);
  const layers: HTMLElement[] = [];
  chain.forEach((anc, depth) => {
    const own = backgroundLayer(anc, origin);
    if (own) layers.push(own);
    const pathChild = chain[depth + 1] ?? target;
    for (const sib of Array.from(anc.children)) {
      if (sib === pathChild || sib.contains(target) || sib.getAttribute('aria-hidden') !== 'true') continue;
      const pos = getComputedStyle(sib).position;
      if (pos !== 'absolute' && pos !== 'fixed') continue;
      const l = backgroundLayer(sib, origin);
      if (l) layers.push(l);
    }
  });
  return layers.slice(-MAX_LAYERS);
}

export function initCursor(root: HTMLElement): () => void {
  const html = document.documentElement;
  const dot = root.querySelector<HTMLElement>('.cursor-dot')!;
  const ring = root.querySelector<HTMLElement>('.cursor-ring')!;
  const lens = root.querySelector<HTMLElement>('.cursor-lens')!;
  const lensBox = lens.firstElementChild as HTMLElement;
  const content = root.querySelector<HTMLElement>('.cursor-lens-content')!;
  const label = root.querySelector<HTMLElement>('.cursor-lens-label');

  const mx = { x: -100, y: -100 };
  const pos = { x: -100, y: -100 };
  let state: State = 'default';
  let loupeTarget: HTMLElement | null = null;
  let zoom = DEFAULT_ZOOM;
  let lensSize = 176;
  let visible = false;
  let running = false;
  let mirror = new Map<Node, HTMLElement>();
  let recopy = false;

  const setDot = { x: gsap.quickSetter(dot, 'x', 'px'), y: gsap.quickSetter(dot, 'y', 'px') };
  const setRing = { x: gsap.quickSetter(ring, 'x', 'px'), y: gsap.quickSetter(ring, 'y', 'px') };
  const setLens = { x: gsap.quickSetter(lens, 'x', 'px'), y: gsap.quickSetter(lens, 'y', 'px') };

  const setState = (s: State) => {
    if (s === state) return;
    state = s;
    root.dataset.state = s;
  };

  // Mirror inline style / class changes of the hovered target onto its copy.
  const observer = new MutationObserver((records) => {
    if (!loupeTarget) return;
    for (const r of records) {
      if (r.type === 'attributes' && r.attributeName) {
        const copy = mirror.get(r.target);
        const src = r.target as HTMLElement;
        if (!copy) continue;
        if (r.attributeName === 'style' && src !== loupeTarget) copy.setAttribute('style', src.getAttribute('style') ?? '');
        else if (r.attributeName === 'class') copy.className = src.className;
      } else {
        recopy = true;
      }
    }
    wake();
  });

  const clearLoupe = () => {
    loupeTarget = null;
    observer.disconnect();
    mirror = new Map();
    content.replaceChildren();
  };

  const fillLoupe = (target: HTMLElement) => {
    loupeTarget = target;
    zoom = parseFloat(target.dataset.cursorZoom ?? '') || DEFAULT_ZOOM;
    if (label) label.textContent = `×${zoom.toFixed(1)}`;
    lensSize = lensBox.offsetWidth || 176;
    const r = target.getBoundingClientRect();
    const cs = getComputedStyle(target);
    const clone = target.cloneNode(true) as HTMLElement;
    const srcNodes = [target, ...Array.from(target.querySelectorAll<HTMLElement>('*'))];
    const copyNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
    mirror = new Map();
    srcNodes.forEach((n, i) => mirror.set(n, copyNodes[i]));
    for (const n of copyNodes) {
      n.removeAttribute('id');
      n.removeAttribute('data-reveal');
      n.removeAttribute('data-cursor');
      n.removeAttribute('data-magnetic');
    }
    Object.assign(clone.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      margin: '0',
      width: `${r.width}px`,
      height: `${r.height}px`,
      boxSizing: 'border-box',
      transform: 'none',
      clipPath: 'none',
      opacity: '1',
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      textAlign: cs.textAlign,
      color: cs.color,
      columnCount: cs.columnCount,
      columnGap: cs.columnGap,
    } satisfies Partial<CSSStyleDeclaration>);
    content.replaceChildren(...underLayers(target, r), clone);
    observer.disconnect();
    observer.observe(target, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
  };

  const resolve = (el: Element | null): State => {
    if (!el) return 'default';
    const tagged = el.closest<HTMLElement>('[data-cursor]');
    if (tagged?.dataset.cursor === 'loupe') {
      if (loupeTarget !== tagged) fillLoupe(tagged);
      return 'loupe';
    }
    if (loupeTarget) clearLoupe();
    if (tagged?.dataset.cursor === 'none') return 'none';
    if (el.closest(TEXTISH)) return 'text';
    if (tagged?.dataset.cursor === 'link' || el.closest(LINKISH)) return 'link';
    return 'default';
  };

  const show = (v: boolean) => {
    if (v === visible) return;
    visible = v;
    root.toggleAttribute('data-visible', v);
  };

  let needsResolve = false;

  const tick = () => {
    const ease = state === 'loupe' ? 0.22 : 0.18;
    pos.x += (mx.x - pos.x) * ease;
    pos.y += (mx.y - pos.y) * ease;
    setDot.x(mx.x);
    setDot.y(mx.y);
    setRing.x(pos.x);
    setRing.y(pos.y);
    setLens.x(pos.x);
    setLens.y(pos.y);

    // The page moved under a still pointer: the element beneath may have changed.
    if (needsResolve && visible) {
      needsResolve = false;
      setState(resolve(document.elementFromPoint(mx.x, mx.y)));
    }

    if (loupeTarget) {
      if (!loupeTarget.isConnected) {
        clearLoupe();
        setState('default');
      } else {
        if (recopy) {
          recopy = false;
          fillLoupe(loupeTarget);
        }
        const r = loupeTarget.getBoundingClientRect();
        const half = lensSize / 2;
        const tx = half - (pos.x - r.left) * zoom;
        const ty = half - (pos.y - r.top) * zoom;
        content.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${zoom})`;
      }
    }

    // Sleep once the ring has caught up and nothing else is pending.
    if (Math.abs(mx.x - pos.x) < 0.1 && Math.abs(mx.y - pos.y) < 0.1 && !needsResolve && !recopy) {
      pos.x = mx.x;
      pos.y = mx.y;
      gsap.ticker.remove(tick);
      running = false;
    }
  };

  function wake() {
    if (running) return;
    running = true;
    gsap.ticker.add(tick);
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    mx.x = e.clientX;
    mx.y = e.clientY;
    if (!html.classList.contains('has-cursor')) {
      html.classList.add('has-cursor');
      pos.x = mx.x;
      pos.y = mx.y;
    }
    show(true);
    wake();
  };
  const onOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    setState(resolve(e.target as Element));
  };
  const onLeaveDoc = (e: MouseEvent) => {
    if (!e.relatedTarget) show(false);
  };
  const onDown = () => root.setAttribute('data-pressed', '');
  const onUp = () => root.removeAttribute('data-pressed');
  const onScroll = () => {
    if (!visible) return;
    needsResolve = true;
    wake();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('mouseout', onLeaveDoc);
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  const lenis = lenisRef.current;
  lenis?.on('scroll', onScroll);

  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('mouseout', onLeaveDoc);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('scroll', onScroll);
    lenis?.off('scroll', onScroll);
    gsap.ticker.remove(tick);
    running = false;
    clearLoupe();
    html.classList.remove('has-cursor');
    root.removeAttribute('data-visible');
    root.dataset.state = 'default';
  };
}
