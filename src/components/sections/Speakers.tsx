import Image from 'next/image';
import Link from 'next/link';
import type { Settings, Speaker } from '@/lib/content';
import { ComingSoonBadge } from '@/components/ui/ComingSoon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

/**
 * Placeholder variety. Six "to be announced" cards should read as six different
 * withheld documents, not one card repeated: each gets its own redaction layout
 * (rows of segments, widths in %), status line and footnote. Deterministic, so
 * server and client agree and the static HTML is the design.
 */
type Row = { h: 'lg' | 'md' | 'sm'; segs: number[] };
const REDACTIONS: Row[][] = [
  [
    { h: 'lg', segs: [64] },
    { h: 'lg', segs: [41] },
    { h: 'sm', segs: [88] },
    { h: 'sm', segs: [52] },
  ],
  [
    { h: 'lg', segs: [28, 46] },
    { h: 'sm', segs: [92] },
    { h: 'sm', segs: [78] },
    { h: 'sm', segs: [35] },
  ],
  [
    { h: 'lg', segs: [73] },
    { h: 'md', segs: [22, 18, 30] },
    { h: 'sm', segs: [61] },
  ],
  [
    { h: 'md', segs: [38] },
    { h: 'lg', segs: [58] },
    { h: 'sm', segs: [84] },
    { h: 'sm', segs: [16, 44] },
  ],
  [
    { h: 'lg', segs: [49, 19] },
    { h: 'lg', segs: [33] },
    { h: 'sm', segs: [70] },
  ],
  [
    { h: 'lg', segs: [57] },
    { h: 'sm', segs: [90] },
    { h: 'md', segs: [26, 26] },
    { h: 'sm', segs: [47] },
  ],
];
const ROW_H = { lg: 'h-5', md: 'h-3', sm: 'h-2' } as const;
const ROW_GAP = { lg: 'mt-2.5', md: 'mt-2', sm: 'mt-1.5' } as const;

const STATUS = ['Clause pending', 'Under review', 'Withheld', 'Pending signature', 'Redacted', 'Subject to change'];

const FOOTNOTES = [
  'Name, affiliation and talk title withheld pending announcement. The speaker is under no obligation to be what you expect.',
  'Identity on file. Disclosure deferred until the parties agree. No inference should be drawn from the length of the bars.',
  'Talk title redacted at the request of no one in particular. Announcement subject to change without notice.',
  'This clause becomes binding on announcement. Until then it is merely very likely.',
  'Details withheld for the reader’s own suspense. See the mailing list for the unredacted copy.',
  'Reserved. The red circle has been booked; the name is still in the envelope.',
];

const cardBase =
  'speaker-card group relative flex min-w-0 flex-col border border-white/10 bg-panel/90';

function SpeakerCard({ speaker, index }: { speaker: Speaker; index: number }) {
  const clause = `§ 2.${index + 1}`;
  const num = String(index + 1).padStart(2, '0');

  if (!speaker.announced) {
    const rows = REDACTIONS[index % REDACTIONS.length];
    return (
      <li
        className={`${cardBase} speaker-card--tba p-6 sm:aspect-[4/5] sm:p-7`}
        data-cursor="loupe"
        data-cursor-zoom="2.4"
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="fine-print text-white">{clause.replace(' ', '\u00a0')}</span>
          <span className="fine-print text-right text-mute">{STATUS[index % STATUS.length]}</span>
        </div>

        <div aria-hidden="true" className="mt-8 sm:mt-auto">
          <span
            className={`block font-mono text-[clamp(4.5rem,9vw,7.5rem)] leading-none font-light tracking-[-0.06em] text-white/[0.07] tabular-nums ${index % 3 === 1 ? 'text-right' : ''}`}
          >
            {num}
          </span>
          <div className="mt-6">
            {rows.map((row, r) => {
              const prev = rows[r - 1];
              const gap = !prev ? '' : prev.h !== row.h && row.h !== 'lg' ? 'mt-4' : ROW_GAP[row.h];
              return (
                <div key={r} className={`flex gap-1.5 ${gap}`}>
                  {row.segs.map((w, k) => (
                    <span key={k} className={`redacted ${ROW_H[row.h]}`} style={{ width: `${w}%` }} />
                  ))}
                </div>
              );
            })}
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
          <p className="mt-2 font-mono text-[0.5625rem] leading-[1.6] tracking-[0.04em] text-mute">
            {FOOTNOTES[index % FOOTNOTES.length]}
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
        <p className="mt-5 border-t border-white/10 pt-4 font-mono text-[0.5625rem] tracking-[0.04em] text-mute">
          {clause}. Read the full clause on the speaker page.
        </p>
      </div>
    </li>
  );
}

export function Speakers({ speakers, settings }: { speakers: Speaker[]; settings: Settings }) {
  const anyAnnounced = speakers.some((s) => s.announced);
  // The applications band lives in Tickets (§ 5.5); only point to it when it is rendered.
  const showApps = settings.sections.showSpeakerApplications;
  return (
    <SectionShell id="speakers" className="py-24 sm:py-44">
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
          className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-reveal="stagger"
          data-reveal-variant="wipe"
        >
          {speakers.map((s, i) => (
            <SpeakerCard key={s.slug} speaker={s} index={i} />
          ))}
        </ul>

        {showApps ? (
          <p data-reveal="fade" className="fine-print mt-10 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>Want to stand on it yourself?</span>
            <a href="#apply-title" className="group tap inline-flex min-h-11 items-center text-white">
              <span className="link-draw group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
                Speaker applications, §&nbsp;5.5
              </span>
            </a>
          </p>
        ) : null}
      </div>
    </SectionShell>
  );
}
