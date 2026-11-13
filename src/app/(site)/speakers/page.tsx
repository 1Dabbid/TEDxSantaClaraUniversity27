import type { Metadata } from 'next';
import Link from 'next/link';
import { getSettings, getSpeakers } from '@/lib/content';
import { isIndexable, SITE_NAME } from '@/lib/site';
import { SpeakerCard, SpeakersToCome } from '@/components/sections/Speakers';
import { Button } from '@/components/ui/Button';

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

  return (
    <section aria-labelledby="speakers-index-title" className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/85" />
      <div className="shell pt-12 pb-28 sm:pt-16 sm:pb-36">
        <nav aria-label="Breadcrumb" className="fine-print text-mute">
          <ol className="-my-1.5 flex flex-wrap items-center gap-x-2">
            <li>
              <Link href="/" className="inline-block py-1.5 hover:text-white">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-white">
              Speakers
            </li>
          </ol>
        </nav>
        <p className="fine-print mt-16 text-mute sm:mt-24">
          {/* The event name is never uppercased. */}
          <span className="tracking-normal normal-case text-white">{SITE_NAME}</span> · {settings.themeName} · <time dateTime={settings.dateISO}>{settings.dateLong}</time>
        </p>
        <h1
          id="speakers-index-title"
          data-reveal="lines"
          className="mt-6 text-[clamp(3.25rem,9.6vw,8.75rem)] leading-[0.86] font-semibold tracking-[-0.06em] text-balance"
        >
          {anyAnnounced ? 'Speakers' : settings.copy.speakersEmptyHeading}
        </h1>
        {anyAnnounced ? (
          <ul aria-label="Speakers" className="mt-14 grid grid-cols-1 gap-3 sm:mt-16 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {announced.map(({ speaker, index }) => (
              <SpeakerCard key={speaker.slug} speaker={speaker} index={index} level={2} />
            ))}
            <SpeakersToCome count={speakers.length - announced.length} />
          </ul>
        ) : (
          <div className="mt-10 max-w-xl">
            <p className="text-lg text-mute sm:text-xl">
              The lineup is announced on this page and to the mailing list first.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button href={settings.newsletterUrl || '/#newsletter'} size="lg">
                Join the mailing list
              </Button>
              <Button href="/" variant="ghost" size="lg">
                Back to the event
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
