import type { Settings } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { ComingSoonBadge } from '@/components/ui/ComingSoon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

const COPY: Record<Settings['ticketState'], { title: string; body: string }> = {
  'coming-soon': {
    title: 'Tickets are coming soon.',
    body: 'Seats are limited to 100. Join the mailing list and you will hear the moment tickets go on sale.',
  },
  'on-sale': {
    title: 'Tickets are on sale.',
    body: 'Seats are limited to 100. When they are gone, they are gone.',
  },
  'sold-out': {
    title: 'Sold out.',
    body: 'All 100 seats are taken. Join the mailing list in case seats are released.',
  },
  closed: {
    title: 'Ticket sales are closed.',
    body: 'Thank you to everyone who will be in the room.',
  },
};

export function Tickets({ settings }: { settings: Settings }) {
  const state = settings.ticketState;
  const copy = COPY[state];
  const onSale = state === 'on-sale' && settings.ticketUrl;
  return (
    <SectionShell id="tickets" className="py-32 sm:py-44">
      <div className="shell">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-7">
            <SectionLabel index={5}>Tickets</SectionLabel>
            <SectionTitle id="tickets">{copy.title}</SectionTitle>
            <p className="mt-6 max-w-xl text-lg text-mute">{copy.body}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              {onSale ? (
                <Button href={settings.ticketUrl} size="lg">
                  Get tickets
                </Button>
              ) : state === 'coming-soon' || state === 'sold-out' ? (
                <Button href="#newsletter" size="lg">
                  Get notified
                </Button>
              ) : null}
            </div>
          </div>
          <aside aria-label="Ticket details" className="self-end md:col-span-5">
            {state === 'coming-soon' ? <ComingSoonBadge /> : null}
            <ul className="mt-6 space-y-4 border-t border-white/15 pt-6">
              <li className="grid grid-cols-[3.25rem_1fr] gap-2">
                <span aria-hidden="true" className="fine-print text-white">§&nbsp;5.1</span>
                <span className="text-mute">Capacity is limited to 100 attendees.</span>
              </li>
              {settings.ticketPriceNote ? (
                <li className="grid grid-cols-[3.25rem_1fr] gap-2">
                  <span aria-hidden="true" className="fine-print text-white">§&nbsp;5.2</span>
                  <span className="text-mute">{settings.ticketPriceNote}</span>
                </li>
              ) : null}
              <li className="grid grid-cols-[3.25rem_1fr] gap-2">
                <span aria-hidden="true" className="fine-print text-white">§&nbsp;5.3</span>
                <span className="text-mute">
                  <time dateTime={settings.dateISO}>{settings.dateLong}</time>, {settings.venueName}.
                </span>
              </li>
            </ul>
          </aside>
        </div>

        {onSale && settings.ticketEmbedUrl ? (
          <div className="mt-16 overflow-hidden rounded-sm border border-white/10 bg-white" data-lenis-prevent>
            <iframe
              src={settings.ticketEmbedUrl}
              title="Ticket checkout"
              loading="lazy"
              className="h-[42rem] w-full"
            />
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}
