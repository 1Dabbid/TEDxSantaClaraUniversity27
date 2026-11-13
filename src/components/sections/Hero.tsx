import type { CSSProperties } from 'react';
import type { Settings } from '@/lib/content';
import { ticketCta } from '@/lib/tickets';
import { Button } from '@/components/ui/Button';
import { HeroMotion } from '@/motion/sections/HeroMotion';
import { SectionShell } from './SectionShell';

const seq = (n: number) => ({ '--seq': n }) as CSSProperties;

/**
 * Hero. The intro is pure CSS gated on `html.motion` (globals.css), so it starts
 * with the first paint and never waits for JS: the caption types on, the theme
 * name rises by character behind a mask, the footnote marker pops last, and the
 * facts and buttons settle (they are readable from the first frame). HeroMotion
 * adds the scroll-out (scale, tracking, fade) as the 3D microphone takes over.
 */
export function Hero({ settings }: { settings: Settings }) {
  const cta = ticketCta(settings);
  const caption = `${settings.dateISO.slice(0, 4)} theme`;
  const words = settings.themeName.split(/\s+/).filter(Boolean);
  let charIndex = 0;
  const totalChars = words.join('').length;

  return (
    <SectionShell id="hero" scrim="left" className="flex min-h-[calc(100svh-var(--header-h))] flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-black via-black/70 to-transparent"
      />
      <div data-hero className="shell flex flex-1 flex-col justify-end pb-12 pt-16 sm:pb-16">
        <p className="fine-print">
          <span className="hero-type" style={{ '--steps': settings.eventName.length + caption.length + 3 } as CSSProperties}>
            <span className="tracking-normal normal-case text-white">{settings.eventName}</span>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            {caption}
          </span>
        </p>

        <h1
          id="hero-title"
          data-hero-title
          className="mt-6 origin-[0%_100%] text-[clamp(3.5rem,19vw,12.5rem)] leading-[0.88] font-semibold sm:text-display tracking-[-0.06em] [font-variation-settings:'opsz'_32]"
        >
          <span className="sr-only">
            {settings.eventName}: {settings.themeName}
          </span>
          <span aria-hidden="true">
            {words.map((word, w) => (
              <span key={w}>
                {w > 0 ? ' ' : null}
                <span className="hero-word">
                  {Array.from(word).map((ch) => {
                    const i = charIndex++;
                    return (
                      <span key={i} className="hero-char" data-hero-char={i - (totalChars - 1) / 2}>
                        <span style={{ '--i': i } as CSSProperties}>{ch}</span>
                      </span>
                    );
                  })}
                </span>
              </span>
            ))}
          </span>
          <a
            href="#hero-note"
            className="hero-mark ml-[0.08em] align-super font-mono text-[0.3em] font-normal tracking-normal text-accent no-underline transition-colors hover:text-white"
            style={{ '--n': totalChars } as CSSProperties}
          >
            <span aria-hidden="true">1</span>
            <span className="sr-only"> (see note 1)</span>
          </a>
        </h1>

        <div data-hero-body>
          <p
            data-hero-seq
            style={seq(0)}
            className="mt-6 max-w-xl text-lg text-balance text-mute sm:text-2xl sm:leading-snug"
          >
            {settings.themeTagline}
          </p>

          <div className="relative mt-12 max-w-4xl">
            <span aria-hidden="true" className="hero-rule absolute inset-x-0 top-0 h-px origin-left bg-white/15" />
            <dl data-hero-seq style={seq(1)} className="grid gap-6 pt-6 sm:grid-cols-3">
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
                  <span className="block text-mute">Santa Clara University</span>
                </dd>
              </div>
              <div>
                <dt className="fine-print">Capacity</dt>
                <dd className="mt-1.5 text-white">
                  100 seats
                  <span className="block text-mute">Tickets {cta.status}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div data-hero-seq style={seq(2)} className="mt-10 flex flex-wrap items-center gap-3">
            <Button href={cta.href} size="lg" aria-label={cta.ariaLabel}>
              Tickets
            </Button>
            <Button href="#speakers" variant="ghost" size="lg">
              Speakers
            </Button>
          </div>

          <div className="mt-12 flex items-end justify-between gap-8">
            <p id="hero-note" data-hero-seq style={seq(3)} className="fine-print max-w-md">
              <span className="text-accent">1.</span> Terms and conditions apply. They are the whole point.
            </p>
            <a
              href="#theme"
              className="scroll-cue group hidden shrink-0 items-center gap-4 sm:flex"
              data-cursor="link"
            >
              <span className="fine-print text-mute transition-colors group-hover:text-white">
                Scroll to read the fine print
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
