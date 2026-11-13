import type { Settings } from '@/lib/content';
import { formatCoordinate } from '@/lib/links';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ClauseNo, Tba } from '@/components/print/Print';
import { SectionShell, SectionTitle } from './SectionShell';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** A surveyor's reticle: concentric rings, degree ticks, a single red point. Decorative. */
function Reticle() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg viewBox="0 0 320 320" aria-hidden="true" className="block size-full" fill="none">
      <g stroke="currentColor" className="text-white/20" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <circle cx="160" cy="160" r="150" />
        <circle cx="160" cy="160" r="104" strokeDasharray="2 6" />
        <circle cx="160" cy="160" r="52" />
        <path d="M160 0v118M160 202v118M0 160h118M202 160h118" />
      </g>
      <g stroke="currentColor" className="text-white/40" strokeWidth="1">
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
      <g className="fill-white/60" style={{ font: '9px ui-monospace, monospace', letterSpacing: '0.12em' }}>
        <text x="160" y="28" textAnchor="middle">N</text>
        <text x="296" y="163" textAnchor="middle">E</text>
        <text x="160" y="300" textAnchor="middle">S</text>
        <text x="24" y="163" textAnchor="middle">W</text>
      </g>
      <circle cx="160" cy="160" r="14" stroke="var(--color-accent)" strokeWidth="1" />
      <circle cx="160" cy="160" r="4" fill="var(--color-accent)" />
    </svg>
  );
}

export function Venue({ settings }: { settings: Settings }) {
  const coords = settings.venueCoordinates;
  const notes = settings.venueNotes;
  const a = settings.venuePostalAddress;
  const cityLine = [a.city, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return (
    <SectionShell id="venue" scrim="left" className="py-32 sm:py-44">
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

          {/* Coordinate plate. Sits on its own near-solid panel so it never depends on the canvas. */}
          <figure
            data-reveal="fade"
            className="relative mx-auto w-full max-w-sm border border-white/10 bg-black/85 p-6 md:col-span-5 md:mx-0 md:ml-auto lg:col-span-4"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="fine-print">Fig. 4</span>
              <span className="fine-print text-right">Site plan, not to scale</span>
            </div>
            <div className="mx-auto mt-4 aspect-square w-full max-w-[16rem]">
              <Reticle />
            </div>
            <figcaption className="mt-5 border-t border-white/10 pt-4">
              {coords ? (
                <>
                  <p className="font-mono text-lg tracking-tight text-white tabular-nums sm:text-xl">
                    {formatCoordinate(coords.lat, 'lat')}
                    <br />
                    {formatCoordinate(coords.lng, 'lng')}
                  </p>
                  {coords.note ? (
                    <p data-cursor="loupe" className="fine-print mt-2">
                      {coords.note}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="font-mono text-lg tracking-tight text-white">{cityLine || settings.venueCampus}</p>
              )}
            </figcaption>
          </figure>
        </div>

        {/* Particulars */}
        <div data-reveal="rule" className="mt-20 h-px bg-white/15 sm:mt-28" aria-hidden="true" />
        <dl data-reveal="stagger" className="grid gap-10 pt-8 sm:grid-cols-3 sm:gap-8">
          <div className="grid grid-cols-[3.5rem_1fr] gap-2">
            <ClauseNo>4.1</ClauseNo>
            <div>
              <dt className="fine-print">Where</dt>
              <dd className="mt-3">
                {settings.venueAddressLabel ? (
                  <span data-cursor="loupe" className="fine-print mb-2 block text-mute">
                    {settings.venueAddressLabel}
                  </span>
                ) : null}
                <address className="not-italic leading-relaxed text-white">
                  {settings.venueName}
                  {settings.venueCampus ? (
                    <>
                      <br />
                      {settings.venueCampus}
                    </>
                  ) : null}
                  {a.street ? (
                    <>
                      <br />
                      {a.street}
                    </>
                  ) : null}
                  {cityLine ? (
                    <>
                      <br />
                      {cityLine}
                    </>
                  ) : null}
                </address>
              </dd>
            </div>
          </div>
          <div className="grid grid-cols-[3.5rem_1fr] gap-2">
            <ClauseNo>4.2</ClauseNo>
            <div>
              <dt className="fine-print">When</dt>
              <dd className="mt-3 leading-relaxed text-white">
                <time dateTime={settings.dateISO}>{settings.dateLong}</time>
                <span className="mt-1 block text-mute">
                  Doors: {settings.doorsTime ? settings.doorsTime : <Tba />}
                </span>
                {settings.endTime ? <span className="block text-mute">Ends: {settings.endTime}</span> : null}
              </dd>
            </div>
          </div>
          <div className="grid grid-cols-[3.5rem_1fr] gap-2">
            <ClauseNo>4.3</ClauseNo>
            <div>
              <dt className="fine-print">Capacity</dt>
              <dd className="mt-3 leading-relaxed text-white">
                100 seats
                <span className="block text-mute">One room, one evening.</span>
              </dd>
            </div>
          </div>
        </dl>

        {/* Getting there */}
        <div className="mt-20 grid gap-10 md:mt-28 md:grid-cols-12">
          <div className="md:col-span-4">
            <h3 data-reveal="fade" className="flex items-baseline gap-4 text-2xl font-semibold tracking-tight">
              <ClauseNo>4.4</ClauseNo>
              Getting there
            </h3>
            <p data-reveal="fade" className="mt-4 max-w-xs text-mute">
              Directions, parking and access, in that order. Anything still blank will be filled in before the event.
            </p>
            {settings.mapUrl ? (
              <div className="mt-8">
                <Button href={settings.mapUrl} variant="ghost">
                  Open in Maps
                  <span className="sr-only">: {settings.venueName}</span>
                  <span aria-hidden="true">↗</span>
                </Button>
              </div>
            ) : null}
          </div>

          {notes.length ? (
            <ol data-reveal="stagger" className="border-t border-white/15 md:col-span-8">
              {notes.map((n, i) => (
                <li
                  key={`${n.title}-${i}`}
                  className="grid gap-3 border-b border-white/15 py-7 sm:grid-cols-[4rem_12rem_1fr] sm:gap-6"
                >
                  <span aria-hidden="true" className="fine-print text-white">
                    ({LETTERS[i] ?? i + 1})
                  </span>
                  <h4 className="text-lg font-semibold tracking-tight">{n.title}</h4>
                  <div className="leading-relaxed text-mute">
                    {n.body ? (
                      <p className="whitespace-pre-line">{n.body}</p>
                    ) : (
                      <p>
                        <Tba />
                        <span className="mt-2 block text-sm text-subtle">Details will be published here before the event.</span>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-t border-white/15 pt-7 text-mute md:col-span-8">
              <Tba>Arrival details to be announced</Tba>
            </p>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
