import type { Settings, TeamMember } from '@/lib/content';
import type { CSSProperties } from 'react';
import { groupTeam, type TeamGroup } from '@/lib/team';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Portrait } from '@/components/ui/Portrait';
import { TeamMotion } from '@/motion/sections/TeamMotion';
import { MoreLink } from '@/components/pages/MoreLink';
import { SectionShell, SectionTitle } from './SectionShell';

/** Same rule as the nav: the section exists only when it is switched on and at least one name is public. */
export function teamVisible(settings: Settings, team: TeamMember[]): boolean {
  return settings.sections.showTeam && team.some((m) => m.name);
}

/**
 * Rendered width of a home portrait: three columns on phones and small tablets,
 * six from md, one row of up to nine from xl (globals.css "Home team strip").
 */
const SIZES = '(min-width: 1280px) 140px, (min-width: 768px) 15vw, 32vw';

/** Nine across from xl only while it fits: more people stay on the six-column chart. */
const ONE_ROW_MAX = 9;

/**
 * One signatory, as a link to their card on /team: the portrait, the name
 * (top-aligned, a constant gap under the photo), the hairline, the role. The
 * card's rows are shared with its neighbours (subgrid), so a name that wraps
 * moves every hairline in the row together.
 */
function Signature({ member }: { member: TeamMember }) {
  return (
    <li data-sign className="team-sign">
      <a href={`/team#${member.slug}`} data-portrait-card data-portrait-link data-cursor="link" className="team-sign-link group">
        <span data-sign-mark className="block">
          <Portrait member={member} sizes={SIZES} toggle={false} />
        </span>
        <span
          data-sign-text
          data-sign-name
          className="mt-3 block pb-2 text-[0.9375rem] leading-tight font-light tracking-tight text-balance break-words hyphens-auto text-white sm:text-base"
        >
          {member.name}
          <span className="sr-only">,</span>
        </span>
        <span data-sign-line aria-hidden="true" className="block h-px bg-white/40 transition-colors duration-500 group-hover:bg-white group-focus-visible:bg-white" />
        <span data-sign-text className="mt-2 block text-[0.8125rem] leading-snug text-balance break-words hyphens-auto text-mute">
          {member.role}
        </span>
      </a>
    </li>
  );
}

/**
 * A level of the board on the strip: its name in fine print over a hairline as
 * wide as the level, then its people. The level is the list's accessible name,
 * so screen readers hear the grouping too. How many columns it spans at each
 * width is set here and laid out in globals.css ("Home team strip").
 */
function Level({ group }: { group: TeamGroup<TeamMember> }) {
  const n = group.members.length;
  const id = `team-level-${group.level}`;
  const style = { '--span': Math.min(n, 3), '--span-md': Math.min(n, 6), '--span-xl': n } as CSSProperties;
  return (
    <div className="team-level" style={style} data-wrap-base={n > 3 ? '' : undefined} data-wrap-md={n > 6 ? '' : undefined}>
      <p id={id} className="team-level-label fine-print text-subtle">
        {group.label}
      </p>
      <ul aria-labelledby={id} className="team-level-list">
        {group.members.map((m) => (
          <Signature key={m.slug} member={m} />
        ))}
      </ul>
    </div>
  );
}

/**
 * The organizing team: a compact strip of portraits of the board members who
 * agreed to be named (People > Team > Show name publicly), level by level like
 * the club's org chart and signed in order. On phones the President and the
 * Executive board share the first row, Operations follows three by three; from
 * md the top of the chart sits over a six-wide Operations row; from xl the
 * whole board is one row. Each person links to their card on /team (major,
 * class year, LinkedIn). The portraits load lazily, well below the fold, in
 * fixed 4:5 frames (no layout shift). Hidden until at least one name is public.
 */
export function Team({ team, settings }: { team: TeamMember[]; settings: Settings }) {
  if (!teamVisible(settings, team)) return null;
  const named = team.filter((m) => m.name);
  const more = named.length < team.length;

  return (
    <SectionShell id="team" scrim="solid" className="py-24 sm:py-32">
      <TeamMotion />
      <div className="shell">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <div data-reveal="fade">
              <SectionLabel>Team</SectionLabel>
            </div>
            <SectionTitle id="team">
              <span data-reveal="lines" className="block">
                Organized by students.
              </span>
            </SectionTitle>
          </div>
          <p data-reveal="fade" className="max-w-md text-lg text-mute md:col-span-5">
            {settings.eventName} is planned and run by a student board at {settings.venueCampus || 'Santa Clara University'}.
            The club went dormant after its 2020 event; this board brought it back.
            {more ? ' More of the board will be introduced here.' : null}
          </p>
        </div>

        <div
          data-sign-list
          data-one-row={named.length <= ONE_ROW_MAX ? '' : undefined}
          style={{ '--n': named.length } as CSSProperties}
          className="team-strip mt-14"
        >
          {groupTeam(named).map((g) => (
            <Level key={g.level} group={g} />
          ))}
        </div>
        <MoreLink href="/team" label="The team" />
      </div>
    </SectionShell>
  );
}
