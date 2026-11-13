import Link from 'next/link';
import type { ReactNode } from 'react';
import { Arrow } from '@/components/print/Print';

/**
 * A secondary action set as an underlined text link with the site's arrow: for
 * asks that repeat one already made by a button elsewhere on the page (the
 * mailing list in Speakers and Tickets; the hero and the closing section carry
 * the main asks as buttons). Web links open in a new tab and say so.
 */
export function TextLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  const external = /^(https?:|mailto:)/i.test(href);
  const newTab = /^https?:/i.test(href);
  const cls =
    `group inline-flex min-h-11 items-center gap-2 text-white underline decoration-white/35 decoration-1 underline-offset-[0.35em] ` +
    `transition-[text-decoration-color] duration-300 hover:decoration-white focus-visible:decoration-white pointer-fine:min-h-0 pointer-fine:py-1.5 ${className}`;
  const arrow = (
    <Arrow
      dir={newTab ? 'up-right' : 'right'}
      className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-0.5"
    />
  );
  if (external) {
    return (
      <a href={href} className={cls} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
        {arrow}
        {newTab ? <span className="sr-only"> (opens in a new tab)</span> : null}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
      {arrow}
    </Link>
  );
}
