import type { ApplicationsState, Settings, TicketState } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ClauseNo, StatusRegister } from '@/components/print/Print';
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

type Copy = { title: string; subtitle: string; body: string };

/** The whole state machine's copy in one place. */
const COPY: Record<TicketState, Copy> = {
  'coming-soon': {
    title: '100 seats.',
    subtitle: 'Tickets not yet on sale.',
    body: 'Join the mailing list and you will hear the moment they are.',
  },
  'on-sale': {
    title: 'Tickets are on sale.',
    subtitle: '100 seats, one evening.',
    body: 'When the room is full, it is full.',
  },
  'sold-out': {
    title: 'All 100 seats are taken.',
    subtitle: 'Sold out.',
    body: 'Join the mailing list in case seats are released.',
  },
  closed: {
    title: 'Ticket sales are closed.',
    subtitle: 'Thank you to everyone who will be in the room.',
    body: 'Talks are recorded and published on the TEDx YouTube channel after the event.',
  },
};

/** 100 hairline ticks, one per seat. Filled when sold out. Decorative. */
function SeatStrip({ filled }: { filled: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[repeat(50,minmax(0,1fr))] gap-x-[3px] gap-y-2 md:grid-cols-[repeat(100,minmax(0,1fr))]"
    >
      {Array.from({ length: 100 }, (_, i) => (
        <span
          key={i}
          className={`block h-5 ${filled ? 'bg-white/70' : i % 10 === 9 ? 'bg-white/45' : 'bg-white/20'}`}
        />
      ))}
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

function TicketAction({ settings }: { settings: Settings }) {
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
      return (
        <Button href="#faq" size="lg" variant="ghost">
          Read the FAQ
        </Button>
      );
  }
}

/** Lazily loaded, sandboxed checkout. The fixed-height frame reserves space so nothing shifts on load. */
function TicketEmbed({ src, eventName }: { src: string; eventName: string }) {
  return (
    <figure className="mt-16 sm:mt-24">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3 border-t border-white/15 pt-4">
        <span className="fine-print text-white">Schedule A · Checkout</span>
        <span className="fine-print">Provided by the ticketing service. Opens in this page.</span>
      </figcaption>
      <div
        className="relative mt-4 h-[44rem] overflow-hidden border border-white/15 bg-panel sm:h-[38rem]"
        data-lenis-prevent
      >
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="block h-px w-16 bg-white/30" />
          <span className="fine-print">Loading checkout</span>
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
    <div aria-labelledby="apply-title" role="group" className="mt-20 border border-white/15 bg-black/80 p-6 sm:mt-28 sm:p-10">
      <div className="grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <h3 id="apply-title" className="flex items-baseline gap-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            <ClauseNo>5.5</ClauseNo>
            Speaker applications
          </h3>
          <p className="mt-4 max-w-lg text-mute">{copy}</p>
          {state === 'open' && settings.speakerApplicationsDeadline ? (
            <p className="fine-print mt-3 text-white">Deadline: {settings.speakerApplicationsDeadline}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-6 md:col-span-5 md:items-end">
          <StatusRegister label="Status" options={APPLICATION_OPTIONS} value={state} />
          {state === 'open' && settings.speakerApplicationsUrl ? (
            <Button href={settings.speakerApplicationsUrl}>Apply to speak</Button>
          ) : state === 'coming-soon' ? (
            <Button href={settings.newsletterUrl || '#newsletter'} variant="ghost">
              Get notified when applications open
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Tickets({ settings }: { settings: Settings }) {
  const state = settings.ticketState;
  const copy = COPY[state];
  const showEmbed = state === 'on-sale' && Boolean(settings.ticketEmbedUrl);

  return (
    <SectionShell id="tickets" className="py-32 sm:py-44">
      <div className="shell">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div data-reveal="fade">
            <SectionLabel index={5}>Tickets</SectionLabel>
          </div>
          <StatusRegister label="Ticket status" options={TICKET_OPTIONS} value={state} />
        </div>

        {/* Seat counter */}
        <div className="mt-14 sm:mt-20">
          <p
            data-reveal="chars"
            aria-hidden="true"
            className="text-[clamp(3.75rem,17vw,15rem)] leading-[0.82] font-semibold tracking-[-0.06em] tabular-nums"
          >
            001
            <span className="mx-[0.14em] inline-block h-[0.035em] w-[0.7em] bg-white/50 align-middle" />
            100
          </p>
          <div className="mt-6 sm:mt-8">
            <SeatStrip filled={state === 'sold-out'} />
          </div>
          <div className="mt-3 flex justify-between">
            <span className="fine-print">Seat 001</span>
            <span data-cursor="loupe" className="fine-print">
              Seat 100. That is the whole room.
            </span>
          </div>
        </div>

        <div className="mt-16 grid gap-12 sm:mt-24 md:grid-cols-12">
          <div className="md:col-span-7">
            <SectionTitle id="tickets">
              <span data-reveal="lines" className="block">
                {copy.title}
              </span>
              <span data-reveal="lines" data-reveal-delay="0.15" className="block text-mute">
                {copy.subtitle}
              </span>
            </SectionTitle>
            <p data-reveal="fade" className="mt-8 max-w-xl text-lg text-mute">
              {copy.body}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <TicketAction settings={settings} />
            </div>
          </div>

          <aside aria-label="Ticket terms" className="self-end md:col-span-5">
            <ul data-reveal="stagger" className="border-t border-white/15">
              <li className="grid grid-cols-[3.5rem_1fr] gap-2 border-b border-white/15 py-5">
                <ClauseNo>5.1</ClauseNo>
                <span className="text-mute">Capacity is limited to 100 guests.</span>
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
              <li className="grid grid-cols-[3.5rem_1fr] gap-2 border-b border-white/15 py-5">
                <ClauseNo>5.4</ClauseNo>
                <span className="text-mute">
                  Questions about access or seating? See the{' '}
                  <a href="#faq" className="text-white underline underline-offset-4 hover:text-mute">
                    FAQ
                  </a>
                  .
                </span>
              </li>
            </ul>
          </aside>
        </div>

        {showEmbed ? <TicketEmbed src={settings.ticketEmbedUrl} eventName={settings.eventName} /> : null}

        {settings.sections.showSpeakerApplications ? <SpeakerApplications settings={settings} /> : null}
      </div>
    </SectionShell>
  );
}
