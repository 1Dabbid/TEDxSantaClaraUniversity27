import Link from 'next/link';
import { Arrow } from '@/components/print/Print';

/**
 * The one quiet link at the end of a home section to its own page ("Venue
 * details", "Full schedule", "The whole team", "All questions", "All speakers").
 * Same place in every section (last, aligned with the section's content column),
 * same look: a fine-print label, a hairline underline on hover, the arrow.
 * See the navigation rule at the top of components/nav.ts.
 */
export function MoreLink({ href, label, className = 'mt-12 sm:mt-16' }: { href: string; label: string; className?: string }) {
  return (
    <p data-reveal="fade" data-more-link className={className}>
      <Link href={href} data-cursor="link" className="group tap inline-flex min-h-11 items-center gap-2 text-white">
        <span className="fine-print link-draw text-white group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
          {label}
        </span>
        <Arrow className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-1" />
      </Link>
    </p>
  );
}
