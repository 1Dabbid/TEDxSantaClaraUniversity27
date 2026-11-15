import { findHashTarget } from './anchor';
import { lenisRef } from './lenisRef';

/**
 * Links that stay on the page the visitor is already on: a section jump
 * (`/#tickets` on the home page) or the page's own link (logo, footer, menu).
 *
 * One rule for both tiers. The motion engine (engine/navigation.ts) uses it for
 * its animated scroll; `initInPageLinks` below covers everything else (reduced
 * motion, the static tier, the moments before the engine has loaded), where the
 * router would otherwise be asked to "navigate" to the page it is on.
 *
 * The query string of the current URL does not make it another page: visitors
 * arriving from a shared or campaign link (`/?utm_source=…`, `/?fbclid=…`) are
 * on the home page like everyone else. The current query is kept in the address
 * bar, so a `?quality=` switch keeps applying and campaign tags are not lost.
 *
 * No dependency on gsap or Lenis itself: this is part of the first-load bundle.
 */

export type InternalLink = { a: HTMLAnchorElement; url: URL };

/**
 * The same-origin page link under a click target, or null when the browser should
 * handle it: new-tab and download links, external origins, mailto/tel, the admin
 * and API routes, `data-no-transition`.
 */
export function internalLink(target: EventTarget | null): InternalLink | null {
  const a = (target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a) return null;
  if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return null;
  const href = a.getAttribute('href') ?? '';
  if (!href || href === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  if (url.pathname.startsWith('/keystatic') || url.pathname.startsWith('/api')) return null;
  return { a, url };
}

/** A plain primary-button click, not one that opens a new tab or window. */
export const plainClick = (e: MouseEvent) =>
  !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * Does `url` point at the page being shown? Same pathname, and either no query of
 * its own (the site's links never carry one) or the very same query.
 */
export function samePageLink(url: URL): boolean {
  return url.pathname === location.pathname && (url.search === '' || url.search === location.search);
}

const headerOffset = () => document.querySelector<HTMLElement>('[data-site-header]')?.offsetHeight ?? 0;

export function focusTarget(el: HTMLElement) {
  if (!el.hasAttribute('tabindex') && !el.matches('a[href],button,input,select,textarea,summary')) {
    el.setAttribute('tabindex', '-1');
  }
  el.focus({ preventScroll: true });
}

export function scrollToHash(hash: string, immediate = false): boolean {
  const el = findHashTarget(hash);
  if (!el) return false;
  const lenis = lenisRef.current;
  if (lenis) {
    // The offset is worked out here, from the window's own position, and not left to
    // Lenis (which would add the element's place on screen to the position it last
    // adopted): right after a native scroll (focus, scrollIntoView, the scrollbar)
    // that one can be a frame behind, and the glide would land beside the target.
    const style = getComputedStyle(el);
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const y = el.getBoundingClientRect().top + window.scrollY - pad - (parseFloat(style.scrollMarginTop) || 0);
    lenis.scrollTo(y, {
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

export function scrollTop(immediate: boolean) {
  const lenis = lenisRef.current;
  if (lenis) lenis.scrollTo(0, { immediate, force: true, duration: 1.4 });
  else window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' });
}

// An open mobile menu locks scrolling; wait until it has closed.
function whenMenuClosed(fn: () => void, frames = 0) {
  if (!document.documentElement.hasAttribute('data-menu-open') || frames > 40) {
    requestAnimationFrame(fn);
    return;
  }
  requestAnimationFrame(() => whenMenuClosed(fn, frames + 1));
}

/**
 * Follow a link for which samePageLink() is true: scroll to its section and move
 * focus there (adding a history entry, with the current query kept), or, without
 * a hash, go back to the top and move focus to the main content. A link to the
 * top takes a leftover #section out of the address (as its own history entry),
 * so the address never names a section the page is no longer showing.
 *
 * The history entry is added before the page moves. Without the motion engine
 * the browser restores positions on Back and Forward by itself, and the position
 * it keeps for the entry being left is the one at the moment of pushState: pushed
 * after the scroll, Back would change the address and leave the page where it is.
 */
export function followInPage(url: URL, immediate: boolean) {
  const go = () => {
    const here = location.pathname + location.search;
    if (url.hash) {
      if (!findHashTarget(url.hash)) return;
      if (url.hash !== location.hash) history.pushState(history.state, '', here + url.hash);
      scrollToHash(url.hash, immediate);
    } else {
      if (location.hash) history.pushState(history.state, '', here);
      scrollTop(immediate);
      document.getElementById('main')?.focus({ preventScroll: true });
    }
  };
  // While the mobile menu is open the page behind it cannot scroll or take focus.
  if (document.documentElement.hasAttribute('data-menu-open')) whenMenuClosed(go);
  else go();
}

/**
 * In-page links without the motion engine. Listens on the document in the capture
 * phase: the engine listens on the window, runs first and prevents the default,
 * so while it is running this does nothing. Never animated: this is the path for
 * reduced motion.
 */
export function initInPageLinks(): () => void {
  const onClick = (e: MouseEvent) => {
    if (!plainClick(e)) return;
    const hit = internalLink(e.target);
    if (!hit || !samePageLink(hit.url)) return;
    // Also keeps the router from re-navigating to the page it is on.
    e.preventDefault();
    followInPage(hit.url, true);
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
