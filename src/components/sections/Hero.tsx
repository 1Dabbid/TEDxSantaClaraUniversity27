import type { CSSProperties } from 'react';
import type { Settings } from '@/lib/content';
import { ticketCta } from '@/lib/tickets';
import { seatsLabel } from '@/lib/site';
import { Button } from '@/components/ui/Button';
import { WatchLive } from '@/components/ui/WatchLive';
import { HeroMotion } from '@/motion/sections/HeroMotion';
import { SectionShell } from './SectionShell';

const seq = (n: number) => ({ '--seq': n }) as CSSProperties;

/*
 * Phone headline fitting. Advance widths of Inter Bold (per 1000 em) for the
 * characters below, measured from the self-hosted font. The server works out
 * the widest word in em, so on phones each word sits on its own line at the
 * size that fills the column exactly, with no client-side measuring (and no
 * layout shift). Unknown characters fall back to a generous average.
 */
const ADV_CHARS = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~’‘“”–—…';
const ADV = [338,552,649,655,1016,672,339,377,377,559,679,334,468,334,388,674,431,630,646,676,622,649,599,651,649,334,343,679,679,679,560,1016,760,662,740,722,607,587,750,747,281,584,719,565,932,762,771,648,777,657,655,667,732,760,1057,738,731,664,377,344,377,487,476,365,581,630,588,630,596,360,632,623,271,271,580,271,913,623,613,630,630,414,560,357,623,600,850,580,602,573,469,372,469,679,311,311,540,532,500,1000,1002];
const TRACKING = -0.06; // em, matches the headline's tracking

function wordEm(word: string): number {
  let w = 0;
  for (const ch of word) {
    const i = ADV_CHARS.indexOf(ch);
    w += (i >= 0 ? ADV[i] : 640) / 1000 + TRACKING;
  }
  return w;
}

/**
 * Hero. The intro is pure CSS gated on `html.motion` (globals.css), so it starts
 * with the first paint and never waits for JS or fonts: the caption types on,
 * each word of the theme name rises from a mask with a shear that settles (left
 * letters lead, so it reads as a letter stagger while every word stays one text
 * run and keeps its kerning), and the facts and buttons settle (readable from the first frame). HeroMotion adds the scroll-out.
 *
 * Phones: one word per line, sized to fill the column (see wordEm), bold. The
 * facts stack in a narrow left column so the lower right stays open for the
 * mic, with a local scrim behind the text only.
 */
export function Hero({ settings, speakersAnnounced }: { settings: Settings; speakersAnnounced: boolean }) {
  const cta = ticketCta(settings);
  const caption = `${settings.dateISO.slice(0, 4)} theme`;
  const words = settings.themeName.split(/\s+/).filter(Boolean);
  // Theme copy (content/theme-copy.yaml). A blank caption is left out.
  const { heroFootnote, heroScrollCue } = settings.copy;
  const fitEm = Math.max(1, ...words.map(wordEm));
  const center = (words.length - 1) / 2;

  return (
    <SectionShell id="hero" scrim="none" className="flex min-h-[calc(100svh-var(--header-h))] flex-col">
      {/* Local scrim behind the text column only; the mic (right third on
          desktop, lower right on phones) is left clean. */}
      <div aria-hidden="true" className="hero-scrim pointer-events-none absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-black via-black/70 to-transparent"
      />
      <div data-hero className="shell flex flex-1 flex-col justify-end pb-10 pt-10 sm:pb-16 sm:pt-16">
        {/* The h1 holds the visible event-name line and the theme; the scroll-out
            (data-hero-title) still moves only the theme, as before. */}
        <h1 id="hero-title">
        <span className="fine-print block">
          <span className="hero-type" style={{ '--steps': settings.eventName.length + caption.length + 3 } as CSSProperties}>
            <span className="tracking-normal normal-case text-white">{settings.eventName}</span>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            {caption}
          </span>
        </span>

        <span
          data-hero-title
          className="hero-title mt-5 block origin-[0%_100%] font-bold leading-[0.86] tracking-[-0.06em] sm:mt-6 sm:text-display sm:leading-[0.88] sm:font-semibold"
          style={{ '--hero-em': fitEm.toFixed(3) } as CSSProperties}
        >
          <span className="sr-only">: {settings.themeName}</span>
          <span aria-hidden="true">
            {words.map((word, w) => (
              <span key={w}>
                {w > 0 ? ' ' : null}
                <span className="hero-word" data-hero-word={w - center}>
                  <span style={{ '--w': w } as CSSProperties}>{word}</span>
                </span>
              </span>
            ))}
          </span>
        </span>
        </h1>

        {/* Phones: the buttons come straight after the tagline (CSS order), so the
            name, theme, date, venue and both actions fit the first screen even
            at 360x740. The facts have nothing focusable: tab order is unchanged. */}
        <div data-hero-body className="flex flex-col">
          <p
            data-hero-seq
            style={seq(0)}
            className="mt-6 max-w-[12.75rem] text-lg text-balance text-mute min-[400px]:max-w-[15rem] sm:max-w-xl sm:text-2xl sm:leading-snug"
          >
            {settings.themeTagline}
          </p>

          <div className="hero-facts relative mt-7 max-w-[15.5rem] max-sm:order-2 sm:mt-12 sm:max-w-[min(54rem,56vw)]">
            <span aria-hidden="true" className="hero-rule absolute inset-x-0 top-0 h-px origin-left bg-white/15" />
            <dl data-hero-seq style={seq(1)} className="grid grid-cols-1 gap-y-3.5 pt-5 sm:grid-cols-3 sm:gap-6 sm:pt-6">
              <div>
                <dt className="fine-print">Date</dt>
                <dd className="mt-1.5 text-white">
                  <time dateTime={settings.dateISO}>{settings.dateLong}</time>
                </dd>
              </div>
              <div>
                <dt className="fine-print">Venue</dt>
                <dd className="mt-1.5 text-white">
                  {settings.venueName}
                  {settings.venueCampus ? <span className="block text-mute">{settings.venueCampus}</span> : null}
                </dd>
              </div>
              <div>
                <dt className="fine-print">Capacity</dt>
                <dd className="mt-1.5 text-white">
                  {seatsLabel(settings.capacity)}
                  <span className="block text-mute">Tickets {cta.status}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div data-hero-seq style={seq(2)} className="mt-7 flex flex-wrap items-center gap-3 max-sm:order-1 sm:mt-10">
            <Button href={cta.href} size="lg" aria-label={cta.ariaLabel} className="max-sm:px-6">
              Tickets
            </Button>
            {/* Second action: the lineup once there is one; until then the mailing list,
                which is where every announcement goes first. */}
            {speakersAnnounced ? (
              <Button href="#speakers" variant="ghost" size="lg" className="max-sm:bg-black/75 max-sm:px-6">
                Speakers
              </Button>
            ) : (
              <Button
                href={settings.newsletterUrl || '#newsletter'}
                variant="ghost"
                size="lg"
                data-hero-updates
                className="max-sm:bg-black/75 max-sm:px-6"
              >
                Get updates
              </Button>
            )}
            <WatchLive url={settings.livestreamUrl} size="lg" className="sm:ml-3" />
          </div>

          <div className="mt-8 flex items-end justify-between gap-8 max-sm:order-3 sm:mt-12">
            {heroFootnote ? (
              <p data-hero-seq style={seq(3)} className="fine-print max-w-lg">
                {heroFootnote}
              </p>
            ) : (
              <span />
            )}
            <a
              href="#theme"
              className="scroll-cue group hidden shrink-0 items-center gap-4 sm:flex"
              data-cursor="link"
            >
              <span className="fine-print text-mute transition-colors group-hover:text-white">
                {heroScrollCue}
              </span>
              <span aria-hidden="true" className="scroll-cue-line" />
            </a>
          </div>
        </div>
      </div>
      <HeroMotion />
    </SectionShell>
  );
}
