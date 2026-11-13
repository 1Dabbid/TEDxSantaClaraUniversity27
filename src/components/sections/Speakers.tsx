import Image from 'next/image';
import Link from 'next/link';
import type { Settings, Speaker } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { ComingSoonBadge } from '@/components/ui/ComingSoon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

// Deterministic "name length" hints for redaction bars, so each placeholder differs.
const BARS: [number, number][] = [
  [64, 41],
  [52, 70],
  [73, 36],
  [45, 58],
  [68, 49],
  [57, 33],
];

const cardBase =
  'speaker-card group relative flex flex-col border border-white/10 bg-panel/90';

function SpeakerCard({ speaker, index }: { speaker: Speaker; index: number }) {
  const clause = `§ 2.${index + 1}`;
  const num = String(index + 1).padStart(2, '0');

  if (!speaker.announced) {
    const [a, b] = BARS[index % BARS.length];
    return (
      <li className={`${cardBase} aspect-[4/3] p-6 sm:aspect-[4/5] sm:p-7`} data-cursor="loupe" data-cursor-zoom="2.4">
        <div className="flex items-baseline justify-between">
          <span className="fine-print text-white">{clause.replace(' ', ' ')}</span>
          <span className="fine-print">Clause pending</span>
        </div>

        <div aria-hidden="true" className="mt-auto">
          <span className="block font-mono text-[clamp(4.5rem,9vw,7.5rem)] leading-none font-light tracking-[-0.06em] text-white/[0.07] tabular-nums">
            {num}
          </span>
          <div className="mt-6 space-y-2.5">
            <span className="redacted h-5" style={{ width: `${a}%` }} />
            <span className="redacted h-5" style={{ width: `${b}%` }} />
          </div>
          <div className="mt-5 space-y-1.5">
            <span className="redacted h-2" style={{ width: '88%' }} />
            <span className="redacted h-2" style={{ width: `${30 + ((index * 17) % 40)}%` }} />
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-5">
          <h3 className="text-lg font-semibold tracking-tight">
            <Link
              href={`/speakers/${speaker.slug}`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {speaker.name}
              <span className="sr-only">, speaker {index + 1}</span>
            </Link>
          </h3>
          <p className="mt-2 font-mono text-[0.5625rem] leading-[1.6] tracking-[0.04em] text-subtle">
            Name, affiliation and talk title withheld pending announcement. Announcement subject to change
            without notice. The speaker is under no obligation to be what you expect.
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className={cardBase} data-cursor="loupe" data-cursor-zoom="2.2">
      <div className="relative aspect-[4/5] overflow-hidden bg-black">
        {speaker.photo ? (
          <Image
            src={speaker.photo}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="object-cover grayscale transition-[filter,transform] duration-1000 ease-[var(--ease-cinema)] group-hover:scale-[1.03] group-hover:grayscale-0"
          />
        ) : null}
        <span className="fine-print absolute left-4 top-4 text-white">{clause.replace(' ', ' ')}</span>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold tracking-tight">
          <Link href={`/speakers/${speaker.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {speaker.name}
          </Link>
        </h3>
        {speaker.role ? <p className="mt-1 text-sm text-mute">{speaker.role}</p> : null}
        {speaker.talkTitle ? <p className="mt-4 text-white">“{speaker.talkTitle}”</p> : null}
        <p className="mt-5 border-t border-white/10 pt-4 font-mono text-[0.5625rem] tracking-[0.04em] text-subtle">
          {clause}. Read the full clause on the speaker page.
        </p>
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
          {!anyAnnounced ? (
            <div data-reveal="fade" data-reveal-delay="0.3">
              <ComingSoonBadge>Lineup announced soon</ComingSoonBadge>
            </div>
          ) : null}
        </div>

        <ul
          className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-reveal="stagger"
          data-reveal-variant="wipe"
        >
          {speakers.map((s, i) => (
            <SpeakerCard key={s.slug} speaker={s} index={i} />
          ))}
        </ul>

        <div className="mt-16 grid gap-6 border-t border-white/15 pt-8 md:grid-cols-12">
          <div className="md:col-span-7">
            <h3 data-reveal="lines" className="text-title font-semibold tracking-tight">
              Have an idea worth spreading?
            </h3>
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
