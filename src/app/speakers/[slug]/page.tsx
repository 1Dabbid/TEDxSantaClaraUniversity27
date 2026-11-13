import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Settings, Speaker } from '@/lib/content';
import { getSettings, getSpeakers, paragraphs } from '@/lib/content';
import { jsonLdString, speakerJsonLd } from '@/lib/jsonld';
import { SITE_NAME } from '@/lib/site';
import { ticketCta } from '@/lib/tickets';
import { Button } from '@/components/ui/Button';
import { ClauseNo, JsonLd, Redaction } from '@/components/print/Print';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const speakers = await getSpeakers();
  return speakers.map((s) => ({ slug: s.slug }));
}

const num = (i: number) => `Nº ${String(i + 1).padStart(2, '0')}`;

async function load(slug: string) {
  const speakers = await getSpeakers();
  const index = speakers.findIndex((s) => s.slug === slug);
  if (index === -1) return null;
  return {
    speaker: speakers[index],
    index,
    prev: index > 0 ? { s: speakers[index - 1], i: index - 1 } : null,
    next: index < speakers.length - 1 ? { s: speakers[index + 1], i: index + 1 } : null,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return {};
  const { speaker, index } = data;
  const title = speaker.announced ? speaker.name : `Speaker ${num(index)}: to be announced`;
  const description = speaker.announced
    ? speaker.shortBio || `${speaker.name} speaks at ${SITE_NAME}.`
    : `This ${SITE_NAME} speaker has not been announced yet.`;
  return {
    title,
    description,
    alternates: { canonical: `/speakers/${slug}` },
    openGraph: {
      type: speaker.announced ? 'profile' : 'website',
      siteName: SITE_NAME,
      title: `${title} · ${SITE_NAME}`,
      description,
      url: `/speakers/${slug}`,
      locale: 'en_US',
    },
    // Placeholder pages exist so links never 404, but should not be indexed.
    robots: speaker.announced ? undefined : { index: false, follow: true },
  };
}

function SpeakerNav({ prev, next }: { prev: { s: Speaker; i: number } | null; next: { s: Speaker; i: number } | null }) {
  const label = (s: Speaker) => (s.announced ? s.name : 'To be announced');
  return (
    <nav aria-label="More speakers" className="shell pb-28 sm:pb-36">
      <div className="grid border-t border-white/15 sm:grid-cols-[1fr_auto_1fr]">
        <div className="border-b border-white/15 sm:border-b-0">
          {prev ? (
            <Link href={`/speakers/${prev.s.slug}`} data-cursor="link" className="group block py-8 sm:pr-8">
              <span className="fine-print">← Previous · {num(prev.i)}</span>
              <span className="mt-3 block text-2xl font-semibold tracking-tight group-hover:text-mute sm:text-3xl">
                <span className="sr-only">Previous speaker: </span>
                {label(prev.s)}
              </span>
            </Link>
          ) : null}
        </div>
        <div className="flex items-center border-b border-white/15 py-6 sm:border-x sm:border-b-0 sm:px-8">
          <Link href="/#speakers" className="fine-print text-white underline-offset-4 hover:underline">
            All speakers
          </Link>
        </div>
        <div>
          {next ? (
            <Link href={`/speakers/${next.s.slug}`} data-cursor="link" className="group block py-8 text-right sm:pl-8">
              <span className="fine-print">{num(next.i)} · Next →</span>
              <span className="mt-3 block text-2xl font-semibold tracking-tight group-hover:text-mute sm:text-3xl">
                <span className="sr-only">Next speaker: </span>
                {label(next.s)}
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

function Breadcrumb({ index }: { index: number }) {
  return (
    <nav aria-label="Breadcrumb" className="fine-print">
      <ol className="flex flex-wrap gap-2">
        <li>
          <Link href="/" className="hover:text-white">
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link href="/#speakers" className="hover:text-white">
            Speakers
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="text-white">
          {num(index)}
        </li>
      </ol>
    </nav>
  );
}

function Announced({ speaker, index, settings }: { speaker: Speaker; index: number; settings: Settings }) {
  const cta = ticketCta(settings);
  const bio = paragraphs(speaker.bio);
  const body = bio.length ? bio : speaker.shortBio ? [speaker.shortBio] : [];
  return (
    <>
      <JsonLd json={jsonLdString(speakerJsonLd(speaker, settings))} />
      <div className="shell pt-12 sm:pt-16">
        <Breadcrumb index={index} />
        <p data-reveal="fade" className="fine-print mt-16 sm:mt-24">
          Speaker {num(index)} · <time dateTime={settings.dateISO}>{settings.dateLong}</time>
        </p>
        <h1
          id="speaker-title"
          data-reveal="lines"
          className="mt-6 max-w-[14ch] text-[clamp(3.25rem,11vw,11rem)] leading-[0.86] font-semibold tracking-[-0.06em] text-balance break-words"
        >
          {speaker.name}
        </h1>
        {speaker.role ? (
          <p data-reveal="fade" className="mt-8 max-w-2xl text-xl text-mute sm:text-2xl">
            {speaker.role}
          </p>
        ) : null}
      </div>

      <div className="shell grid gap-14 py-20 sm:py-28 md:grid-cols-12">
        <figure className="md:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden border border-white/10 bg-panel">
            {speaker.photo ? (
              <Image
                src={speaker.photo}
                alt={`Portrait of ${speaker.name}`}
                fill
                priority
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover contrast-[1.08] grayscale"
              />
            ) : (
              <div aria-hidden="true" className="absolute inset-0 flex items-end p-6">
                <span className="fine-print">Portrait to follow</span>
              </div>
            )}
            {/* Vignette + hairline frame: the "plate" treatment. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_30%,transparent_55%,rgb(0_0_0/0.55))]"
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-3 border border-white/15" />
          </div>
          <figcaption data-cursor="loupe" className="fine-print mt-3 flex justify-between gap-4">
            <span>Fig. {String(index + 1).padStart(2, '0')}</span>
            <span className="text-right">{speaker.name}</span>
          </figcaption>
        </figure>

        <div className="md:col-span-7 md:pl-6 lg:pl-12">
          {speaker.talkTitle ? (
            <section aria-labelledby="talk-title" className="border-t border-white/15 pt-6">
              <h2 id="talk-title" className="fine-print">
                <ClauseNo>1</ClauseNo> <span className="ml-2">The talk</span>
              </h2>
              <p data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight text-balance">
                “{speaker.talkTitle}”
              </p>
            </section>
          ) : null}
          <section aria-labelledby="bio-title" className={`border-t border-white/15 pt-6 ${speaker.talkTitle ? 'mt-14' : ''}`}>
            <h2 id="bio-title" className="fine-print">
              <ClauseNo>2</ClauseNo> <span className="ml-2">About</span>
            </h2>
            <div data-reveal="lines" className="mt-6 max-w-2xl space-y-5 text-lg leading-relaxed text-mute">
              {body.length ? body.map((p, i) => <p key={i}>{p}</p>) : <p>Biography to follow.</p>}
            </div>
            {speaker.link ? (
              <p className="mt-8">
                <a
                  href={speaker.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
                >
                  {speaker.name}: {speaker.linkLabel}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            ) : null}
          </section>

          <div className="mt-14 flex flex-wrap gap-3">
            <Button href={cta.href} aria-label={cta.ariaLabel} size="lg">
              Tickets
            </Button>
            <Button href="/#speakers" variant="ghost" size="lg">
              All speakers
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function Unannounced({ index, settings }: { index: number; settings: Settings }) {
  return (
    <>
      <div className="shell pt-12 sm:pt-16">
        <Breadcrumb index={index} />
      </div>
      <div className="shell grid gap-16 py-16 sm:py-24 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <p className="fine-print">
            Speaker {num(index)} · <time dateTime={settings.dateISO}>{settings.dateLong}</time>
          </p>
          <h1
            id="speaker-title"
            data-reveal="lines"
            className="mt-6 text-[clamp(3.25rem,11vw,10rem)] leading-[0.86] font-semibold tracking-[-0.06em]"
          >
            To be announced.
          </h1>
          <p data-reveal="fade" className="mt-8 max-w-lg text-lg text-mute sm:text-xl">
            This speaker has not been announced yet. Their name, talk and story are withheld until the lineup is
            revealed. The mailing list hears first.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button href={settings.newsletterUrl || '/#newsletter'} size="lg">
              Get notified
            </Button>
            <Button href="/#speakers" variant="ghost" size="lg">
              All speakers
            </Button>
          </div>
        </div>

        {/* The dossier, redacted. */}
        <div className="border border-white/15 bg-black/85 p-6 sm:p-8 md:col-span-5">
          <div className="flex items-baseline justify-between">
            <span className="fine-print text-white">Dossier {num(index)}</span>
            <span className="fine-print border border-accent px-2 py-0.5 text-white">Withheld</span>
          </div>
          <dl className="mt-8 space-y-7">
            <div>
              <dt className="fine-print">Name</dt>
              <dd className="mt-3">
                <span className="sr-only">Withheld until announcement</span>
                <Redaction widths={['82%']} bar="h-9" />
              </dd>
            </div>
            <div>
              <dt className="fine-print">Talk</dt>
              <dd className="mt-3">
                <span className="sr-only">Withheld until announcement</span>
                <Redaction widths={['95%', '60%']} bar="h-4" />
              </dd>
            </div>
            <div>
              <dt className="fine-print">About</dt>
              <dd className="mt-3">
                <span className="sr-only">Withheld until announcement</span>
                <Redaction widths={['100%', '92%', '97%', '45%']} bar="h-2.5" />
              </dd>
            </div>
          </dl>
          <p data-cursor="loupe" className="fine-print mt-10 border-t border-white/10 pt-4">
            Redacted pursuant to § 2 (Speakers). To be released on announcement.
          </p>
        </div>
      </div>
    </>
  );
}

export default async function SpeakerPage({ params }: Props) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([load(slug), getSettings()]);
  if (!data) notFound();
  const { speaker, index, prev, next } = data;

  return (
    <article aria-labelledby="speaker-title" className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/85" />
      {speaker.announced ? (
        <Announced speaker={speaker} index={index} settings={settings} />
      ) : (
        <Unannounced index={index} settings={settings} />
      )}
      <SpeakerNav prev={prev} next={next} />
    </article>
  );
}
