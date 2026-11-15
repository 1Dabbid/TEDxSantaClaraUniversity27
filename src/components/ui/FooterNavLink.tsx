'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navCurrent, type NavItem } from '../nav-links';

/**
 * A link in the footer's Site list. Client-side only to read the pathname: the
 * link of the page you are on carries aria-current, like the header's (rule at
 * the top of nav.ts), and is set in white.
 *
 * Clicking the link of the page you are already on goes back to the top, takes
 * any #section out of the address and moves focus to the main content, whatever
 * query string the address carries.
 * That is the site-wide rule for links to the current page (src/motion/inPage.ts),
 * so nothing is handled here.
 */
export function FooterNavLink({ item, className }: { item: NavItem; className: string }) {
  const pathname = usePathname();
  const current = navCurrent(item, pathname);
  return (
    <Link
      href={item.href}
      aria-current={current}
      className={`${className} ${current ? 'text-white' : ''}`}
    >
      {item.label}
    </Link>
  );
}
