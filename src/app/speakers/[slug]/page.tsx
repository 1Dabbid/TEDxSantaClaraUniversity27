import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ComingSoonBadge } from '@/components/ui/ComingSoon';
import { getSettings, getSpeaker, getSpeakers, paragraphs } from '@/lib/content';
import { ticketCta } from '@/lib/tickets';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const speakers = await getSpeakers();
  return speakers.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const speaker = await getSpeaker(slug);
  if (!speaker) return {};
  return {
    title: speaker.name,
    description: speaker.announced
      ? speaker.shortBio || `${speaker.name} speaks at TEDxSantaClaraUniversity.`
      : 'This speaker has not been announced yet.',
    alternates: { canonical: `/speakers/${slug}` },
    // Placeholder pages exist so links never 404, but should not be indexed.
    robots: speaker.announced ? undefined : { index: false, follow: true },
  };
}

export default async function SpeakerPage({ params }: Props) {
  const { slug } = await params;
  const [speaker, settings] = await Promise.all([getSpeaker(slug), getSettings()]);
  if (!speaker) notFound();
  const cta = ticketCta(settings);
  const bio = paragraphs(speaker.bio);

  return (
    <article aria-labelledby="speaker-title" className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 scrim-left" />
      <div className="shell grid gap-14 py-20 sm:py-28 md:grid-cols-12">
        <div className="md:col-span-12">
          <nav aria-label="Breadcrumb" className="fine-print">
            <ol className="flex gap-2">
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
            </ol>
          </nav>
        </div>

        <div className="md:col-span-5">
          <div className={`relative overflow-hidden border border-white/10 bg-panel ${speaker.photo ? 'aspect-[4/5]' : 'aspect-[16/9] md:aspect-[4/5]'}`}>
            {speaker.photo ? (
              <Image
                src={speaker.photo}
                alt={`Portrait of ${speaker.name}`}
                fill
                priority
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover grayscale"
              />
            ) : (
              <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-end gap-2 p-8">
                <span className="block h-4 w-3/4 bg-white/10" />
                <span className="block h-4 w-1/2 bg-white/10" />
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-7 md:pt-4">
          <p className="fine-print">Speaker · {settings.dateShort}</p>
          <h1 id="speaker-title" className="mt-6 text-headline font-semibold tracking-[-0.045em] text-balance">
            {speaker.name}
          </h1>
          {speaker.announced ? (
            <>
              {speaker.role ? <p className="mt-4 text-xl text-mute">{speaker.role}</p> : null}
              {speaker.talkTitle ? (
                <p className="mt-10 border-t border-white/15 pt-6 text-title font-semibold tracking-tight">
                  “{speaker.talkTitle}”
                </p>
              ) : null}
              <div className="mt-8 max-w-2xl space-y-5 leading-relaxed text-mute">
                {(bio.length ? bio : [speaker.shortBio]).filter(Boolean).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-8 max-w-xl">
              <ComingSoonBadge>Announcement pending</ComingSoonBadge>
              <p className="mt-6 text-lg text-mute">
                This speaker has not been announced yet. Join the mailing list to hear when the lineup is revealed.
              </p>
            </div>
          )}

          <div className="mt-12 flex flex-wrap gap-3">
            <Button href={cta.href} aria-label={cta.ariaLabel}>
              Tickets
            </Button>
            <Button href="/#speakers" variant="ghost">
              All speakers
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
