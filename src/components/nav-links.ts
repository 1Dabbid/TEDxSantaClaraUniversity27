/**
 * Client-safe half of the navigation rule (the rule itself is documented at the
 * top of nav.ts, which is server-only because it reads content).
 *
 * A header link always points at its topic page (`/venue`), on every page. Only
 * aria-current depends on the page it is rendered on, and usePathname is known
 * at build time, so the server HTML is already right and nothing changes on
 * hydration.
 */
export type NavItem = {
  readonly label: string;
  /** The topic page. */
  readonly href: string;
  /** The pages that exist inside this topic (/speakers/jane-doe). Any other path under it is a 404 and marks nothing. */
  readonly pages?: readonly string[];
};

const clean = (path: string | null | undefined) => {
  const p = (path ?? '/').split(/[?#]/)[0] || '/';
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
};

/**
 * aria-current for a header link: "page" on the topic page itself, "true" on a
 * page inside it that exists (/speakers/jane-doe under Speakers, listed in
 * `pages`), nothing anywhere else (the home page, a 404 under it).
 */
export function navCurrent(item: NavItem, pathname: string | null | undefined): 'page' | 'true' | undefined {
  const p = clean(pathname);
  if (p === item.href) return 'page';
  if (item.pages?.includes(p)) return 'true';
  return undefined;
}
