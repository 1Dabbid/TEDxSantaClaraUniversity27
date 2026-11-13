/**
 * Client-safe half of the navigation rule (the rule itself is documented at the
 * top of nav.ts, which is server-only because it reads content).
 *
 * A header item carries both of its addresses: `href`, the topic page
 * (`/venue`), and `home`, the home-page section (`/#venue`). Which one a link
 * uses depends only on the page it is rendered on, so the server HTML is already
 * right (usePathname is known at build time) and nothing changes on hydration.
 */
export type NavItem = {
  readonly label: string;
  /** The topic page: used everywhere except in the header on the home page. */
  readonly href: string;
  /** The home-page section, used by the header on `/`. Absent: always the page (Partners). */
  readonly home?: string;
};

const clean = (path: string | null | undefined) => {
  const p = (path ?? '/').split(/[?#]/)[0] || '/';
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
};

/** True on the home page, where the header scrolls through the story instead of leaving it. */
export const isHome = (pathname: string | null | undefined) => clean(pathname) === '/';

/** The address a header link points at on `pathname`. */
export function navHref(item: NavItem, pathname: string | null | undefined): string {
  return isHome(pathname) && item.home ? item.home : item.href;
}

/**
 * aria-current for a header link: "page" on the topic page itself, "true" on a
 * page inside it (/speakers/jane-doe under Speakers), nothing on the home page
 * (the header links there are in-page anchors, not the current page).
 */
export function navCurrent(item: NavItem, pathname: string | null | undefined): 'page' | 'true' | undefined {
  const p = clean(pathname);
  if (p === '/') return undefined;
  if (p === item.href) return 'page';
  if (p.startsWith(`${item.href}/`)) return 'true';
  return undefined;
}
