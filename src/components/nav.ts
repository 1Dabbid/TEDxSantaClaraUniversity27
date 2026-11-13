/**
 * Primary navigation. Home-page anchors are always written as `/#id`, so they
 * work from every route (on `/` the motion engine turns them into an in-page
 * scroll; elsewhere they navigate home and land on the section).
 *
 * Optional sections (Team, FAQ) only appear when they are actually rendered on
 * the home page: switched on in Keystatic (`settings.sections`) AND non-empty.
 * Never link to an anchor that does not exist.
 */
export type NavItem = { readonly label: string; readonly href: string };

export type NavVisibility = {
  /** settings.sections.showTeam && team.length > 0 */
  team: boolean;
  /** settings.sections.showFaq && faq.length > 0 */
  faq: boolean;
};

export function navItems(visible: NavVisibility): NavItem[] {
  const items: (NavItem | false)[] = [
    { label: 'Speakers', href: '/#speakers' },
    { label: 'Schedule', href: '/#schedule' },
    { label: 'Venue', href: '/#venue' },
    visible.team && { label: 'Team', href: '/#team' },
    { label: 'Partners', href: '/partners' },
    visible.faq && { label: 'FAQ', href: '/#faq' },
  ];
  return items.filter((i): i is NavItem => Boolean(i));
}
