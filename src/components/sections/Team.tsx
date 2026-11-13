import type { Settings, TeamMember } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TeamMark } from '@/components/ui/TeamMark';
import { TeamMotion } from '@/motion/sections/TeamMotion';
import { MoreLink } from '@/components/pages/MoreLink';
import { SectionShell, SectionTitle } from './SectionShell';

/** Same rule as the nav: the section exists only when it is switched on and at least one name is public. */
export function teamVisible(settings: Settings, team: TeamMember[]): boolean {
  return settings.sections.showTeam && team.some((m) => m.name);
}

/** One signatory: their mark (photo or initials) and name over a hairline, the role typed beneath it. */
function Signature({ member }: { member: TeamMember }) {
  return (
    <li data-sign className="min-w-0">
      <div data-sign-mark className="flex items-center gap-4 pb-3">
        <TeamMark member={member} size="sm" />
        <p className="min-w-0 text-xl leading-tight font-light tracking-tight text-balance text-white wrap-anywhere sm:text-2xl">
          {member.name}
        </p>
      </div>
      <div data-sign-line aria-hidden="true" className="h-px bg-white/40" />
      <p data-sign-text className="mt-3 text-base leading-snug text-balance text-mute wrap-anywhere">
        {member.role}
      </p>
    </li>
  );
}

/**
 * The organizing team: a compact roster of the board members who agreed to be
 * named (People > Team > Show name publicly), signed in order. Majors, class
 * years and LinkedIn links are on /team. Hidden until at least one name is
 * public, so the home page never shows empty signature lines.
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
          className="mt-14 grid gap-y-9 border-t border-white/15 pt-10 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-10 lg:grid-cols-3 lg:gap-x-14"
        >
          {named.map((m) => (
            <Signature key={m.slug} member={m} />
          ))}
        </ul>
        <MoreLink href="/team" label="The team" />
      </div>
    </SectionShell>
  );
}
