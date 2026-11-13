import type { Settings, TeamMember } from '@/lib/content';
import { groupTeam } from '@/lib/team';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Portrait } from '@/components/ui/Portrait';
import { TeamMotion } from '@/motion/sections/TeamMotion';
import { MoreLink } from '@/components/pages/MoreLink';
import { SectionShell, SectionTitle } from './SectionShell';

/** Same rule as the nav: the section exists only when it is switched on and at least one name is public. */
export function teamVisible(settings: Settings, team: TeamMember[]): boolean {
  return settings.sections.showTeam && team.some((m) => m.name);
}

/** Rendered width of a home portrait: nine across from lg, five from sm, three on phones. */
const SIZES = '(min-width: 1408px) 128px, (min-width: 1024px) 9vw, (min-width: 640px) 18vw, 30vw';

/**
 * One signatory: their portrait, the name over a hairline, the role typed
 * beneath it. From lg the board is one row, and the first person of each level
 * carries the level's name above the portrait (President, Executive board,
 * Operations), with a wider gap before it.
 */
function Signature({ member, group }: { member: TeamMember; group: string | null }) {
  return (
    <li data-sign data-portrait-card className={`relative min-w-0 lg:flex-1 ${group ? 'lg:not-first:ml-6 xl:not-first:ml-8' : ''}`}>
      {group ? (
        <p aria-hidden="true" className="fine-print absolute -top-8 left-0 hidden whitespace-nowrap text-subtle lg:block">
          {group}
        </p>
      ) : null}
      <div data-sign-mark>
        <Portrait member={member} sizes={SIZES} />
      </div>
      <p data-sign-text data-sign-name className="mt-4 flex min-h-[calc(2.5em+0.5rem)] items-end pb-2 text-[0.9375rem] leading-tight font-light tracking-tight text-balance text-white wrap-anywhere sm:text-base">
        {member.name}
      </p>
      <div data-sign-line aria-hidden="true" className="h-px bg-white/40" />
      <p data-sign-text className="mt-2 text-[0.8125rem] leading-snug text-balance text-mute wrap-anywhere">
        {member.role}
      </p>
    </li>
  );
}

/**
 * The organizing team: a compact strip of portraits of the board members who
 * agreed to be named (People > Team > Show name publicly), level by level and
 * signed in order. Majors, class years and LinkedIn links are on /team. The
 * portraits load lazily, well below the fold, in fixed 4:5 frames (no layout
 * shift). Hidden until at least one name is public.
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

        <ul
          data-sign-list
          aria-label="The board"
          className="mt-14 grid grid-cols-3 gap-x-3 gap-y-8 border-t border-white/15 pt-10 sm:grid-cols-5 sm:gap-x-5 lg:flex lg:gap-x-3 lg:pt-16"
        >
          {groupTeam(named).flatMap((g) =>
            g.members.map((m, i) => <Signature key={m.slug} member={m} group={i === 0 ? g.label : null} />),
          )}
        </ul>
        <MoreLink href="/team" label="The team" />
      </div>
    </SectionShell>
  );
}
