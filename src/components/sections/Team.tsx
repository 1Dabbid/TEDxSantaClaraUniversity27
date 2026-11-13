import Image from 'next/image';
import type { Settings, TeamMember } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TeamMotion } from '@/motion/sections/TeamMotion';
import { SectionShell, SectionTitle } from './SectionShell';

/** Same rule as the nav: the section exists only when it is switched on and at least one name is public. */
export function teamVisible(settings: Settings, team: TeamMember[]): boolean {
  return settings.sections.showTeam && team.some((m) => m.name);
}

/** One signatory: the name over a hairline, the role typed beneath it. */
function Signature({ member }: { member: TeamMember }) {
  return (
    <li data-sign>
      <div data-sign-mark className="flex min-h-14 items-end gap-4 pb-3 sm:min-h-16">
        {member.photo ? (
          <Image
            src={member.photo}
            alt=""
            width={64}
            height={64}
            className="size-11 shrink-0 rounded-full object-cover grayscale sm:size-12"
          />
        ) : null}
        <p className="min-w-0 text-2xl leading-tight font-light tracking-tight text-balance text-white wrap-anywhere">{member.name}</p>
      </div>
      <div data-sign-line aria-hidden="true" className="h-px bg-white/50" />
      <p data-sign-text className="mt-3 text-base leading-snug text-balance text-mute wrap-anywhere">
        {member.role}
      </p>
    </li>
  );
}

/**
 * The organizing team. Hidden until at least one board member has agreed to be
 * named (People > Team > Show name publicly), so the home page never shows a
 * list of empty signature lines. Only named members are listed.
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
            {more ? ' More of the board will be introduced here.' : null}
          </p>
        </div>

        <ul
          data-sign-list
          className="mt-14 grid gap-y-9 border-t border-white/15 pt-10 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-16"
        >
          {named.map((m) => (
            <Signature key={m.slug} member={m} />
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
