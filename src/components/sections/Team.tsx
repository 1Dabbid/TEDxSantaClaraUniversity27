import Image from 'next/image';
import type { TeamMember } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

export function Team({ team }: { team: TeamMember[] }) {
  return (
    <SectionShell id="team" scrim="solid" className="py-32 sm:py-44">
      <div className="shell">
        <SectionLabel index={6}>Team</SectionLabel>
        <SectionTitle id="team">The people behind the details.</SectionTitle>
        <p className="mt-6 max-w-xl text-lg text-mute">
          TEDxSantaClaraUniversity is independently organized by a team at Santa Clara University. Names will be shared closer to the event.
        </p>
        <ul className="mt-16 grid border-t border-white/15 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m, i) => (
            <li key={m.slug} className="flex items-center gap-4 border-b border-white/15 py-6 sm:pr-6">
              {m.photo ? (
                <Image src={m.photo} alt="" width={56} height={56} className="size-14 rounded-full object-cover grayscale" />
              ) : null}
              <div className="grid grid-cols-[3.25rem_1fr] items-baseline gap-2">
                <span aria-hidden="true" className="fine-print">
                  §&nbsp;6.{i + 1}
                </span>
                <div>
                  <p className="font-medium text-white">{m.role}</p>
                  {m.name ? <p className="text-sm text-mute">{m.name}</p> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
