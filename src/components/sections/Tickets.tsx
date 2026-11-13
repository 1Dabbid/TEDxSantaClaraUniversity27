import type { CSSProperties } from 'react';
import type { ApplicationsState, Settings, TicketState } from '@/lib/content';
import { getFaq } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { WatchLive } from '@/components/ui/WatchLive';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { keepTedxCase } from '@/components/ui/KeepCase';
import { ClauseNo, StatusRegister } from '@/components/print/Print';
import { TicketsMotion } from '@/motion/sections/TicketsMotion';
import { SectionShell, SectionTitle } from './SectionShell';

const TICKET_OPTIONS = [
  { value: 'coming-soon', label: 'Coming soon' },
  { value: 'on-sale', label: 'On sale' },
  { value: 'sold-out', label: 'Sold out' },
  { value: 'closed', label: 'Closed' },
] as const satisfies readonly { value: TicketState; label: string }[];

const APPLICATION_OPTIONS = [
  { value: 'coming-soon', label: 'Coming soon' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
] as const satisfies readonly { value: ApplicationsState; label: string }[];

/** Seat numbers are printed with three figures: 001 … 100. */
const pad = (n: number) => String(n).padStart(3, '0');

type Copy = { title: string; subtitle: string; body: string };

/** The whole state machine's copy in one place. */
const COPY: Record<TicketState, Copy> = {
  'coming-soon': {
    title: 'Not on sale yet.',
    subtitle: 'The list hears first.',
    body: 'Tickets are announced to the mailing list before anywhere else. Join it and you will hear the moment they go on sale.',
  },
  'on-sale': {
    title: 'Tickets are on sale.',
    subtitle: 'One room, one evening.',
    body: 'When the room is full, it is full.',
  },
  'sold-out': {
    title: 'Every seat is taken.',
    subtitle: 'Sold out.',
    body: 'Join the mailing list in case seats are released.',
  },
  closed: {
    title: 'Ticket sales are closed.',
    subtitle: 'Thank you.',
    body: 'To everyone who will be in the room: see you there. Talks are recorded and published on the TEDx YouTube channel after the event.',
  },
};

/**
 * The room as a ruler: one hairline per seat (settings.capacity) on a common
 * baseline, every tenth seat drawn long and numbered, plus the first and the
 * last. All seats across on desktop, two rows on phones. All ticks brighten
 * when sold out. Decorative. TicketsMotion reads the ticks and `data-seats`.
 */
function SeatStrip({ seats, filled }: { seats: number; filled: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-seat-ruler
      data-seats={seats}
      className="grid grid-cols-[repeat(var(--seats-row),minmax(0,1fr))] gap-y-12 md:grid-cols-[repeat(var(--seats),minmax(0,1fr))]"
      style={{ '--seats': seats, '--seats-row': Math.ceil(seats / 2) } as CSSProperties}
    >
      {Array.from({ length: seats }, (_, i) => {
        const n = i + 1;
        const last = n === seats;
        const major = n % 10 === 0 || last;
        // A tenth seat right before the last one would collide with its label.
        const labelled = n === 1 || last || (major && seats - n >= 5);
        return (
          <span key={n} className="relative flex h-7 items-end border-b border-white/25">
            <span
              data-seat-tick
              className={`block w-px ${n === 1 ? 'mr-auto' : 'ml-auto'} ${
                major ? `h-7 ${filled ? 'bg-white' : 'bg-white/70'}` : `h-3.5 ${filled ? 'bg-white/80' : 'bg-white/30'}`
              }`}
            />
            {labelled ? (
              <span
                data-seat-label
                className={`absolute top-full mt-2 font-mono text-[0.625rem] tracking-[0.04em] text-mute tabular-nums ${
                  n === 1 ? 'left-0' : 'right-0'
                } ${n === 1 || last ? 'text-white' : ''} ${n % 20 === 10 && n !== 1 && !last ? 'max-md:hidden' : ''}`}
              >
                {pad(n)}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function NewsletterButton({ settings, variant = 'primary' }: { settings: Settings; variant?: 'primary' | 'ghost' }) {
  return (
    <Button href={settings.newsletterUrl || '#newsletter'} size="lg" variant={variant}>
      Join the mailing list
    </Button>
  );
}

function TicketAction({ settings, showFaq }: { settings: Settings; showFaq: boolean }) {
  switch (settings.ticketState) {
    case 'on-sale':
      return settings.ticketUrl ? (
        <Button href={settings.ticketUrl} size="lg">
          Get tickets
        </Button>
      ) : (
        <p className="fine-print text-white">Ticket link going live shortly.</p>
      );
    case 'coming-soon':
    case 'sold-out':
      return <NewsletterButton settings={settings} />;
    case 'closed':
      return showFaq ? (
        <Button href="#faq" size="lg" variant="ghost">
          Read the FAQ
        </Button>
      ) : null;
  }
}

/** Lazily loaded, sandboxed checkout. The fixed-height frame reserves space so nothing shifts on load. */
function TicketEmbed({ src, eventName }: { src: string; eventName: string }) {
  return (
    <figure className="mt-16 sm:mt-24">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3 border-t border-white/15 pt-4">
        <span className="fine-print text-white">Schedule A · Checkout</span>
        <span className="fine-print text-mute">Provided by the ticketing service. Opens in this page.</span>
      </figcaption>
      <div
        className="relative mt-4 h-[44rem] overflow-hidden border border-white/15 bg-panel sm:h-[38rem]"
        data-lenis-prevent
      >
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="block h-px w-16 bg-white/30" />
          <span className="fine-print text-mute">Loading checkout</span>
        </div>
        <iframe
          src={src}
          title={`Ticket checkout for ${eventName}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          className="relative size-full border-0 bg-transparent"
        />
      </div>
    </figure>
  );
}

function SpeakerApplications({ settings }: { settings: Settings }) {
  const state = settings.speakerApplicationsState;
  const copy =
    state === 'open'
      ? 'Applications are open. Tell us the idea you would put on the red circle.'
      : state === 'closed'
        ? 'Applications are closed for this event. Thank you to everyone who applied.'
        : 'Applications have not opened yet. The mailing list hears first.';
  return (
    <div aria-labelledby="apply-title" role="group" className="mt-24 border-t border-white/15 pt-10 sm:mt-32 sm:pt-12">
      <div className="grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <h3 id="apply-title" className="flex items-baseline gap-4 text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
            <ClauseNo>5.5</ClauseNo>
            Speaker applications
          </h3>
          <p className="mt-4 max-w-lg text-mute">{copy}</p>
          {state === 'open' && settings.speakerApplicationsDeadline ? (
            <p className="fine-print mt-3 text-white">Deadline: {keepTedxCase(settings.speakerApplicationsDeadline)}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-6 md:col-span-5 md:items-end">
          <StatusRegister label="Status" options={APPLICATION_OPTIONS} value={state} />
          {state === 'open' && settings.speakerApplicationsUrl ? (
            <Button href={settings.speakerApplicationsUrl}>Apply to speak</Button>
          ) : state === 'coming-soon' ? (
            <Button
              href={settings.newsletterUrl || '#newsletter'}
              variant="ghost"
              className="h-auto! min-h-11 py-2.5 text-center whitespace-normal!"
            >
              Get notified when applications open
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export async function Tickets({ settings }: { settings: Settings }) {
  // Only point at the FAQ when that section is actually rendered.
  const faq = await getFaq();
  const showFaq = settings.sections.showFaq && faq.length > 0;
  const state = settings.ticketState;
  const copy = COPY[state];
  const showEmbed = state === 'on-sale' && Boolean(settings.ticketEmbedUrl);
  const seats = settings.capacity;

  return (
    <SectionShell id="tickets" className="py-32 sm:py-44">
      <TicketsMotion />
      <div className="shell">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div data-reveal="fade">
            <SectionLabel index={5}>Tickets</SectionLabel>
          </div>
          <StatusRegister label="Ticket status" options={TICKET_OPTIONS} value={state} />
        </div>

        {/* Seat counter */}
        <div className="mt-14 sm:mt-20">
          {/* Sized to the container so the numerals span the full measure, like the ruler beneath. */}
          <div className="@container">
          <p
            aria-hidden="true"
            className="-ml-[0.04em] leading-[0.82] font-semibold tracking-[-0.06em] whitespace-nowrap tabular-nums"
            style={{ fontSize: 'calc(100cqi / 4.5)' }}
          >
            {pad(1)}
            <span data-seat-dash className="mx-[0.14em] inline-block h-[0.035em] w-[0.7em] bg-white/50 align-middle" />
            <span data-seat-count>{pad(seats)}</span>
          </p>
          </div>
          <div className="mt-8 sm:mt-12">
            <SeatStrip seats={seats} filled={state === 'sold-out'} />
          </div>
          {/* Caption for the decorative strip; the heading and clause 5.1 carry the capacity. */}
          <div aria-hidden="true" className="mt-12 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className="fine-print text-mute">Fig.&nbsp;5 · One tick per seat</span>
            <span data-cursor="loupe" className="fine-print text-mute">
              Seat {seats}. That is the whole room.
            </span>
          </div>
        </div>

        <div className="mt-16 grid gap-12 sm:mt-24 md:grid-cols-12">
          <div className="md:col-span-7">
            <SectionTitle id="tickets">
              <span data-reveal="lines" className="block">
                {copy.title}
              </span>{' '}
              <span data-reveal="lines" data-reveal-delay="0.15" className="block text-mute">
                {copy.subtitle}
              </span>
            </SectionTitle>
            <p data-reveal="fade" className="mt-8 max-w-xl text-lg text-mute">
              {state === 'on-sale' && settings.ticketPriceNote ? `${settings.ticketPriceNote} ${copy.body}` : copy.body}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <TicketAction settings={settings} showFaq={showFaq} />
              <WatchLive url={settings.livestreamUrl} size="lg" className="sm:ml-3" />
            </div>
          </div>

          <aside aria-label="Ticket terms" className="self-end md:col-span-5">
            <ul data-reveal="stagger" className="border-t border-white/15">
              <li className="grid grid-cols-[3.5rem_1fr] gap-2 border-b border-white/15 py-5">
                <ClauseNo>5.1</ClauseNo>
                <span className="text-mute">Capacity is limited to {seats} guests.</span>
              </li>
              {settings.ticketPriceNote ? (
                <li className="grid grid-cols-[3.5rem_1fr] gap-2 border-b border-white/15 py-5">
                  <ClauseNo>5.2</ClauseNo>
                  <span className="text-mute">{settings.ticketPriceNote}</span>
                </li>
              ) : null}
              <li className="grid grid-cols-[3.5rem_1fr] gap-2 border-b border-white/15 py-5">
                <ClauseNo>5.3</ClauseNo>
                <span className="text-mute">
                  Valid for <time dateTime={settings.dateISO}>{settings.dateLong}</time> only, at the{' '}
                  {settings.venueName}.
                </span>
              </li>
              {showFaq ? (
                <li className="grid grid-cols-[3.5rem_1fr] gap-2 border-b border-white/15 py-5">
                  <ClauseNo>5.4</ClauseNo>
                  <p className="text-mute">
                    Questions about access or seating? See the <a href="#faq">FAQ</a>.
                  </p>
                </li>
              ) : null}
            </ul>
          </aside>
        </div>

        {showEmbed ? <TicketEmbed src={settings.ticketEmbedUrl} eventName={settings.eventName} /> : null}

        {settings.sections.showSpeakerApplications ? <SpeakerApplications settings={settings} /> : null}
      </div>
    </SectionShell>
  );
}
