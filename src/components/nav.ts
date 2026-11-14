import 'server-only';
import { getFaq, getSettings, getSpeakers, getTeam } from '@/lib/content';
import type { NavItem } from './nav-links';

/**
 * Navigation rule. The home page is the scroll story; every topic also has its
 * own page with a direct, shareable address (/speakers, /schedule, /venue,
 * /partners, /team, /faq). One rule decides where a link goes:
 *
 * 1. Header and mobile menu, on every page (the home page included): the links
 *    open the topic pages (`/venue`), and the link of the page you are on carries
 *    aria-current (`navCurrent`, nav-links.ts).
 * 2. Footer, everywhere: the same topic pages.
 * 3. Each home section ends with one quiet "more" link to its page (MoreLink,
 *    components/pages/MoreLink.tsx), only where the page offers more than the
 *    section: "All speakers" (once one is announced), "Full schedule" (once
 *    published), "Venue details", "The team", "All 10 questions" (when /faq has more than the five at home).
 *    In-page buttons inside the home sections (the hero's "Speakers" or
 *    "Get updates") still move within the home page.
 *
 * A link shows when its PAGE exists, in the header and the footer alike:
 * /speakers, /schedule (it always states the date), /venue and /partners always;
 * /team whenever the Team switch is on and has entries (it lists the board roles
 * even before a name is public); /faq when switched on and non-empty. So the
 * header and footer list the same pages, and a visitor on any of them always
 * sees where they are. A page whose content is switched off is a 404 and is
 * linked from nowhere.
 * Tickets is not in the header list: it is the red button next to it. There is
 * no tickets page, so until sales open it goes to the home Tickets section
 * (`/#tickets`), and to the ticket shop once they do (ticketCta, lib/tickets.ts).
 */
export type { NavItem };

export type NavVisibility = {
  /** settings.sections.showFaq && faq.length > 0 (the home section and /faq) */
  faq: boolean;
  /** settings.sections.showTeam && at least one entry: /team exists (it lists every board role, named or not). */
  teamPage: boolean;
  /** The speaker pages that exist (/speakers/<slug>), so only those mark Speakers as current. */
  speakerPages: readonly string[];
};

/** Header, mobile menu and footer: the topic pages that exist, in this order. */
export function navItems(visible: NavVisibility): NavItem[] {
  const items: (NavItem | false)[] = [
    { label: 'Speakers', href: '/speakers', pages: visible.speakerPages },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Venue', href: '/venue' },
    { label: 'Partners', href: '/partners' },
    visible.teamPage && { label: 'Team', href: '/team' },
    visible.faq && { label: 'FAQ', href: '/faq' },
  ];
  return items.filter((i): i is NavItem => Boolean(i));
}

/** Visibility from content, shared by the header, the footer and the closing band of the topic pages. */
export async function navVisibility(): Promise<NavVisibility> {
  const [settings, team, faq, speakers] = await Promise.all([getSettings(), getTeam(), getFaq(), getSpeakers()]);
  return {
    faq: settings.sections.showFaq && faq.length > 0,
    teamPage: settings.sections.showTeam && team.length > 0,
    speakerPages: speakers.map((s) => `/speakers/${s.slug}`),
  };
}
