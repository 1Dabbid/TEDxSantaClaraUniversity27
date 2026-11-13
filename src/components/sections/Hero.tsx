import type { Settings } from '@/lib/content';
import { ticketCta } from '@/lib/tickets';
import { Button } from '@/components/ui/Button';
import { FootnoteMark } from '@/components/ui/FootnoteMark';
import { SectionShell } from './SectionShell';

export function Hero({ settings }: { settings: Settings }) {
  const cta = ticketCta(settings);
  return (
    <SectionShell id="hero" scrim="left" className="flex min-h-[calc(100svh-var(--header-h))] flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-black via-black/70 to-transparent"
      />
      <div className="shell flex flex-1 flex-col justify-end pb-14 pt-16 sm:pb-20">
        <p className="fine-print">
          <span className="tracking-normal normal-case text-white">{settings.eventName}</span>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, </span>
          {settings.dateISO.slice(0, 4)} theme
        </p>

        <h1
          id="hero-title"
          className="mt-6 text-display font-semibold tracking-[-0.06em] [font-variation-settings:'opsz'_32]"
        >
          <span className="sr-only">{settings.eventName}: </span>
          {settings.themeName}
          <FootnoteMark n={1} href="#hero-note" />
        </h1>

        <p className="mt-6 max-w-xl text-lg text-balance text-mute sm:text-2xl sm:leading-snug">
          {settings.themeTagline}
        </p>

        <dl className="mt-12 grid max-w-4xl gap-6 border-t border-white/15 pt-6 sm:grid-cols-3">
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

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button href={cta.href} size="lg" aria-label={cta.ariaLabel}>
            Tickets
          </Button>
          <Button href="#speakers" variant="ghost" size="lg">
            Speakers
          </Button>
        </div>

        <p id="hero-note" className="fine-print mt-12 max-w-md">
          <span className="text-accent">1.</span> Terms and conditions apply. They are the whole point. Scroll to read
          the fine print.
        </p>
      </div>
    </SectionShell>
  );
}
