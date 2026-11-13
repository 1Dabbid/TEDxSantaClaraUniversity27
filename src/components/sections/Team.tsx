import Image from 'next/image';
import type { TeamMember } from '@/lib/content';
import { getSettings } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ClauseNo } from '@/components/print/Print';
import { SectionShell, SectionTitle } from './SectionShell';

/** One signatory: a signature space, a hairline, and the role typed beneath it. */
function SignatureBlock({ member, index }: { member: TeamMember; index: number }) {
  return (
    <li className="flex flex-col">
      <div className="flex items-baseline justify-between">
        <ClauseNo>6.{index + 1}</ClauseNo>
        <span className="fine-print hidden sm:inline text-mute">Signatory</span>
      </div>
      {/* Signature space */}
      <div className={`relative mt-6 flex items-end gap-4 pb-3 ${member.name ? 'h-20 sm:h-28' : 'h-12 sm:h-20'}`}>
        {member.name ? (
          <>
            {member.photo ? (
              <Image
                src={member.photo}
                alt=""
                width={64}
                height={64}
                className="size-14 shrink-0 rounded-full object-cover grayscale sm:size-16"
              />
            ) : null}
            <p className="text-xl leading-tight font-light tracking-tight text-white sm:text-3xl">{member.name}</p>
          </>
        ) : (
          <span aria-hidden="true" className="font-mono text-sm text-subtle">
            ✕
          </span>
        )}
      </div>
      <div data-reveal="rule" aria-hidden="true" className="h-px bg-white/40" />
      <p className="mt-3 text-sm leading-snug font-medium text-white sm:text-base">{member.role}</p>
      <p className="fine-print mt-1 text-mute">
        {member.name ? 'For TEDxSantaClaraUniversity' : 'Name to be announced'}
      </p>
    </li>
  );
}

export async function Team({ team }: { team: TeamMember[] }) {
  const settings = await getSettings();
  if (!settings.sections.showTeam || team.length === 0) return null;

  return (
    <SectionShell id="team" scrim="solid" className="py-32 sm:py-44">
      <div className="shell">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <div data-reveal="fade">
              <SectionLabel index={6}>Team</SectionLabel>
            </div>
            <SectionTitle id="team">
              <span data-reveal="lines" className="block">
                The undersigned.
              </span>
            </SectionTitle>
          </div>
          <p data-reveal="fade" className="max-w-md text-lg text-mute md:col-span-5">
            {settings.eventName} is independently organized by a team at Santa Clara University. Names are added as each
            member of the board is announced.
          </p>
        </div>

        <p data-reveal="fade" className="fine-print mt-20 max-w-xl sm:mt-28 text-mute">
          In witness whereof, the board below has agreed to organize {settings.eventName} on{' '}
          <time dateTime={settings.dateISO}>{settings.dateLong}</time>, and to read every clause.
        </p>

        <ul data-reveal="stagger" className="mt-12 grid grid-cols-2 gap-x-5 gap-y-12 sm:gap-x-10 sm:gap-y-16 lg:grid-cols-3 lg:gap-x-16">
          {team.map((m, i) => (
            <SignatureBlock key={m.slug} member={m} index={i} />
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
