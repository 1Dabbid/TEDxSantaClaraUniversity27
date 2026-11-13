import type { Settings } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

export function Venue({ settings }: { settings: Settings }) {
  return (
    <SectionShell id="venue" scrim="left" className="py-32 sm:py-44">
      <div className="shell grid gap-16 md:grid-cols-12">
        <div className="md:col-span-7">
          <SectionLabel index={4}>Venue</SectionLabel>
          <SectionTitle id="venue">{settings.venueName}</SectionTitle>
          <dl className="mt-12 grid gap-8 sm:grid-cols-2">
            <div>
              <dt className="fine-print">Where</dt>
              <dd className="mt-2">
                <address className="not-italic leading-relaxed whitespace-pre-line text-white">
                  {settings.venueAddress}
                </address>
              </dd>
            </div>
            <div>
              <dt className="fine-print">When</dt>
              <dd className="mt-2 leading-relaxed text-white">
                <time dateTime={settings.dateISO}>{settings.dateLong}</time>
                <span className="block text-mute">
                  {settings.doorsTime ? `Doors ${settings.doorsTime}` : 'Times to be announced'}
                </span>
              </dd>
            </div>
          </dl>
          {settings.directionsNotes ? <p className="mt-8 max-w-lg text-mute">{settings.directionsNotes}</p> : null}
          {settings.mapUrl ? (
            <div className="mt-10">
              <Button href={settings.mapUrl} variant="ghost">
                Open in Maps
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-end md:col-span-5 md:items-end md:text-right">
          <p className="text-[clamp(6rem,18vw,15rem)] leading-[0.8] font-semibold tracking-[-0.07em] tabular-nums">
            100
          </p>
          <p className="fine-print mt-4">Seats. That is the whole room.</p>
        </div>
      </div>
    </SectionShell>
  );
}
