import type { CSSProperties, ReactNode } from 'react';
import type { Settings, TicketState } from '@/lib/content';
import { getFaq } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { WatchLive } from '@/components/ui/WatchLive';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ClauseNo, StatusRegister } from '@/components/print/Print';
import { TicketsMotion } from '@/motion/sections/TicketsMotion';
import { SectionShell, SectionTitle } from './SectionShell';

const TICKET_OPTIONS = [
  { value: 'coming-soon', label: 'Coming soon' },
  { value: 'on-sale', label: 'On sale' },
  { value: 'sold-out', label: 'Sold out' },
  { value: 'closed', label: 'Closed' },
] as const satisfies readonly { value: TicketState; label: string }[];

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
    body: 'To everyone who will be in the room: see you there. Talks are recorded and submitted for publication on the TEDx Talks YouTube channel.',
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

export async function Tickets({ settings }: { settings: Settings }) {
  // Only point at the FAQ when that section is actually rendered.
  const faq = await getFaq();
  const showFaq = settings.sections.showFaq && faq.length > 0;
  const state = settings.ticketState;
  const copy = COPY[state];
  const showEmbed = state === 'on-sale' && Boolean(settings.ticketEmbedUrl);
  const seats = settings.capacity;
  // Plain facts, numbered as clauses (no gaps when one is not set).
  const details: ReactNode[] = [
    `Limited to ${seats} guests.`,
    settings.ticketPriceNote || null,
    <>
      <time dateTime={settings.dateISO}>{settings.dateLong}</time>, at the {settings.venueName}.
    </>,
    showFaq ? (
      <>
        Questions about access or seating? See the <a href="#faq">FAQ</a>.
      </>
    ) : null,
  ].filter(Boolean);

  return (
    <SectionShell id="tickets" className="py-24 sm:py-36">
      <TicketsMotion />
      <div className="shell">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div data-reveal="fade">
            <SectionLabel index={5}>Tickets</SectionLabel>
          </div>
          <StatusRegister label="Ticket status" options={TICKET_OPTIONS} value={state} />
        </div>

        <div className="mt-10 grid gap-12 sm:mt-14 md:grid-cols-12">
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

          <aside aria-label="Ticket details" className="self-end md:col-span-5">
            <ul data-reveal="stagger" className="border-t border-white/15">
              {details.map((d, i) => (
                <li key={i} className="grid grid-cols-[3.5rem_1fr] gap-2 border-b border-white/15 py-5">
                  <ClauseNo>5.{i + 1}</ClauseNo>
                  <span className="text-mute">{d}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {showEmbed ? <TicketEmbed src={settings.ticketEmbedUrl} eventName={settings.eventName} /> : null}

        {/* The room as a figure: the seat counter and one tick per seat. Decorative. */}
        <div className="mt-20 sm:mt-28">
          {/* Sized to the container so the numerals span the full measure, like the ruler beneath. */}
          <div className="@container">
          <p
            aria-hidden="true"
            className="-ml-[0.04em] leading-[0.82] font-semibold tracking-[-0.06em] whitespace-nowrap tabular-nums"
            style={{ fontSize: 'calc(100cqi / 4.8)' }}
          >
            {pad(1)}
            {/* Clear air on both sides: tabular "1" sits centred in a wide advance,
                and the tight tracking pulls the bar toward it. */}
            <span data-seat-dash className="mx-[0.24em] inline-block h-[0.035em] w-[0.62em] bg-white/50 align-middle" />
            <span data-seat-count>{pad(seats)}</span>
          </p>
          </div>
          <div className="mt-8 sm:mt-12">
            <SeatStrip seats={seats} filled={state === 'sold-out'} />
          </div>
          {/* Caption for the decorative strip; the heading and clause 5.1 carry the capacity. */}
          <div aria-hidden="true" className="mt-12 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className="fine-print text-mute">One tick per seat</span>
            <span data-cursor="loupe" className="fine-print text-mute">
              Seat {seats}. That is the whole room.
            </span>
          </div>
        </div>

      </div>
    </SectionShell>
  );
}
