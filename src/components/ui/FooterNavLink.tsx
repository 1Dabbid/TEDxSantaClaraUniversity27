'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { lenisRef } from '@/motion/lenisRef';
import { navCurrent, type NavItem } from '../nav-links';

/**
 * A link in the footer's Site list. Client-side only to read the pathname: the
 * link of the page you are on carries aria-current, like the header's (rule at
 * the top of nav.ts), and is set in white.
 *
 * Clicking the link of the page you are already on goes back to the top. With
 * motion on, the navigation engine does that; without it (reduced motion, the
 * static tier) nothing would happen, so this does it.
 */
export function FooterNavLink({ item, className }: { item: NavItem; className: string }) {
  const pathname = usePathname();
  const current = navCurrent(item, pathname);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (current !== 'page' || lenisRef.current) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.getElementById('main')?.focus({ preventScroll: true });
  };
  return (
    <Link
      href={item.href}
      aria-current={current}
      onClick={onClick}
      className={`${className} ${current ? 'text-white' : ''}`}
    >
      {item.label}
    </Link>
  );
}
