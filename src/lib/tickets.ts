import type { Settings } from './content';

const STATUS: Record<Settings['ticketState'], string> = {
  'coming-soon': 'coming soon',
  'on-sale': 'on sale now',
  'sold-out': 'sold out',
  closed: 'closed',
};

/** Where the always-visible Tickets button points, and how it is announced. */
export function ticketCta(s: Pick<Settings, 'ticketState' | 'ticketUrl'>) {
  const onSale = s.ticketState === 'on-sale' && Boolean(s.ticketUrl);
  return {
    href: onSale ? s.ticketUrl : '/#tickets',
    status: STATUS[s.ticketState],
    /**
     * Starts with the visible label ("Tickets") so voice control still matches. An
     * aria-label replaces Button's hidden "(opens in a new tab)" text, so it says so itself.
     */
    ariaLabel: `Tickets, ${STATUS[s.ticketState]}${onSale && /^https?:/.test(s.ticketUrl) ? ' (opens in a new tab)' : ''}`,
  };
}
