import type { Settings } from '@/lib/content';
import { formatCoordinate } from '@/lib/links';
import { seatsLabel } from '@/lib/site';
import { TextLink } from '@/components/ui/TextLink';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { keepTedxCase } from '@/components/ui/KeepCase';
import { ClauseNo, CropMarks, Tba } from '@/components/print/Print';
import { VenueMotion } from '@/motion/sections/VenueMotion';
import { SectionShell, SectionTitle } from './SectionShell';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** A surveyor's reticle: concentric rings, degree ticks, a single red point. Decorative. */
function Reticle() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg viewBox="0 0 320 320" aria-hidden="true" data-reticle className="block size-full" fill="none">
      <g stroke="currentColor" className="text-white/20" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <circle cx="160" cy="160" r="150" />
        <circle cx="160" cy="160" r="104" strokeDasharray="2 6" />
        <circle cx="160" cy="160" r="52" />
        <path d="M160 0v118M160 202v118M0 160h118M202 160h118" />
      </g>
      <g stroke="currentColor" className="text-white/40" strokeWidth="1" data-reticle-bezel>
        {ticks.map((deg) => {
          const long = deg % 45 === 0;
          const r1 = 150;
          const r2 = long ? 136 : 144;
          const a = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={160 + r1 * Math.sin(a)}
              y1={160 - r1 * Math.cos(a)}
              x2={160 + r2 * Math.sin(a)}
              y2={160 - r2 * Math.cos(a)}
            />
          );
        })}
      </g>
      {/* Cardinal letters sit inside the bezel (its long ticks run r 136-150),
          centred on their axis, and knock the crosshair out behind them with a
          black stroke painted under the fill. */}
      <g
        className="fill-white/75"
        stroke="#000"
        strokeWidth="5"
        paintOrder="stroke"
        dominantBaseline="central"
        textAnchor="middle"
        style={{ font: '9px ui-monospace, monospace' }}
      >
        <text x="160" y="124">N</text>
        <text x="196" y="160">E</text>
        <text x="160" y="196">S</text>
        <text x="124" y="160">W</text>
      </g>
      <circle cx="160" cy="160" r="14" stroke="var(--color-accent)" strokeWidth="1" />
      <circle cx="160" cy="160" r="4" fill="var(--color-accent)" />
    </svg>
  );
}

export function Venue({ settings }: { settings: Settings }) {
  const coords = settings.venueCoordinates;
  const notes = settings.venueNotes;
  const anyNote = notes.some((n) => n.body);
  const a = settings.venuePostalAddress;
  const cityLine = [a.city, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const mapLink = settings.mapUrl ? (
    <TextLink href={settings.mapUrl} className="mt-2">
      Open in Maps<span className="sr-only">: {settings.venueName}</span>
    </TextLink>
  ) : null;

  return (
    <SectionShell id="venue" scrim="left" className="py-24 sm:py-36">
      <VenueMotion />
      <div className="shell">
        <div className="grid gap-16 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7 lg:col-span-8">
            <div data-reveal="fade">
              <SectionLabel index={4}>Venue</SectionLabel>
            </div>
            <SectionTitle id="venue" className="max-w-[12ch]">
              <span data-reveal="lines" className="block">
                {settings.venueName}
              </span>
            </SectionTitle>
            {settings.venueCampus ? (
              <p data-reveal="fade" data-reveal-delay="0.2" className="mt-6 text-title font-medium tracking-tight text-mute">
                {settings.venueCampus}
              </p>
            ) : null}
          </div>

          {/* Coordinate plate: a proof with crop marks, on its own near-solid ground so it never depends on the canvas. */}
          <figure
            data-venue-plate
            className="relative mx-auto w-full max-w-sm bg-black/80 p-6 sm:p-7 md:col-span-5 md:mx-0 md:ml-auto lg:col-span-4"
          >
            <CropMarks />
            <div className="flex items-baseline justify-between gap-4">
              <span className="fine-print text-white">Location</span>
              {settings.venueCampus ? (
                <span className="fine-print text-right text-mute">{keepTedxCase(settings.venueCampus)}</span>
              ) : null}
            </div>
            <div className="mx-auto mt-5 aspect-square w-full max-w-[15rem]">
              <Reticle />
            </div>
            <figcaption className="mt-6 border-t border-white/15 pt-5">
              {coords ? (
                <>
                  <p className="font-mono text-[1.375rem] leading-[1.25] tracking-[-0.02em] text-white tabular-nums sm:text-2xl">
                    <span data-venue-coord className="block">{formatCoordinate(coords.lat, 'lat')}</span>
                    <span data-venue-coord className="block">{formatCoordinate(coords.lng, 'lng')}</span>
                  </p>
                  {coords.note ? (
                    <p data-cursor="loupe" className="fine-print mt-3 text-mute">
                      {keepTedxCase(coords.note)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="font-mono text-lg tracking-tight text-white">{cityLine || settings.venueCampus}</p>
              )}
            </figcaption>
          </figure>
        </div>

        {/* Particulars. Clause numbers sit inside each <dt> (hidden from assistive tech) so the list stays valid. */}
        <div data-reveal="rule" className="mt-16 h-px bg-white/15 sm:mt-20" aria-hidden="true" />
        <dl data-reveal="stagger" className={`grid gap-10 pt-8 sm:gap-8 ${anyNote ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
          <div className="grid grid-cols-[3.5rem_1fr] content-start gap-x-2">
            <dt className="col-span-2 grid grid-cols-subgrid">
              <ClauseNo>4.1</ClauseNo>
              <span className="fine-print text-mute">Where</span>
            </dt>
            <dd className="col-start-2 mt-3">
              <address className="not-italic leading-relaxed text-mute">
                <span className="block text-xl tracking-tight text-white">{settings.venueName}</span>
                {settings.venueCampus ? <span className="mt-2 block">{settings.venueCampus}</span> : null}
                {a.street ? <span className="block">{a.street}</span> : null}
                {cityLine ? <span className="block">{cityLine}</span> : null}
              </address>
              {settings.venueAddressLabel ? (
                <span data-cursor="loupe" className="fine-print mt-3 block text-subtle">
                  {keepTedxCase(settings.venueAddressLabel)}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="grid grid-cols-[3.5rem_1fr] content-start gap-x-2">
            <dt className="col-span-2 grid grid-cols-subgrid">
              <ClauseNo>4.2</ClauseNo>
              <span className="fine-print text-mute">When</span>
            </dt>
            <dd className="col-start-2 mt-3 leading-relaxed text-white">
              <time dateTime={settings.dateISO} className="block text-xl tracking-tight">
                {settings.dateLong}
              </time>
              <span className="mt-2 block text-mute">
                Doors: {settings.doorsTime ? settings.doorsTime : <Tba />}
              </span>
              {settings.endTime ? <span className="block text-mute">Ends: {settings.endTime}</span> : null}
            </dd>
          </div>
          <div className="grid grid-cols-[3.5rem_1fr] content-start gap-x-2">
            <dt className="col-span-2 grid grid-cols-subgrid">
              <ClauseNo>4.3</ClauseNo>
              <span className="fine-print text-mute">Capacity</span>
            </dt>
            <dd className="col-start-2 mt-3 leading-relaxed text-white">
              <span className="block text-xl tracking-tight tabular-nums">{seatsLabel(settings.capacity)}</span>
            </dd>
          </div>
          {/* Until the notes are written, "Getting there" is one more particular (the
              map link and a line saying what will follow), not a block of its own. */}
          {anyNote ? null : (
            <div className="grid grid-cols-[3.5rem_1fr] content-start gap-x-2">
              <dt className="col-span-2 grid grid-cols-subgrid">
                <ClauseNo>4.4</ClauseNo>
                <span className="fine-print text-mute">Getting there</span>
              </dt>
              <dd className="col-start-2 mt-3 leading-relaxed text-mute">
                <span className="block">Directions, parking and accessibility notes to follow.</span>
                {mapLink}
              </dd>
            </div>
          )}
        </dl>

        {/* Getting there, once the notes are written: directions, parking, access. */}
        {anyNote ? (
          <div className="mt-16 grid gap-10 md:mt-20 md:grid-cols-12">
            <div className="md:col-span-4">
              <h3 data-reveal="fade" className="flex items-baseline gap-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                <ClauseNo>4.4</ClauseNo>
                Getting there
              </h3>
              <p data-reveal="fade" className="mt-4 max-w-xs text-mute">
                Directions, parking and access, in that order.
              </p>
              {mapLink ? <div className="mt-6">{mapLink}</div> : null}
            </div>
            <ol data-reveal="stagger" className="border-t border-white/15 md:col-span-8">
              {notes.map((n, i) => (
                <li
                  key={`${n.title}-${i}`}
                  className={`grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 gap-y-3 border-b border-white/15 sm:grid-cols-[3.5rem_11rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-6 ${n.body ? 'py-7' : 'py-5'}`}
                >
                  <span aria-hidden="true" className="fine-print text-white">
                    ({LETTERS[i] ?? i + 1})
                  </span>
                  <h4 className="text-lg font-semibold tracking-tight">{n.title}</h4>
                  <div className="col-start-2 leading-relaxed text-mute sm:col-start-auto">
                    {n.body ? <p className="whitespace-pre-line">{n.body}</p> : <Tba />}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}
