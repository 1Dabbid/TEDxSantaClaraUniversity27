import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Settings, Speaker } from '@/lib/content';
import { getSettings, getSpeakers, paragraphs } from '@/lib/content';
import { jsonLdString, speakerJsonLd } from '@/lib/jsonld';
import { clip, SITE_NAME } from '@/lib/site';
import { ticketCta } from '@/lib/tickets';
import { Button } from '@/components/ui/Button';
import { keepTedxCase } from '@/components/ui/KeepCase';
import { Arrow, ClauseNo, JsonLd } from '@/components/print/Print';

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
  // Previous / next only step between announced speakers: a placeholder has nothing to read.
  const announced = speakers.map((s, i) => ({ s, i })).filter((x) => x.s.announced);
  const at = announced.findIndex((x) => x.i === index);
  return {
    speaker: speakers[index],
    index,
    prev: at > 0 ? announced[at - 1] : null,
    next: at >= 0 && at < announced.length - 1 ? announced[at + 1] : null,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [data, settings] = await Promise.all([load(slug), getSettings()]);
  if (!data) return {};
  const { speaker, index } = data;
  // Plain digits in the title: screen readers spell out "Nº" letter by letter.
  const title = speaker.announced
    ? [speaker.name, speaker.talkTitle].filter(Boolean).join(': ')
    : `Speaker ${String(index + 1).padStart(2, '0')}: to be announced`;
  // The event clause is always kept whole; the bio is shortened to fit about 155 characters.
  const speaking = ` Speaking at ${SITE_NAME}: ${settings.themeName}, ${settings.dateLong}.`;
  const description = speaker.announced
    ? speaker.shortBio
      ? `${clip(speaker.shortBio, Math.max(40, 155 - speaking.length))}${speaking}`
      : `${speaker.name}.${speaking}`
    : `This ${SITE_NAME} speaker has not been announced yet.`;
  const socialTitle = `${SITE_NAME} · ${title}`;
  // Share image: the colocated opengraph-image.tsx (file convention), never set here.
  return {
    title,
    description,
    alternates: { canonical: `/speakers/${slug}` },
    openGraph: {
      type: speaker.announced ? 'profile' : 'website',
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      url: `/speakers/${slug}`,
      locale: 'en_US',
    },
    twitter: { card: 'summary_large_image', title: socialTitle, description },
    // Placeholder pages exist so links never 404, but should not be indexed.
    ...(speaker.announced ? {} : { robots: { index: false, follow: true } }),
  };
}

function SpeakerNav({ prev, next }: { prev: { s: Speaker; i: number } | null; next: { s: Speaker; i: number } | null }) {
  const label = (s: Speaker) => s.name;
  return (
    <nav aria-label="More speakers" className="shell pb-28 sm:pb-36">
      <div className="grid border-t border-white/15 sm:grid-cols-[1fr_auto_1fr]">
        <div className={prev ? 'border-b border-white/15 sm:border-b-0' : 'hidden sm:block'}>
          {prev ? (
            <Link href={`/speakers/${prev.s.slug}`} data-cursor="link" className="group block py-8 sm:pr-8">
              <span aria-hidden="true" className="fine-print flex items-center gap-2 text-mute">
                <Arrow dir="left" className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:-translate-x-1" />
                Previous · {num(prev.i)}
              </span>
              <span className="mt-3 block text-2xl font-semibold tracking-tight transition-colors group-hover:text-mute sm:text-3xl">
                <span className="sr-only">Previous speaker, number {prev.i + 1}: </span>
                {label(prev.s)}
              </span>
            </Link>
          ) : null}
        </div>
        <div className="flex items-center border-b border-white/15 py-6 sm:border-x sm:border-b-0 sm:px-8">
          <Link href="/speakers" className="fine-print link-draw inline-block py-1.5 text-white">
            All speakers
          </Link>
        </div>
        <div>
          {next ? (
            <Link href={`/speakers/${next.s.slug}`} data-cursor="link" className="group block py-8 text-right sm:pl-8">
              <span aria-hidden="true" className="fine-print flex items-center justify-end gap-2 text-mute">
                {num(next.i)} · Next
                <Arrow className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-1" />
              </span>
              <span className="mt-3 block text-2xl font-semibold tracking-tight transition-colors group-hover:text-mute sm:text-3xl">
                <span className="sr-only">Next speaker, number {next.i + 1}: </span>
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
    <nav aria-label="Breadcrumb" className="fine-print text-mute">
      <ol className="-my-1.5 flex flex-wrap items-center gap-x-2">
        <li>
          <Link href="/" className="inline-block py-1.5 hover:text-white">
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link href="/speakers" className="inline-block py-1.5 hover:text-white">
            Speakers
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="text-white">
          <span aria-hidden="true">{num(index)}</span>
          <span className="sr-only">Speaker {index + 1}</span>
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
      <JsonLd json={jsonLdString(speakerJsonLd(speaker))} />
      <div className="shell pt-12 sm:pt-16">
        <Breadcrumb index={index} />
        <p data-reveal="fade" className="fine-print mt-16 sm:mt-24 text-mute">
          Speaker {num(index)} · <time dateTime={settings.dateISO}>{settings.dateLong}</time>
        </p>
        <h1
          id="speaker-title"
          data-reveal="lines"
          className="mt-6 max-w-[14ch] text-[clamp(3.25rem,11vw,11rem)] leading-[0.86] font-semibold tracking-[-0.06em] text-balance wrap-anywhere"
        >
          {speaker.name}
        </h1>
        {speaker.role ? (
          <p data-reveal="fade" className="mt-8 max-w-2xl text-xl text-mute wrap-anywhere sm:text-2xl">
            {speaker.role}
          </p>
        ) : null}
      </div>

      <div className="shell grid gap-14 py-20 sm:py-28 md:grid-cols-12">
        <figure className="min-w-0 md:col-span-5">
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
                <span className="fine-print text-mute">Portrait to follow</span>
              </div>
            )}
            {/* Vignette + hairline frame: the "plate" treatment. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_30%,transparent_55%,rgb(0_0_0/0.55))]"
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-3 border border-white/15" />
          </div>
          <figcaption data-cursor="loupe" className="fine-print mt-3 flex justify-between gap-4 text-mute">
            {/* The figure number is print decoration: the caption reads as the name. */}
            <span aria-hidden="true" className="shrink-0">
              Fig. {String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 text-right wrap-anywhere">{keepTedxCase(speaker.name)}</span>
          </figcaption>
        </figure>

        <div className="min-w-0 wrap-anywhere md:col-span-7 md:pl-6 lg:pl-12">
          {speaker.talkTitle ? (
            <section aria-labelledby="talk-title" className="border-t border-white/15 pt-6">
              <h2 id="talk-title" className="fine-print text-mute">
                <ClauseNo>1</ClauseNo> <span className="ml-2">The talk</span>
              </h2>
              <p data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight text-balance [text-indent:-0.42em]">
                “{speaker.talkTitle}”
              </p>
            </section>
          ) : null}
          <section aria-labelledby="bio-title" className={`border-t border-white/15 pt-6 ${speaker.talkTitle ? 'mt-14' : ''}`}>
            <h2 id="bio-title" className="fine-print text-mute">
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
                  data-cursor="link"
                  className="group tap inline-flex min-h-11 items-center gap-2 text-white"
                >
                  <span className="bg-[linear-gradient(currentColor,currentColor),linear-gradient(rgb(255_255_255/0.35),rgb(255_255_255/0.35))] bg-[length:0%_1px,100%_1px] bg-[position:0_100%] bg-no-repeat transition-[background-size] duration-700 ease-[var(--ease-cinema)] group-hover:bg-[length:100%_1px,100%_1px] group-focus-visible:bg-[length:100%_1px,100%_1px]">
                    {speaker.name}: {speaker.linkLabel}
                  </span>
                  <Arrow dir="up-right" className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            ) : null}
          </section>

          <div className="mt-14 flex flex-wrap gap-3">
            {/* cta.ariaLabel already says "(opens in a new tab)" for an external ticket link. */}
            <Button href={cta.href} aria-label={cta.ariaLabel} size="lg">
              Tickets
            </Button>
            <Button href="/speakers" variant="ghost" size="lg">
              All speakers
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Placeholder page. The home page and /speakers never link here; the route
 * exists so an old or guessed link never 404s, and it is noindexed.
 */
function Unannounced({ index, settings }: { index: number; settings: Settings }) {
  return (
    <>
      <div className="shell pt-12 sm:pt-16">
        <Breadcrumb index={index} />
      </div>
      <div className="shell pb-28 pt-16 sm:pb-36 sm:pt-24">
        <p className="fine-print text-mute">
          Speaker {num(index)} · <time dateTime={settings.dateISO}>{settings.dateLong}</time>
        </p>
        <h1
          id="speaker-title"
          data-reveal="lines"
          className="mt-6 text-[clamp(3.25rem,9.6vw,8.75rem)] leading-[0.86] font-semibold tracking-[-0.06em] text-balance"
        >
          <span className="sr-only">Speaker {index + 1}: </span>
          To be announced.
        </h1>
        <p data-reveal="fade" className="mt-8 max-w-lg text-lg text-mute sm:text-xl">
          This speaker has not been announced yet. The lineup is announced on the site and to the mailing list first.
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
        <>
          <Announced speaker={speaker} index={index} settings={settings} />
          <SpeakerNav prev={prev} next={next} />
        </>
      ) : (
        <Unannounced index={index} settings={settings} />
      )}
    </article>
  );
}
