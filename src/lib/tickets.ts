import type { Settings } from './content';

const STATUS: Record<Settings['ticketState'], string> = {
  'coming-soon': 'coming soon',
  'on-sale': 'on sale now',
  'sold-out': 'sold out',
  closed: 'closed',
};

type Sale = Pick<Settings, 'ticketState' | 'ticketUrl' | 'ticketEmbedUrl'>;

/**
 * Can a visitor buy a ticket right now? Ticket status is "On sale" and there is
 * somewhere to buy: the ticket link, or the checkout embedded in the Tickets
 * section. The one test behind every "on sale" on the site: the Tickets section,
 * the closing band of the topic pages, the Tickets button's spoken status, the
 * FAQ's {ticketStatus} and the offer in the structured data.
 */
export function ticketsBuyable(s: Sale): boolean {
  return s.ticketState === 'on-sale' && Boolean(s.ticketUrl || s.ticketEmbedUrl);
}

/**
 * "On sale" with neither a ticket link nor a checkout embed: nothing to buy
 * from yet. Everywhere this reads as "about to go on sale, the ticket link is
 * going live shortly", never as "on sale" (and the build log has a content warning).
 */
export function ticketLinkPending(s: Sale): boolean {
  return s.ticketState === 'on-sale' && !ticketsBuyable(s);
}

/** The id of the checkout embedded in the Tickets section of the home page. */
export const TICKET_CHECKOUT_ID = 'ticket-checkout';

/**
 * "Tickets are expected to go on sale in February 2027." while tickets are coming
 * soon and the expected month is filled in (Tickets & speaker applications), else ''.
 */
export function ticketSaleLine(s: Pick<Settings, 'ticketState' | 'ticketSaleExpected'>): string {
  return s.ticketState === 'coming-soon' && s.ticketSaleExpected
    ? `Tickets are expected to go on sale in ${s.ticketSaleExpected.replace(/[.\s]+$/, '')}.`
    : '';
}

/** Where the always-visible Tickets button points, and how it is announced. */
export function ticketCta(s: Sale) {
  const onSale = s.ticketState === 'on-sale' && Boolean(s.ticketUrl);
  const status = ticketLinkPending(s) ? 'on sale shortly' : STATUS[s.ticketState];
  return {
    href: onSale ? s.ticketUrl : '/#tickets',
    status,
    /**
     * Starts with the visible label ("Tickets") so voice control still matches. An
     * aria-label replaces Button's hidden "(opens in a new tab)" text, so it says so itself.
     */
    ariaLabel: `Tickets, ${status}${onSale && /^https?:/.test(s.ticketUrl) ? ' (opens in a new tab)' : ''}`,
  };
}
