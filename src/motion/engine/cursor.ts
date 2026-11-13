import { gsap } from '../gsap';

/**
 * Custom cursor: a dot, a trailing ring, and a glass loupe that truly magnifies
 * whatever `[data-cursor="loupe"]` element is beneath it (a static clone of the
 * target, scaled and offset every frame; only transforms are written).
 *
 * Only for fine, hovering pointers. The native cursor is hidden (html.has-cursor)
 * only after the custom one has received a real mouse move.
 */

const LINKISH = 'a[href], button, summary, label[for], [role="button"], [data-cursor="link"]';
const TEXTISH = 'input, textarea, select, [contenteditable="true"], iframe';
const DEFAULT_ZOOM = 2.4;

type State = 'default' | 'link' | 'loupe' | 'text';

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

  const setDot = { x: gsap.quickSetter(dot, 'x', 'px'), y: gsap.quickSetter(dot, 'y', 'px') };
  const setRing = { x: gsap.quickSetter(ring, 'x', 'px'), y: gsap.quickSetter(ring, 'y', 'px') };
  const setLens = { x: gsap.quickSetter(lens, 'x', 'px'), y: gsap.quickSetter(lens, 'y', 'px') };

  const setState = (s: State) => {
    if (s === state) return;
    state = s;
    root.dataset.state = s;
  };

  const clearLoupe = () => {
    loupeTarget = null;
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
    for (const n of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]) {
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
    content.replaceChildren(clone);
  };

  const resolve = (el: Element | null): State => {
    if (!el) return 'default';
    const tagged = el.closest<HTMLElement>('[data-cursor]');
    if (tagged?.dataset.cursor === 'loupe') {
      if (loupeTarget !== tagged) fillLoupe(tagged);
      return 'loupe';
    }
    if (loupeTarget) clearLoupe();
    if (el.closest(TEXTISH)) return 'text';
    if (tagged?.dataset.cursor === 'link' || el.closest(LINKISH)) return 'link';
    return 'default';
  };

  const show = (v: boolean) => {
    if (v === visible) return;
    visible = v;
    root.toggleAttribute('data-visible', v);
  };

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

  // After scrolling, the element under a still pointer changes: re-resolve occasionally.
  let lastResolve = 0;

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

    const now = performance.now();
    if (visible && now - lastResolve > 150) {
      lastResolve = now;
      setState(resolve(document.elementFromPoint(mx.x, mx.y)));
    }

    if (loupeTarget) {
      if (!loupeTarget.isConnected) {
        clearLoupe();
        setState('default');
        return;
      }
      const r = loupeTarget.getBoundingClientRect();
      const half = lensSize / 2;
      const tx = half - (pos.x - r.left) * zoom;
      const ty = half - (pos.y - r.top) * zoom;
      content.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${zoom})`;
    }
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('mouseout', onLeaveDoc);
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  gsap.ticker.add(tick);

  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('mouseout', onLeaveDoc);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    gsap.ticker.remove(tick);
    clearLoupe();
    html.classList.remove('has-cursor');
    root.removeAttribute('data-visible');
    root.dataset.state = 'default';
  };
}
