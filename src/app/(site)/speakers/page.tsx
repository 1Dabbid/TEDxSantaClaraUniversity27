import type { Metadata } from 'next';
import { getSettings, getSpeakers } from '@/lib/content';
import { jsonLdString, pageJsonLd } from '@/lib/jsonld';
import { isIndexable, SITE_NAME, seatsLabel, venueLine } from '@/lib/site';
import { ticketCta } from '@/lib/tickets';
import { SpeakerCard, SpeakersToCome } from '@/components/sections/Speakers';
import { Button } from '@/components/ui/Button';
import { JsonLd } from '@/components/print/Print';
import { ClosingBand } from '@/components/pages/ClosingBand';
import { PageHeader, TopicPage } from '@/components/pages/PageHeader';

export async function generateMetadata(): Promise<Metadata> {
  const [s, speakers] = await Promise.all([getSettings(), getSpeakers()]);
  const anyAnnounced = speakers.some((sp) => sp.announced);
  const description = anyAnnounced
    ? `The speakers of ${SITE_NAME}: ${s.themeName}, ${s.dateLong}, ${s.venueName}.`
    : `Speakers for ${SITE_NAME}: ${s.themeName} are to be announced. ${s.dateLong}, ${s.venueName}.`;
  return {
    title: 'Speakers',
    description,
    alternates: { canonical: '/speakers' },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: `${SITE_NAME} · Speakers`,
      description,
      url: '/speakers',
      locale: 'en_US',
    },
    twitter: { card: 'summary_large_image', title: `${SITE_NAME} · Speakers`, description },
    // A list of placeholders is not worth indexing: only once a speaker is announced.
    ...(anyAnnounced && isIndexable() ? {} : { robots: { index: false, follow: true } }),
  };
}

/**
 * Every announced speaker on one page, numbered as on the home page, then one
 * card for the slots still to come. Until the first announcement it is a short
 * "to be announced" page with the one useful action.
 */
export default async function SpeakersPage() {
  const [settings, speakers] = await Promise.all([getSettings(), getSpeakers()]);
  const numbered = speakers.map((speaker, index) => ({ speaker, index }));
  const announced = numbered.filter((x) => x.speaker.announced);
  const anyAnnounced = announced.length > 0;
  const cta = ticketCta(settings);

  return (
    <TopicPage>
      <JsonLd
        json={jsonLdString(
          pageJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Speakers', path: '/speakers' },
          ]),
        )}
      />
      <section aria-labelledby="speakers-index-title">
        <PageHeader
          settings={settings}
          label="Speakers"
          titleId="speakers-index-title"
          title={anyAnnounced ? 'Speakers' : settings.copy.speakersEmptyHeading}
          intro={
            anyAnnounced
              ? `Live talks at the ${settings.venueName}, recorded and submitted for publication on the TEDx Talks YouTube channel.`
              : 'The lineup is announced on this page and to the mailing list first.'
          }
          facts={[
            { k: 'Date', v: <time dateTime={settings.dateISO}>{settings.dateLong}</time> },
            { k: 'Venue', v: venueLine(settings) },
            // Before any is announced the title already says so: no second "to be announced".
            ...(anyAnnounced ? [{ k: 'Speakers', v: `${announced.length} announced` }] : []),
          ]}
        >
          {anyAnnounced ? null : (
            <Button href={settings.newsletterUrl || '/#newsletter'} size="lg">
              Join the mailing list
            </Button>
          )}
        </PageHeader>
        {anyAnnounced ? (
          <div className="shell pb-24 sm:pb-32">
            <ul aria-label="Speakers" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {announced.map(({ speaker, index }) => (
                <SpeakerCard key={speaker.slug} speaker={speaker} index={index} level={2} />
              ))}
              <SpeakersToCome count={speakers.length - announced.length} />
            </ul>
          </div>
        ) : null}
      </section>

      <ClosingBand
        current="/speakers"
        heading={`One evening, ${seatsLabel(settings.capacity)}.`}
        body={settings.ticketPriceNote || undefined}
        action={{ label: 'Tickets', href: cta.href, ariaLabel: cta.ariaLabel }}
      />
    </TopicPage>
  );
}
