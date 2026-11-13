import { gsap } from '../gsap';
import { lenisRef } from '../lenisRef';

/**
 * Internal link handling for the App Router.
 *
 * - Same-page hash links: smooth Lenis scroll with header offset, URL updated,
 *   focus moved to the target.
 * - Other internal pages: a black curtain with a fine-print caption covers the
 *   page, router.push runs, and the curtain lifts when the new pathname has
 *   rendered (see `onRoute`). Scroll resets to the top (or the hash target) and
 *   focus moves to #main.
 * - Never intercepted: modified clicks, non-primary buttons, target/download
 *   links, external origins, /keystatic and /api, `data-no-transition`.
 * - Back/forward (popstate) is left to the router; the scroll position the
 *   visitor left a page at is restored.
 */

type Push = (href: string) => void;
type Router = { push: Push; prefetch: (href: string) => void };

// Curtain timings: snappier on touch / small screens.
const compact = () => window.matchMedia('(max-width: 767.98px), (pointer: coarse)').matches;
let IN = 0.55;
let OUT = 0.85;
const tuneCurtain = () => {
  const c = compact();
  IN = c ? 0.42 : 0.55;
  OUT = c ? 0.62 : 0.85;
};

export type Navigation = {
  onRoute: (initial: boolean) => void;
  destroy: () => void;
};

const headerOffset = () => document.querySelector<HTMLElement>('[data-site-header]')?.offsetHeight ?? 0;

function focusTarget(el: HTMLElement) {
  if (!el.hasAttribute('tabindex') && !el.matches('a[href],button,input,select,textarea,summary')) {
    el.setAttribute('tabindex', '-1');
  }
  el.focus({ preventScroll: true });
}

function findHashTarget(hash: string): HTMLElement | null {
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

export function scrollToHash(hash: string, immediate = false): boolean {
  const el = findHashTarget(hash);
  if (!el) return false;
  const lenis = lenisRef.current;
  if (lenis) {
    // Lenis already honours html { scroll-padding-top: var(--header-h) }.
    lenis.scrollTo(el, {
      immediate,
      force: true,
      duration: 1.6,
      easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    });
  } else {
    const y = el.getBoundingClientRect().top + window.scrollY - headerOffset();
    window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
  }
  focusTarget(el);
  return true;
}

function scrollTop(immediate: boolean) {
  const lenis = lenisRef.current;
  if (lenis) lenis.scrollTo(0, { immediate, force: true, duration: 1.4 });
  else window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' });
}

const keyOf = (url: URL | Location) => url.pathname + url.search;

export function initNavigation(router: Router, curtain: HTMLElement | null): Navigation {
  const html = document.documentElement;
  const positions = new Map<string, number>();
  const prefetched = new Set<string>();
  // We restore positions ourselves; the browser's own restoration would jump first.
  const prevRestoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  let pending: { url: URL; at: number } | null = null;
  let popped = false;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let tl: gsap.core.Timeline | null = null;
  let currentKey = keyOf(location);

  const caption = curtain?.querySelector<HTMLElement>('[data-curtain-caption]');
  const rule = curtain?.querySelector<HTMLElement>('.curtain-rule');

  const cover = () =>
    new Promise<void>((resolve) => {
      if (!curtain) return resolve();
      tuneCurtain();
      tl?.kill();
      tl = gsap
        .timeline()
        .set(curtain, { visibility: 'visible', clipPath: 'inset(100% 0% 0% 0%)' })
        .set(caption ?? [], { opacity: 0, y: 12 })
        .set(rule ?? [], { scaleX: 0 })
        .to(curtain, { clipPath: 'inset(0% 0% 0% 0%)', duration: IN, ease: 'power4.inOut' })
        .to(caption ?? [], { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, IN * 0.55)
        .to(rule ?? [], { scaleX: 0.7, duration: 1.4, ease: 'power2.out' }, IN * 0.55)
        // Navigate as soon as the page is covered (the caption keeps settling meanwhile).
        .call(resolve, [], IN + 0.02);
    });

  const uncover = () => {
    if (!curtain) return;
    tl?.kill();
    tl = gsap
      .timeline({
        onComplete: () => {
          gsap.set(curtain, { visibility: 'hidden', clipPath: 'inset(100% 0% 0% 0%)' });
        },
      })
      .to(rule ?? [], { scaleX: 1, duration: 0.3, ease: 'power2.out' })
      .to(caption ?? [], { opacity: 0, y: -8, duration: 0.35, ease: 'power2.in' }, 0.1)
      .to(curtain, { clipPath: 'inset(0% 0% 100% 0%)', duration: OUT, ease: 'power4.inOut' }, 0.2);
  };

  const finish = () => {
    clearTimeout(fallback);
    pending = null;
    html.classList.remove('nav-pending');
    uncover();
  };

  const navigate = async (url: URL) => {
    if (pending) return;
    pending = { url, at: performance.now() };
    positions.set(currentKey, lenisRef.current?.scroll ?? window.scrollY);
    html.classList.add('nav-pending');
    lenisRef.current?.stop();
    await cover();
    // If the route never changes (error, identical path), never leave the curtain down.
    fallback = setTimeout(() => {
      lenisRef.current?.start();
      finish();
    }, 5000);
    router.push(url.pathname + url.search + url.hash);
  };

  const internal = (target: EventTarget | null): { a: HTMLAnchorElement; url: URL } | null => {
    const a = (target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return null;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return null;
    const href = a.getAttribute('href') ?? '';
    if (!href || href === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return null;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return null;
    if (url.pathname.startsWith('/keystatic') || url.pathname.startsWith('/api')) return null;
    return { a, url };
  };

  const prefetch = (url: URL) => {
    const key = keyOf(url);
    if (key === keyOf(location) || prefetched.has(key)) return;
    prefetched.add(key);
    router.prefetch(key);
  };

  // Prefetch on intent so the push after the curtain resolves immediately.
  const onIntent = (e: Event) => {
    const hit = internal(e.target);
    if (hit) prefetch(hit.url);
  };

  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const hit = internal(e.target);
    if (!hit) return;
    const { url } = hit;

    const samePage = keyOf(url) === keyOf(location);
    if (samePage) {
      e.preventDefault();
      if (url.hash) {
        // Keyboard activation (detail 0) jumps: focus-driven scrolling is never animated.
        const instant = e.detail === 0;
        const go = () => {
          if (scrollToHash(url.hash, instant) && url.hash !== location.hash) {
            history.pushState(history.state, '', url.hash);
          }
        };
        // An open mobile menu locks scrolling; wait until it has closed.
        if (html.hasAttribute('data-menu-open')) whenMenuClosed(go);
        else go();
      } else {
        scrollTop(e.detail === 0);
        const main = document.getElementById('main');
        if (main) main.focus({ preventScroll: true });
      }
      return;
    }
    e.preventDefault();
    prefetch(url);
    void navigate(url);
  };

  const whenMenuClosed = (fn: () => void, frames = 0) => {
    if (!html.hasAttribute('data-menu-open') || frames > 40) {
      requestAnimationFrame(fn);
      return;
    }
    requestAnimationFrame(() => whenMenuClosed(fn, frames + 1));
  };

  // Track the position on the current page continuously (cheap: one number).
  const onScroll = () => {
    if (!pending && !popped) positions.set(currentKey, lenisRef.current?.scroll ?? window.scrollY);
  };

  // Where the Navigation API exists the router renders a traversal *before* popstate
  // fires, so learn about back/forward from the `navigate` event instead.
  type NavEvent = Event & { navigationType?: string; destination?: { url: string } };
  const navApi = (window as unknown as { navigation?: EventTarget }).navigation;
  const onNavigate = (e: Event) => {
    const ev = e as NavEvent;
    if (ev.navigationType !== 'traverse' || !ev.destination) return;
    if (keyOf(new URL(ev.destination.url)) !== currentKey) popped = true;
  };

  // Set while a route change has just been rendered in the current task. Without the
  // Navigation API (Firefox, Safari) the router may render the traversal inside its
  // own popstate listener, before ours runs: then currentKey is already the new page.
  let justRouted = false;

  const onPop = () => {
    if (popped) return; // route change already in progress (see onNavigate)
    if (justRouted) {
      popped = true; // the router got there first; onRoute reads this in its frame
      return;
    }
    if (keyOf(location) === currentKey) {
      // Same page, different hash entry: the router will not re-render, scroll here.
      requestAnimationFrame(() => {
        if (!(location.hash && scrollToHash(location.hash))) scrollTop(false);
      });
      return;
    }
    popped = true;
  };

  // Cold load on a deep link (/#tickets): the browser jumps before web fonts, the
  // Theme runway and section scripts have settled, so the target drifts. Re-land
  // on it once layout is final, unless the visitor has already moved on.
  const settleColdHash = () => {
    const hash = location.hash;
    if (!hash || !findHashTarget(hash)) return;
    let userMoved = false;
    const moved = () => {
      userMoved = true;
    };
    const opts = { passive: true, capture: true, once: true } as const;
    window.addEventListener('wheel', moved, opts);
    window.addEventListener('touchstart', moved, opts);
    window.addEventListener('keydown', moved, opts);
    const land = () => {
      if (userMoved || location.hash !== hash) return;
      lenisRef.current?.resize();
      const el = findHashTarget(hash);
      if (!el) return;
      const lenis = lenisRef.current;
      if (lenis) lenis.scrollTo(el, { immediate: true, force: true });
      else el.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      focusTarget(el);
    };
    const afterLayout = () => requestAnimationFrame(() => requestAnimationFrame(land));
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => {
      afterLayout();
      // Section scripts refresh ScrollTrigger (and the Theme fit) a little later.
      setTimeout(land, 400);
      if (document.readyState !== 'complete') window.addEventListener('load', () => setTimeout(land, 50), { once: true });
      setTimeout(() => {
        window.removeEventListener('wheel', moved, true);
        window.removeEventListener('touchstart', moved, true);
        window.removeEventListener('keydown', moved, true);
      }, 3000);
    });
  };

  const onRoute = (initial: boolean) => {
    currentKey = keyOf(location);
    justRouted = true;
    setTimeout(() => {
      justRouted = false;
    }, 0);
    if (initial) {
      settleColdHash();
      return;
    }
    const main = document.getElementById('main');
    const lenis = lenisRef.current;
    lenis?.start();
    if (pending) {
      const hash = pending.url.hash;
      // Wait one frame so the new page has laid out (and section scripts mounted).
      requestAnimationFrame(() => {
        lenis?.resize();
        if (!(hash && scrollToHash(hash, true))) {
          scrollTop(true);
          main?.focus({ preventScroll: true });
        }
        finish();
      });
      return;
    }
    // Back/forward or a router navigation we did not start. Read the saved position
    // now: scroll events fired while the new page settles must not overwrite it.
    // Whether it was a traversal is read in the frame (popstate may arrive after us).
    const saved = positions.get(currentKey);
    requestAnimationFrame(() => {
      const wasPop = popped;
      popped = false;
      lenis?.resize();
      if (wasPop && saved !== undefined) {
        if (lenis) lenis.scrollTo(saved, { immediate: true, force: true });
        else window.scrollTo(0, saved);
      } else if (location.hash) {
        scrollToHash(location.hash, true);
      } else {
        scrollTop(true);
      }
      main?.focus({ preventScroll: true });
    });
  };

  window.addEventListener('click', onClick, true);
  // Capture phase: must run before the router's own popstate listener, which renders
  // the new route synchronously (React flushes popstate updates immediately).
  window.addEventListener('popstate', onPop, true);
  navApi?.addEventListener('navigate', onNavigate);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('focusin', onIntent);

  return {
    onRoute,
    destroy: () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop, true);
      navApi?.removeEventListener('navigate', onNavigate);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
      history.scrollRestoration = prevRestoration;
      clearTimeout(fallback);
      tl?.kill();
      if (curtain) gsap.set(curtain, { clearProps: 'all' });
      html.classList.remove('nav-pending');
      lenisRef.current?.start();
    },
  };
}
