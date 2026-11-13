import Image from 'next/image';
import type { TeamMember } from '@/lib/content';
import { getSettings } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ClauseNo } from '@/components/print/Print';
import { SectionShell, SectionTitle } from './SectionShell';

/**
 * One signatory: clause number in the margin, a signature space with its
 * cross, the hairline, and the role typed beneath it. Until a name is public
 * the space stays blank and the line reads as unsigned.
 */
function SignatureBlock({ member, index }: { member: TeamMember; index: number }) {
  const signed = Boolean(member.name);
  return (
    <li>
      {/* Phones: the clause number sits on the signature line itself; wider: above it. */}
      <ClauseNo className="hidden sm:block">6.{index + 1}</ClauseNo>
      <div>
        <div className="relative flex h-14 items-end gap-4 pb-3 sm:mt-3 sm:h-20">
          <ClauseNo className="w-12 shrink-0 pb-px sm:hidden">6.{index + 1}</ClauseNo>
          {signed ? (
            <>
              {member.photo ? (
                <Image
                  src={member.photo}
                  alt=""
                  width={64}
                  height={64}
                  className="size-12 shrink-0 rounded-full object-cover grayscale sm:size-14"
                />
              ) : null}
              <p className="text-2xl leading-tight font-light tracking-tight text-balance text-white sm:text-3xl">
                {member.name}
              </p>
            </>
          ) : (
            <span aria-hidden="true" className="font-mono text-sm leading-none text-subtle">
              ✕
            </span>
          )}
        </div>
        <div data-reveal="rule" aria-hidden="true" className={`h-px ${signed ? 'bg-white/60' : 'bg-white/30'}`} />
        <p className="mt-3 text-base leading-snug font-medium text-balance text-white">{member.role}</p>
        <p className="fine-print mt-1 text-mute">{signed ? 'For TEDxSantaClaraUniversity' : 'Unsigned · name to follow'}</p>
      </div>
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
            {settings.eventName} is organized independently by a board at Santa Clara University. Each
            signature is added as its member is announced.
          </p>
        </div>

        <div className="mt-20 flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3 border-t border-white/15 pt-5 sm:mt-28">
          <p data-reveal="fade" className="fine-print max-w-xl text-mute">
            In witness whereof, the board below has agreed to organize {settings.eventName} on{' '}
            <time dateTime={settings.dateISO}>{settings.dateLong}</time>, and to read every clause.
          </p>
          <p aria-hidden="true" className="fine-print text-mute tabular-nums">
            {String(team.filter((m) => m.name).length).padStart(2, '0')} of {String(team.length).padStart(2, '0')} signed
          </p>
        </div>

        <ul data-reveal="stagger" className="mt-10 grid gap-y-9 sm:mt-14 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-16 lg:grid-cols-3 lg:gap-x-16">
          {team.map((m, i) => (
            <SignatureBlock key={m.slug} member={m} index={i} />
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
