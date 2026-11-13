import Image from 'next/image';
import Link from 'next/link';
import type { Settings, Speaker } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { ComingSoonBadge } from '@/components/ui/ComingSoon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

function SpeakerCard({ speaker, index }: { speaker: Speaker; index: number }) {
  const num = `Nº ${String(index + 1).padStart(2, '0')}`;

  if (!speaker.announced) {
    return (
      <li className="group relative flex aspect-[16/10] flex-col justify-between border border-white/10 bg-panel/80 p-6 sm:aspect-[4/5]">
        <span className="fine-print">{num}</span>
        <div aria-hidden="true" className="space-y-2">
          <span className="block h-4 w-3/4 bg-white/10" />
          <span className="block h-4 w-1/2 bg-white/10" />
        </div>
        <div>
          <p className="text-xl font-semibold tracking-tight">{speaker.name}</p>
          <p className="fine-print mt-2">Details withheld pending announcement</p>
        </div>
      </li>
    );
  }

  return (
    <li className="group relative flex flex-col border border-white/10 bg-panel/80">
      <div className="relative aspect-[4/5] overflow-hidden bg-black">
        {speaker.photo ? (
          <Image
            src={speaker.photo}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="object-cover grayscale transition-[filter] duration-700 group-hover:grayscale-0"
          />
        ) : null}
        <span className="fine-print absolute left-4 top-4 text-white">{num}</span>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold tracking-tight">
          <Link href={`/speakers/${speaker.slug}`} className="after:absolute after:inset-0">
            {speaker.name}
          </Link>
        </h3>
        {speaker.role ? <p className="mt-1 text-sm text-mute">{speaker.role}</p> : null}
        {speaker.talkTitle ? <p className="mt-4 text-white">“{speaker.talkTitle}”</p> : null}
      </div>
    </li>
  );
}

export function Speakers({ speakers, settings }: { speakers: Speaker[]; settings: Settings }) {
  const anyAnnounced = speakers.some((s) => s.announced);
  const apps = settings.speakerApplicationsState;
  return (
    <SectionShell id="speakers" className="py-32 sm:py-44">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionLabel index={2}>Speakers</SectionLabel>
            <SectionTitle id="speakers">On the red circle.</SectionTitle>
          </div>
          {!anyAnnounced ? <ComingSoonBadge>Lineup announced soon</ComingSoonBadge> : null}
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {speakers.map((s, i) => (
            <SpeakerCard key={s.slug} speaker={s} index={i} />
          ))}
        </ul>

        <div className="mt-16 grid gap-6 border-t border-white/15 pt-8 md:grid-cols-12">
          <div className="md:col-span-7">
            <h3 className="text-title font-semibold tracking-tight">Have an idea worth spreading?</h3>
            <p className="mt-3 max-w-xl text-mute">
              {apps === 'open'
                ? 'Speaker applications are open.'
                : apps === 'closed'
                  ? 'Speaker applications are closed for this event.'
                  : 'Speaker applications open soon. Join the mailing list to hear first.'}
            </p>
          </div>
          <div className="flex items-start md:col-span-5 md:justify-end">
            {apps === 'open' && settings.speakerApplicationsUrl ? (
              <Button href={settings.speakerApplicationsUrl}>Apply to speak</Button>
            ) : apps === 'coming-soon' ? (
              <Button href="#newsletter" variant="ghost">
                Get notified
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
