import 'server-only';
import { getFaq, getSchedule, getSettings, getTeam } from '@/lib/content';
import type { NavItem } from './nav-links';

/**
 * Navigation rule. The home page is the scroll story; every topic also has its
 * own page with a direct, shareable address (/speakers, /schedule, /venue,
 * /partners, /team, /faq). One rule decides where a link goes:
 *
 * 1. Header, on the home page: the links scroll to the home sections (`/#venue`).
 *    The story is the product; the header never pulls a visitor out of it.
 * 2. Header, on every other page (topic pages, speaker pages, the 404): the same
 *    links, in the same order, go to the topic pages (`/venue`), and the link of
 *    the page you are on carries aria-current. The switch is made per page by
 *    `navHref` / `navCurrent` (nav-links.ts) in the header and the mobile menu.
 * 3. Footer, everywhere: always the topic pages.
 * 4. Each home section ends with one quiet "more" link to its page (MoreLink,
 *    components/pages/MoreLink.tsx), only where the page offers more than the
 *    section: "All speakers" (once one is announced), "Full schedule" (once
 *    published), "Venue details", "The whole team", "All questions".
 *
 * Header items on the home page follow the home sections' own content state, so
 * the header there never points at a placeholder:
 * - Schedule: only once the running order is published (the section shows a
 *   short "to follow" note until then).
 * - Team: only when the home section renders (switched on and one name public).
 * - FAQ: only when switched on and non-empty.
 * Off the home page the header follows whether the PAGE exists, like the footer,
 * which is wider: /schedule always (it states the date), /team whenever the Team
 * switch is on (it lists the board roles even before a name is
 * public). So a visitor on /schedule or /team always sees where they are, and
 * the header and footer list the same pages. Items that exist only off the home
 * page carry `homeHidden` (filtered by `headerItems`, nav-links.ts).
 * A page whose content is switched off is a 404 and is linked from nowhere.
 * Tickets is not in the header list: it is the red button next to it.
 */
export type { NavItem };

export type NavVisibility = {
  /** schedule.published && schedule.items.length > 0 */
  schedule: boolean;
  /** settings.sections.showTeam && at least one public name (teamVisible in Team.tsx) */
  team: boolean;
  /** settings.sections.showFaq && faq.length > 0 (the home section and /faq) */
  faq: boolean;
  /** settings.sections.showTeam: /team exists (it lists every board role, named or not). */
  teamPage: boolean;
};

/** Header and mobile menu: each item knows its page and its home section. */
export function navItems(visible: NavVisibility): NavItem[] {
  const items: (NavItem | false)[] = [
    { label: 'Speakers', href: '/speakers', home: '/#speakers' },
    { label: 'Schedule', href: '/schedule', home: '/#schedule', homeHidden: !visible.schedule },
    { label: 'Venue', href: '/venue', home: '/#venue' },
    { label: 'Partners', href: '/partners' },
    visible.teamPage && { label: 'Team', href: '/team', home: '/#team', homeHidden: !visible.team },
    visible.faq && { label: 'FAQ', href: '/faq', home: '/#faq' },
  ];
  return items.filter((i): i is NavItem => Boolean(i));
}

/** Footer: the topic pages that exist, always as pages. */
export function footerNavItems(visible: NavVisibility): NavItem[] {
  const items: (NavItem | false)[] = [
    { label: 'Speakers', href: '/speakers' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Venue', href: '/venue' },
    { label: 'Partners', href: '/partners' },
    visible.teamPage && { label: 'Team', href: '/team' },
    visible.faq && { label: 'FAQ', href: '/faq' },
  ];
  return items.filter((i): i is NavItem => Boolean(i));
}

/** Visibility from content, shared by the header, the footer and the topic pages. */
export async function navVisibility(): Promise<NavVisibility> {
  const [settings, schedule, team, faq] = await Promise.all([getSettings(), getSchedule(), getTeam(), getFaq()]);
  return {
    schedule: schedule.published && schedule.items.length > 0,
    team: settings.sections.showTeam && team.some((m) => m.name),
    faq: settings.sections.showFaq && faq.length > 0,
    teamPage: settings.sections.showTeam,
  };
}
