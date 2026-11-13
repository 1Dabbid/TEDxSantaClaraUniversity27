import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Arrow } from '@/components/print/Print';
import { footerNavItems, navVisibility } from '@/components/nav';
import type { Settings } from '@/lib/content';
import { seatsLabel } from '@/lib/site';
import { ticketCta } from '@/lib/tickets';

export type Action = { label: string; href: string; ariaLabel?: string };

/**
 * The shared end of every topic page: the next action (one primary button, an
 * optional second one), then a quiet row with the way back to the home page and
 * the next topic page in footer order (Speakers, Schedule, Venue, Partners, Team,
 * FAQ), so a visitor who arrived from a link can always go on.
 *
 * `heading` left out: only the row (for a page that already ends on its own
 * call to action, such as /partners).
 */
export async function ClosingBand({
  current,
  heading,
  body,
  action,
  secondary,
}: {
  /** This page's path, e.g. "/venue". */
  current: string;
  heading?: ReactNode;
  body?: ReactNode;
  action?: Action;
  secondary?: Action;
}) {
  const pages = footerNavItems(await navVisibility());
  const at = pages.findIndex((p) => p.href === current);
  const next = at >= 0 ? pages[at + 1] : undefined;

  return (
    <section aria-labelledby={heading ? 'next-title' : undefined} aria-label={heading ? undefined : 'More from the event'} className="shell pb-28 sm:pb-36">
      {heading ? (
        <div className="grid gap-10 border-t border-white/15 pt-10 sm:pt-14 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <p data-reveal="fade" className="fine-print flex items-center gap-3 text-mute">
              <span aria-hidden="true" className="h-px w-8 bg-accent" />
              Next
            </p>
            <h2 id="next-title" data-reveal="lines" className="mt-6 max-w-[18ch] text-title font-semibold tracking-tight text-balance">
              {heading}
            </h2>
            {body ? (
              <p data-reveal="fade" className="mt-4 max-w-xl text-lg text-mute">
                {body}
              </p>
            ) : null}
          </div>
          {action ? (
            <div className="flex flex-wrap gap-3 md:col-span-5 md:justify-end">
              <Button href={action.href} size="lg" aria-label={action.ariaLabel}>
                {action.label}
              </Button>
              {secondary ? (
                <Button href={secondary.href} variant="ghost" size="lg" aria-label={secondary.ariaLabel}>
                  {secondary.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <nav
        aria-label="Pages"
        className={`flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-white/10 pt-4 ${heading ? 'mt-16 sm:mt-20' : ''}`}
      >
        <Link href="/" data-cursor="link" className="group tap inline-flex min-h-11 items-center gap-2 text-white">
          <Arrow dir="left" className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:-translate-x-1" />
          <span className="link-draw group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
            Back to the event
          </span>
        </Link>
        {next ? (
          <Link href={next.href} data-cursor="link" className="group tap ml-auto inline-flex min-h-11 items-center gap-2 text-mute hover:text-white focus-visible:text-white">
            <span className="fine-print">Next page</span>
            <span className="link-draw text-white group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
              {next.label}
            </span>
            <Arrow className="text-white transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-1" />
          </Link>
        ) : null}
      </nav>
    </section>
  );
}

/** The closing heading of the ticket band, from the ticket state (same words on every page that ends on Tickets). */
function ticketHeading(s: Settings): string {
  switch (s.ticketState) {
    case 'on-sale':
      return s.ticketUrl ? 'Get your seat.' : `${seatsLabel(s.capacity)}. Tickets open soon.`;
    case 'sold-out':
      return 'Every seat is taken.';
    case 'closed':
      return 'Ticket sales are closed.';
    default:
      return `${seatsLabel(s.capacity)}. Tickets open soon.`;
  }
}

/** The end of /speakers, /schedule and /venue: the ticket state and the Tickets button. */
export function TicketsClosingBand({ current, settings }: { current: string; settings: Settings }) {
  const cta = ticketCta(settings);
  return (
    <ClosingBand
      current={current}
      heading={ticketHeading(settings)}
      body={settings.ticketPriceNote || undefined}
      action={{ label: 'Tickets', href: cta.href, ariaLabel: cta.ariaLabel }}
    />
  );
}
