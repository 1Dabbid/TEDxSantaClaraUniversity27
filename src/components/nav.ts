import 'server-only';
import { getFaq, getSchedule, getSettings, getTeam } from '@/lib/content';

/**
 * Primary navigation. Home-page anchors are always written as `/#id`, so they
 * work from every route (on `/` the motion engine turns them into an in-page
 * scroll; elsewhere they navigate home and land on the section).
 *
 * Items follow content state, with the same rules the sections use: never link
 * to an anchor that does not exist, and never send a visitor to a placeholder.
 * - Schedule: only once the running order is published (Schedule.tsx shows a
 *   short "to follow" note until then).
 * - Team: only when the section renders (switched on and at least one name public).
 * - FAQ: only when switched on and non-empty.
 * Tickets is not in the list: it is the red button next to it.
 */
export type NavItem = { readonly label: string; readonly href: string };

export type NavVisibility = {
  /** schedule.published && schedule.items.length > 0 */
  schedule: boolean;
  /** settings.sections.showTeam && at least one public name (teamVisible in Team.tsx) */
  team: boolean;
  /** settings.sections.showFaq && faq.length > 0 */
  faq: boolean;
};

export function navItems(visible: NavVisibility): NavItem[] {
  const items: (NavItem | false)[] = [
    { label: 'Speakers', href: '/#speakers' },
    visible.schedule && { label: 'Schedule', href: '/#schedule' },
    { label: 'Venue', href: '/#venue' },
    { label: 'Partners', href: '/partners' },
    visible.team && { label: 'Team', href: '/#team' },
    visible.faq && { label: 'FAQ', href: '/#faq' },
  ];
  return items.filter((i): i is NavItem => Boolean(i));
}

/** Visibility from content, shared by the header, the footer and the 404 page. */
export async function navVisibility(): Promise<NavVisibility> {
  const [settings, schedule, team, faq] = await Promise.all([getSettings(), getSchedule(), getTeam(), getFaq()]);
  return {
    schedule: schedule.published && schedule.items.length > 0,
    team: settings.sections.showTeam && team.some((m) => m.name),
    faq: settings.sections.showFaq && faq.length > 0,
  };
}
