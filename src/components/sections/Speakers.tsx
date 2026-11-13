import Image from 'next/image';
import Link from 'next/link';
import type { Settings, Speaker } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { EventName, keepTedxCase } from '@/components/ui/KeepCase';
import { SpeakersMotion } from '@/motion/sections/SpeakersMotion';
import { SectionShell, SectionTitle } from './SectionShell';

/* Glass over the scene: plain translucency plus a soft gradient (no backdrop
   blur: it would re-filter the live canvas every frame). At these alphas every
   line of text stays AA even over the saturated rug or the spotlight cone. */
const glass = 'border border-white/[0.09] bg-gradient-to-b from-black/[0.66] to-black/[0.54]';
const cardBase = `speaker-card group relative flex min-w-0 flex-col ${glass}`;

/**
 * An announced speaker: portrait, name, role, talk title; the whole card links to the speaker page.
 * `level`: the name's heading level (3 under the home page's section heading, 2 on /speakers,
 * where the list sits directly under the page's h1).
 */
export function SpeakerCard({ speaker, index, level = 3 }: { speaker: Speaker; index: number; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const clause = `§ 2.${index + 1}`;
  return (
    // Phones: portrait beside the text (a column of full-width portraits is six screens long).
    <li className={`${cardBase} max-sm:flex-row`} data-cursor="loupe" data-cursor-zoom="2.2">
      <div className="speaker-photo relative aspect-[4/5] overflow-hidden bg-black max-sm:w-28 max-sm:shrink-0">
        {speaker.photo ? (
          <Image
            src={speaker.photo}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 112px"
            className="object-cover grayscale transition-[filter,transform] duration-1000 ease-[var(--ease-cinema)] group-hover:scale-[1.03] group-hover:grayscale-0"
          />
        ) : null}
        <span aria-hidden="true" className="fine-print absolute left-4 top-4 text-white max-sm:left-2 max-sm:top-2">
          {clause}
        </span>
      </div>
      <div className="speaker-text min-w-0 p-6 max-sm:self-center max-sm:p-4">
        <Heading className="text-xl font-semibold tracking-tight wrap-anywhere">
          <Link href={`/speakers/${speaker.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {speaker.name}
          </Link>
        </Heading>
        {speaker.role ? <p className="mt-1 text-sm text-[#d0d0d0] wrap-anywhere">{speaker.role}</p> : null}
        {speaker.talkTitle ? <p className="mt-4 text-white wrap-anywhere">“{speaker.talkTitle}”</p> : null}
      </div>
    </li>
  );
}

/**
 * The slots still to be announced, as one quiet card (never one card per empty
 * slot, and never a link: a placeholder has nothing to open).
 */
export function SpeakersToCome({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <li className={`${cardBase} speaker-card--tba justify-end p-6 sm:p-7`}>
      <p aria-hidden="true" className="fine-print text-mute">
        More to come
      </p>
      <p className="mt-4 text-xl font-semibold tracking-tight text-balance">
        {count === 1 ? 'One more speaker' : 'More speakers'} to be announced.
      </p>
      <p className="mt-2 text-sm text-[#d0d0d0]">Announced here and to the mailing list first.</p>
    </li>
  );
}

/**
 * Speaker applications, driven by Tickets & speaker applications in the admin.
 * Returns null when the band is switched off (Show / hide sections).
 */
function ApplyToSpeak({ settings }: { settings: Settings }) {
  if (!settings.sections.showSpeakerApplications) return null;
  const state = settings.speakerApplicationsState;
  const open = state === 'open' && Boolean(settings.speakerApplicationsUrl);
  const copy = open
    ? 'Applications are open. Tell us the idea you would bring to the stage.'
    : state === 'closed'
      ? 'Applications for this event are closed. Thank you to everyone who applied.'
      : 'Applications are not open yet. When they open, the link appears here and goes to the mailing list.';
  return (
    <div role="group" aria-labelledby="apply-title">
      <h3 id="apply-title" className="text-lg font-semibold tracking-tight">
        Speak at <EventName />
      </h3>
      <p className="mt-2 max-w-md text-[#d0d0d0]">{copy}</p>
      {open && settings.speakerApplicationsDeadline ? (
        <p className="fine-print mt-3 text-white">Deadline: {keepTedxCase(settings.speakerApplicationsDeadline)}</p>
      ) : null}
      {open ? (
        <div className="mt-5">
          <Button href={settings.speakerApplicationsUrl}>Apply to speak</Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * § 02 · Speakers.
 *
 * Content-driven: the section shows what is true today.
 * - No speaker announced: one statement ("Speakers to be announced"), and a
 *   single glass panel with the one action that helps now (join the mailing
 *   list) next to how to apply to speak. No placeholder cards.
 * - Some announced: their cards, then one "more to be announced" card; an
 *   "Apply to speak" button under the heading while applications are open.
 * - All announced: the cards.
 *
 * Composition (globals.css, SpeakersMotion): static / reduced motion is normal
 * flow on black. Motion on desktop (>= 1024 wide, >= 44rem tall) is a runway
 * with a sticky stage: the heading top left, the lit rug alone mid-frame for a
 * beat, then the strip (cards, or the panel) rises into the lower edge; cards
 * travel sideways when they do not fit. Phones: a short sticky hold, then the list.
 */
export function Speakers({ speakers, settings }: { speakers: Speaker[]; settings: Settings }) {
  const announced = speakers.filter((s) => s.announced);
  const toCome = speakers.length - announced.length;
  const any = announced.length > 0;
  const listHref = settings.newsletterUrl || '#newsletter';
  const appsOpen =
    settings.sections.showSpeakerApplications &&
    settings.speakerApplicationsState === 'open' &&
    Boolean(settings.speakerApplicationsUrl);

  return (
    <SectionShell
      id="speakers"
      scrim="none"
      className={`speakers-runway py-24 sm:py-32 ${any ? '' : 'speakers-runway--tba'}`}
    >
      <div data-speakers-stage className="speakers-stage">
        <div aria-hidden="true" className="speakers-scrim pointer-events-none absolute inset-0 -z-10" />
        <div data-speakers-head className="speakers-head">
          <div className="speakers-head-inner shell">
            <SectionLabel index={2}>Speakers</SectionLabel>
            <div data-speakers-title className="origin-[0%_100%]">
              <SectionTitle id="speakers">{any ? 'Meet the speakers.' : 'Speakers to be announced.'}</SectionTitle>
            </div>
            <div data-speakers-meta className="speakers-meta mt-6 flex flex-col items-start gap-y-3 sm:mt-8">
              <p className="max-w-[34rem] text-lg text-mute">
                Live talks on <time dateTime={settings.dateISO}>{settings.dateLong}</time>, at the{' '}
                {settings.venueName}.
              </p>
              {any && appsOpen ? (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Button href={settings.speakerApplicationsUrl} variant="ghost">
                    Apply to speak
                  </Button>
                  {settings.speakerApplicationsDeadline ? (
                    <span className="fine-print text-mute">
                      Deadline: {keepTedxCase(settings.speakerApplicationsDeadline)}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div data-speakers-strip className="speakers-strip shell">
          {any ? (
            <ul
              data-speakers-track
              aria-label="Speakers"
              className="speakers-track mt-14 grid grid-cols-1 gap-3 sm:mt-16 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
              data-reveal="stagger"
              data-reveal-variant="wipe"
            >
              {speakers.map((s, i) => (s.announced ? <SpeakerCard key={s.slug} speaker={s} index={i} /> : null))}
              <SpeakersToCome count={toCome} />
            </ul>
          ) : (
            <div data-speakers-track className="speakers-track mt-14 sm:mt-16">
              <div
                className={`speakers-panel grid gap-10 p-6 sm:p-8 md:grid-cols-2 md:gap-12 ${glass}`}
              >
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Hear it first</h3>
                  <p className="mt-2 max-w-md text-[#d0d0d0]">
                    Speaker announcements, the running order and ticket sales go to the mailing list before anywhere else.
                  </p>
                  <div className="mt-5">
                    <Button href={listHref}>Join the mailing list</Button>
                  </div>
                </div>
                <ApplyToSpeak settings={settings} />
              </div>
            </div>
          )}
        </div>
      </div>
      <SpeakersMotion />
    </SectionShell>
  );
}
