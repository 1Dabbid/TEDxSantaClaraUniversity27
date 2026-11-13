import type { Metadata } from 'next';
import type { Settings, VenueNote } from '@/lib/content';
import { getSettings } from '@/lib/content';
import { jsonLdString, pageJsonLd, venuePlaceJsonLd } from '@/lib/jsonld';
import { formatCoordinate } from '@/lib/links';
import { slugIds } from '@/lib/faq-ids';
import { topicPageMetadata } from '@/lib/page-meta';
import { SITE_NAME, seatsLabel, venueLine } from '@/lib/site';
import { Button } from '@/components/ui/Button';
import { keepTedxCase } from '@/components/ui/KeepCase';
import { Arrow, ClauseNo, CropMarks, JsonLd, Tba } from '@/components/print/Print';
import { Reticle } from '@/components/sections/Venue';
import { TicketsClosingBand } from '@/components/pages/ClosingBand';
import { PageHeader, TopicPage, timeFacts } from '@/components/pages/PageHeader';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return topicPageMetadata({
    title: 'Venue',
    description: `How to get to ${SITE_NAME}: ${venueLine(s)}, ${[s.venuePostalAddress.street, s.venuePostalAddress.city].filter(Boolean).join(', ')}. ${s.dateLong}. Address, map, directions, parking and accessibility.`,
    path: '/venue',
  });
}

/** Used when the editors have removed every "Getting there" note: the three the page is built around. */
const DEFAULT_NOTES: VenueNote[] = [
  { title: 'Directions', body: '' },
  { title: 'Parking', body: '' },
  { title: 'Accessibility', body: '' },
];

type Kind = 'directions' | 'parking' | 'access' | 'other';
const kindOf = (title: string): Kind =>
  /direction|getting/i.test(title) ? 'directions' : /park/i.test(title) ? 'parking' : /access/i.test(title) ? 'access' : 'other';

/** Ids /venue itself renders: a note's anchor never takes one of them (lib/faq-ids.ts slugIds uniques the rest). */
const VENUE_IDS: ReadonlySet<string> = new Set([
  'main',
  'site-footer',
  'venue-page-title',
  'venue-address-title',
  'getting-there-title',
  'next-title',
  'footer-tedx',
  'footer-ted',
  'footer-site',
]);

/** "Directions, parking and accessibility" */
function listOf(titles: string[]): string {
  const t = titles.map((x, i) => (i === 0 ? x : x.toLowerCase()));
  return t.length <= 1 ? (t[0] ?? '') : `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}`;
}

function cityLineOf(s: Settings) {
  const a = s.venuePostalAddress;
  return [a.city, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/**
 * What a "Getting there" clause shows while its notes are blank: something true
 * and useful where the content has it (the address and map for directions, the
 * contact address for access needs), otherwise one quiet marker. The one line
 * saying details are coming sits above the list, once.
 */
function Pending({ kind, settings }: { kind: Kind; settings: Settings }) {
  const a = settings.venuePostalAddress;
  if (kind === 'directions' && (a.street || settings.mapUrl)) {
    return (
      <p>
        {a.street ? (
          <>
            Until then, use the address: {[a.street, cityLineOf(settings)].filter(Boolean).join(', ')}.
          </>
        ) : null}
        {settings.mapUrl ? (
          <>
            {' '}
            <a href={settings.mapUrl} target="_blank" rel="noopener noreferrer">
              Open it in Maps
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </>
        ) : null}
      </p>
    );
  }
  if (kind === 'access' && settings.contactEmail) {
    return (
      <p className="[overflow-wrap:anywhere]">
        Accessibility needs or questions:{' '}
        <a href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent(`Accessibility · ${settings.eventName}`)}`}>
          {settings.contactEmail}
        </a>
        . The team will do its best to accommodate you.
      </p>
    );
  }
  return <Tba>Details to follow</Tba>;
}

function CoordinatePlate({ settings }: { settings: Settings }) {
  const coords = settings.venueCoordinates;
  return (
    <figure className="relative mx-auto w-full max-w-sm bg-black p-6 sm:p-7 md:mx-0 md:ml-auto">
      <CropMarks />
      <div className="flex items-baseline justify-between gap-4">
        <span className="fine-print text-white">Location</span>
        {settings.venueCampus ? <span className="fine-print text-right text-mute">{keepTedxCase(settings.venueCampus)}</span> : null}
      </div>
      <div className="mx-auto mt-5 aspect-square w-full max-w-[15rem]">
        <Reticle />
      </div>
      <figcaption className="mt-6 border-t border-white/15 pt-5">
        {coords ? (
          <>
            <p className="font-mono text-[1.375rem] leading-[1.25] tracking-[-0.02em] text-white tabular-nums sm:text-2xl">
              <span className="block">{formatCoordinate(coords.lat, 'lat')}</span>
              <span className="block">{formatCoordinate(coords.lng, 'lng')}</span>
            </p>
            {coords.note ? <p className="fine-print mt-3 text-mute">{keepTedxCase(coords.note)}</p> : null}
          </>
        ) : (
          <p className="font-mono text-lg tracking-tight text-white">{cityLineOf(settings) || settings.venueCampus}</p>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * /venue: everything needed to get there. The street address and a large map
 * action in the page header, the address block and coordinate plate below, then Directions, Parking and
 * Accessibility as clauses that show the editors' notes, or something true and
 * useful while those are blank, never three identical placeholders.
 */
export default async function VenuePage() {
  const settings = await getSettings();
  const a = settings.venuePostalAddress;
  const cityLine = cityLineOf(settings);
  const addressLine = [a.street, cityLine].filter(Boolean).join(', ');
  const notes = settings.venueNotes.length ? settings.venueNotes : DEFAULT_NOTES;
  const pending = notes.filter((n) => !n.body).map((n) => n.title);
  const noteIds = slugIds(
    notes.map((n) => n.title),
    VENUE_IDS,
    'note',
  );

  return (
    <TopicPage>
      <JsonLd
        json={jsonLdString(
          pageJsonLd(
            [
              { name: 'Home', path: '/' },
              { name: 'Venue', path: '/venue' },
            ],
            venuePlaceJsonLd(settings),
          ),
        )}
      />
      <section aria-labelledby="venue-page-title">
        <PageHeader
          settings={settings}
          label="Venue"
          titleId="venue-page-title"
          title={settings.venueName}
          intro={
            <>
              Where {settings.eventName} takes place{settings.venueCampus ? `, on the ${settings.venueCampus} campus` : ''}
              {addressLine ? (
                <>
                  : <span className="text-white">{addressLine}</span>
                </>
              ) : null}
              .
            </>
          }
          facts={[
            { k: 'Date', v: <time dateTime={settings.dateISO}>{settings.dateLong}</time> },
            ...timeFacts(settings),
          ]}
        >
          {/* The address (in the intro) and the map come first: they are why most visitors open this page. */}
          {settings.mapUrl ? (
            <Button href={settings.mapUrl} size="lg" className="w-full sm:w-auto sm:min-w-72">
              Open in Maps
              <span className="sr-only">: {venueLine(settings)}</span>
              <Arrow
                dir="up-right"
                className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Button>
          ) : null}
        </PageHeader>
      </section>

      {/* Address, map, coordinates */}
      <section aria-labelledby="venue-address-title" className="shell pb-20 sm:pb-28">
        <div className="grid gap-14 md:grid-cols-12 md:items-start">
          <div className="md:col-span-7">
            <h2 id="venue-address-title" className="flex items-baseline gap-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              <ClauseNo>1</ClauseNo>
              Address
            </h2>
            {/* The venue name is the page title; the block keeps campus, street and city beside the plate. */}
            <address className="mt-8 not-italic">
              <span className="block text-lg leading-relaxed text-mute sm:text-xl">
                {settings.venueCampus ? <span className="block text-white">{settings.venueCampus}</span> : null}
                {a.street ? <span className="block">{a.street}</span> : null}
                {cityLine ? <span className="block">{cityLine}</span> : null}
              </span>
            </address>
            {settings.venueAddressLabel ? (
              <p className="fine-print mt-4 text-subtle">{keepTedxCase(settings.venueAddressLabel)}</p>
            ) : null}
            <p className="mt-6 text-mute">
              Capacity: <span className="text-white tabular-nums">{seatsLabel(settings.capacity)}</span>
            </p>
          </div>
          <div className="md:col-span-5">
            <CoordinatePlate settings={settings} />
          </div>
        </div>
      </section>

      {/* Getting there */}
      <section aria-labelledby="getting-there-title" className="shell pb-24 sm:pb-32">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="getting-there-title" className="flex items-baseline gap-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              <ClauseNo>2</ClauseNo>
              Getting there
            </h2>
            <p className="mt-4 max-w-xs text-mute">
              {pending.length
                ? `${listOf(pending)} details will be published here before the event.`
                : 'Directions, parking and access, in that order.'}
            </p>
          </div>
          <ol className="border-t border-white/15 md:col-span-8">
            {notes.map((n, i) => (
              <li
                key={`${n.title}-${i}`}
                id={noteIds[i]}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 gap-y-3 border-b border-white/15 py-7 sm:grid-cols-[3.5rem_11rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-6"
              >
                <span aria-hidden="true" className="fine-print text-white">
                  ({'abcdefghijklmnopqrstuvwxyz'[i] ?? i + 1})
                </span>
                <h3 className="text-lg font-semibold tracking-tight">{n.title}</h3>
                <div className="col-start-2 leading-relaxed text-mute sm:col-start-auto">
                  {n.body ? <p className="whitespace-pre-line">{n.body}</p> : <Pending kind={kindOf(n.title)} settings={settings} />}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <TicketsClosingBand current="/venue" settings={settings} />
    </TopicPage>
  );
}
