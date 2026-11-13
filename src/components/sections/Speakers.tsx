import Image from 'next/image';
import Link from 'next/link';
import type { Settings, Speaker } from '@/lib/content';
import { ComingSoonBadge } from '@/components/ui/ComingSoon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SpeakersMotion } from '@/motion/sections/SpeakersMotion';
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

/* Glass over the scene: plain translucency plus a soft gradient (no backdrop
   blur: it would re-filter the live canvas every frame). At these alphas every
   line of text stays AA even over the saturated rug or the spotlight cone. */
const cardBase =
  'speaker-card group relative flex min-w-0 flex-col border border-white/[0.09] bg-gradient-to-b from-black/[0.62] to-black/[0.48]';

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

export function SpeakerCard({ speaker, index }: { speaker: Speaker; index: number }) {
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
          <span className="fine-print text-right text-[#d0d0d0]">{STATUS[index % STATUS.length]}</span>
        </div>

        <div aria-hidden="true" className="speaker-body mt-6 sm:mt-auto">
          <span
            className={`speaker-num block font-mono text-[clamp(3.25rem,9vw,7.5rem)] leading-none font-light tracking-[-0.06em] text-white/[0.08] tabular-nums ${index % 3 === 1 ? 'text-right' : ''}`}
          >
            {num}
          </span>
          <div className="speaker-bars mt-5 sm:mt-6">
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

        <div className="speaker-foot mt-6 border-t border-white/10 pt-5 sm:mt-8">
          <h3 className="text-lg font-semibold tracking-tight">
            <Link
              href={`/speakers/${speaker.slug}`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {speaker.name}
              <span className="sr-only">, speaker {index + 1}</span>
            </Link>
          </h3>
          <p className="mt-2 font-mono text-[0.5625rem] leading-[1.6] tracking-[0.04em] text-[#d0d0d0]">
            {FOOTNOTES[index % FOOTNOTES.length]}
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className={cardBase} data-cursor="loupe" data-cursor-zoom="2.2">
      <div className="speaker-photo relative aspect-[4/5] overflow-hidden bg-black">
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
      <div className="speaker-text p-6">
        <h3 className="text-xl font-semibold tracking-tight">
          <Link href={`/speakers/${speaker.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {speaker.name}
          </Link>
        </h3>
        {speaker.role ? <p className="mt-1 text-sm text-[#d0d0d0]">{speaker.role}</p> : null}
        {speaker.talkTitle ? <p className="mt-4 text-white">“{speaker.talkTitle}”</p> : null}
        <p className="mt-5 border-t border-white/10 pt-4 font-mono text-[0.5625rem] tracking-[0.04em] text-[#d0d0d0]">
          {clause}. Read the full clause on the speaker page.
        </p>
      </div>
    </li>
  );
}

/**
 * § 02 · Speakers.
 *
 * Opens on a stage moment, then the cards. The markup is one document in every
 * mode (heading, caption, list of cards); globals.css and SpeakersMotion change
 * only how it composes over the scene:
 *
 * - Static / no JS / reduced motion: normal flow on black, a grid of cards.
 * - Motion, desktop (>= 1024 wide, >= 44rem tall): a tall runway with a sticky,
 *   full-viewport stage. The heading sits top left, small to large, and the lit
 *   red rug holds the frame, unobstructed, while the camera lands on it. Only
 *   then does a strip of glass cards rise into the lower edge and travel sideways
 *   with the scroll, the rug still visible above it. Keyboard focus on a card
 *   scrolls the page to the point where that card is in view.
 * - Motion, phones / tablets / short viewports: the heading block holds (sticky)
 *   over the rug for a short while, then a plain vertical list of cards.
 */
export function Speakers({ speakers, settings }: { speakers: Speaker[]; settings: Settings }) {
  const anyAnnounced = speakers.some((s) => s.announced);
  // The applications band lives in Tickets (§ 5.5); only point to it when it is rendered.
  const showApps = settings.sections.showSpeakerApplications;
  const count = COUNT_WORDS[speakers.length] ?? String(speakers.length);
  return (
    <SectionShell id="speakers" scrim="none" className="speakers-runway py-24 sm:py-36">
      <div data-speakers-stage className="speakers-stage">
        <div aria-hidden="true" className="speakers-scrim pointer-events-none absolute inset-0 -z-10" />
        <div data-speakers-head className="speakers-head">
          <div className="speakers-head-inner shell">
            <SectionLabel index={2}>Speakers</SectionLabel>
            <div data-speakers-title className="origin-[0%_100%]">
              <SectionTitle id="speakers">On the red circle.</SectionTitle>
            </div>
            <div data-speakers-meta className="speakers-meta mt-6 flex flex-col items-start gap-y-3 sm:mt-8">
              {!anyAnnounced ? <ComingSoonBadge>Lineup announced soon</ComingSoonBadge> : null}
              <p className="fine-print max-w-[34rem] text-mute">
                <span className="text-white">§&nbsp;2.0</span> {count} talks. One red circle. Names withheld until the
                ink is dry.
              </p>
              {showApps ? (
                <p className="fine-print flex flex-wrap items-baseline gap-x-3">
                  <span>Want to stand on it yourself?</span>
                  <a href="#apply-title" className="group tap inline-flex min-h-11 items-center text-white">
                    <span className="link-draw group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
                      Speaker applications, §&nbsp;5.5
                    </span>
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div data-speakers-strip className="speakers-strip shell">
          <ul
            data-speakers-track
            aria-label="Speakers"
            className="speakers-track mt-14 grid grid-cols-1 gap-3 sm:mt-16 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
            data-reveal="stagger"
            data-reveal-variant="wipe"
          >
            {speakers.map((s, i) => (
              <SpeakerCard key={s.slug} speaker={s} index={i} />
            ))}
          </ul>
        </div>
      </div>
      <SpeakersMotion />
    </SectionShell>
  );
}
